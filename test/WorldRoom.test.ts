import assert from "assert";
import type { Collection } from "mongodb";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import { WorldState } from "../src/rooms/schema/WorldState.js";
import { SPAWN, WORLD_BOUNDS } from "../src/constants.js";
import { __setPlayersForTest, type PlayerDoc } from "../src/db.js";

// waitForNextPatch() resolves on the server's tick, which can be before a
// connected client has decoded it; poll the client's view instead.
async function until(check: () => boolean, ms = 1000) {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
}

// Hand-rolled fake `players` collection implementing only the subset WorldRoom.ts calls:
// find().sort().limit().toArray(), updateOne() (upsert, $set), findOne().
function fakePlayersCollection(seed: PlayerDoc[] = []) {
  const docs = new Map<string, PlayerDoc>(seed.map((d) => [d._id, d]));
  const fake = {
    docs,
    async findOne(filter: { _id: string }) {
      return docs.get(filter._id) ?? null;
    },
    async updateOne(filter: { _id: string }, update: any, options: any) {
      const existing = docs.get(filter._id);
      if (!existing && !options?.upsert) return { modifiedCount: 0 };
      const base = existing ?? ({ _id: filter._id, ...(update.$setOnInsert ?? {}) } as PlayerDoc);
      const next: any = { ...base, ...(update.$set ?? {}) };
      for (const [k, v] of Object.entries<number>(update.$max ?? {})) next[k] = Math.max(next[k] ?? -Infinity, v);
      docs.set(filter._id, next as PlayerDoc);
      return { modifiedCount: 1 };
    },
    find(_filter: any) {
      let sortField: string | null = null;
      let limitN = Infinity;
      const cursor = {
        sort(spec: Record<string, number>) {
          sortField = Object.keys(spec)[0];
          return cursor;
        },
        limit(n: number) {
          limitN = n;
          return cursor;
        },
        async toArray() {
          let arr = Array.from(docs.values());
          if (sortField) {
            const field = sortField;
            arr = arr.slice().sort((a: any, b: any) => (b[field] ?? 0) - (a[field] ?? 0));
          }
          return arr.slice(0, limitN);
        },
      };
      return cursor;
    },
  };
  return fake as unknown as Collection<PlayerDoc> & { docs: Map<string, PlayerDoc> };
}


describe("WorldRoom", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => (colyseus = await boot(appConfig)));
  after(async () => colyseus.shutdown());
  beforeEach(async () => {
    await colyseus.cleanup();
  });
  afterEach(() => __setPlayersForTest(null));

  it("starts a joining player at the spawn, with their name and avatar", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const avatar = JSON.stringify({ equipped: { hatId: "3" } });
    const c1 = await colyseus.connectTo(room, { username: "Rapunzel", avatar });
    const c2 = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    const s = c2.state.players.get(c1.sessionId)!;
    assert.strictEqual(s.username, "Rapunzel");
    assert.strictEqual(s.avatar, avatar);
    assert.strictEqual(s.x, SPAWN.x);
    assert.strictEqual(s.z, SPAWN.z);
  });

  it("relays pose to other players and sanitises it", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c1 = await colyseus.connectTo(room);
    const c2 = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    c1.send("pose", { x: -20.5, y: 2, z: -300, yaw: 0.5, speed01: 7, grounded: false, pose: "run" });
    await until(() => c2.state.players.get(c1.sessionId)!.z === -300);
    const s = c2.state.players.get(c1.sessionId)!;
    assert.strictEqual(s.x, -20.5);
    assert.strictEqual(s.speed01, 1); // clamped to 0..1
    assert.strictEqual(s.grounded, false);
    assert.strictEqual(s.pose, "run");

    // NaN is ignored, null clears the pose, out-of-world positions are clamped.
    c1.send("pose", { x: NaN, z: 99999, pose: null });
    await until(() => c2.state.players.get(c1.sessionId)!.z === WORLD_BOUNDS.maxZ);
    const s2 = c2.state.players.get(c1.sessionId)!;
    assert.strictEqual(s2.x, -20.5);
    assert.strictEqual(s2.pose, "");
  });

  it("relays the hair look, rejecting unknown ids", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c1 = await colyseus.connectTo(room);
    const c2 = await colyseus.connectTo(room);
    await room.waitForNextPatch();

    c1.send("setLook", { equipped: "slime", cut: "braid", aura: "fire", trail: "ocean", charms: { top: "bowClip", middle: "no spaces", tip: null }, hair: 500 });
    await until(() => c2.state.players.get(c1.sessionId)!.equipped === "slime");
    const s = c2.state.players.get(c1.sessionId)!;
    assert.strictEqual(s.cut, "braid");
    assert.strictEqual(s.aura, "fire");
    assert.strictEqual(s.trail, "ocean");
    assert.strictEqual(s.charmTop, "bowClip");
    assert.strictEqual(s.charmMiddle, "");
    assert.strictEqual(s.hair, 500);

    c1.send("setLook", { equipped: "<script>", aura: "no spaces" });
    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(c2.state.players.get(c1.sessionId)!.equipped, "slime"); // ignored
    assert.strictEqual(c2.state.players.get(c1.sessionId)!.aura, "fire"); // ignored
  });

  it("rejects an oversized avatar", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c1 = await colyseus.connectTo(room, { avatar: "{}" });
    const c2 = await colyseus.connectTo(room);
    await room.waitForNextPatch();
    c1.send("setAvatar", { avatar: "x".repeat(3500) });
    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(c2.state.players.get(c1.sessionId)!.avatar, "{}");
  });

  it("removes a player who leaves", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c1 = await colyseus.connectTo(room);
    const c2 = await colyseus.connectTo(room);
    await room.waitForNextPatch();
    assert.strictEqual(c2.state.players.size, 2);

    await c1.leave();
    await until(() => c2.state.players.size === 1);
    assert.strictEqual(c2.state.players.has(c1.sessionId), false);
  });

  it("saves a signed-in player's progress", async () => {
    const fake = fakePlayersCollection();
    __setPlayersForTest(fake);
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c = await colyseus.connectTo(room, { userId: "u1", username: "Rapunzel" });

    c.send("saveProgress", { hair: 120, wins: 4, rebirths: 2, equipped: "slime", owned: ["slime", "tm:x8", "<bad>"], cut: "braid" });
    await until(() => fake.docs.has("u1"));
    const doc = fake.docs.get("u1")!;
    assert.strictEqual(doc.hair, 120);
    assert.strictEqual(doc.username, "Rapunzel");
    assert.strictEqual(doc.prestigeScore, 24);
    assert.deepStrictEqual(doc.owned, ["slime", "tm:x8"]);
    const live = room.state.players.get(c.sessionId)!;
    assert.strictEqual(live.wins, 4);
    assert.strictEqual(live.prestigeScore, 24);
  });

  it("sends a returning account its saved progress, and noProgress to a new one", async () => {
    const fake = fakePlayersCollection([
      { _id: "u2", username: "Back", hair: 900, wins: 7, rebirths: 1, equipped: "ruby", version: 1, updatedAt: new Date() },
    ]);
    __setPlayersForTest(fake);
    const room = await colyseus.createRoom<WorldState>("world", {});

    // The reply can land before a client handler is registered, so capture it server-side.
    const sent: [string, any][] = [];
    const orig = (room as any).loadProgress.bind(room);
    (room as any).loadProgress = (c: any, ...rest: any[]) => {
      const send = c.send.bind(c);
      c.send = (type: string, msg: any) => {
        sent.push([type, msg]);
        send(type, msg);
      };
      return orig(c, ...rest);
    };

    const back = await colyseus.connectTo(room, { userId: "u2", username: "Back" });
    await colyseus.connectTo(room, { userId: "u-new", username: "Fresh" });
    await until(() => sent.length >= 2);

    const progress = sent.find(([t]) => t === "progress")![1];
    assert.strictEqual(progress.hair, 900);
    assert.strictEqual(progress.equipped, "ruby");
    assert.ok(sent.some(([t]) => t === "noProgress"));
    assert.strictEqual(room.state.players.get(back.sessionId)!.wins, 7);
  });

  it("never persists guests", async () => {
    const fake = fakePlayersCollection();
    __setPlayersForTest(fake);
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c = await colyseus.connectTo(room, { userId: "guest-abc", username: "Guest" });
    c.send("saveProgress", { hair: 5, wins: 9 });
    await until(() => room.state.players.get(c.sessionId)?.wins === 9);
    assert.strictEqual(fake.docs.size, 0);
    assert.strictEqual(room.state.players.get(c.sessionId)!.wins, 9); // still on the live board
  });

  it("broadcasts leaderboards merging saved and online players", async () => {
    const fake = fakePlayersCollection([
      { _id: "old", username: "Veteran", wins: 50, bestHair: 1e6, rebirths: 4, prestigeScore: 90, version: 1, updatedAt: new Date() },
    ]);
    __setPlayersForTest(fake);
    const room = await colyseus.createRoom<WorldState>("world", {});
    const c = await colyseus.connectTo(room, { userId: "u3", username: "Newbie" });
    let boards: any = null;
    c.onMessage("leaderboard", (m) => (boards = m));
    c.send("saveProgress", { hair: 100, wins: 3, rebirths: 1 });
    await until(() => room.state.players.get(c.sessionId)?.wins === 3);
    boards = null;
    await (room as any).refreshLeaderboard();
    await until(() => boards !== null);
    assert.deepStrictEqual(boards.wins.map((r: any) => r.name), ["Veteran", "Newbie"]);
    assert.deepStrictEqual(boards.rebirths.map((r: any) => r.value), [4, 1]);
    assert.deepStrictEqual(boards.hair.map((r: any) => r.value), [1e6, 100]);
    assert.ok(boards.prestige);
  });
});
