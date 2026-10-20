import assert from "assert";

import { sanitizeProgress } from "../src/sanitize.js";

describe("sanitizeProgress", () => {
  it("rejects non-objects and bounds numbers", () => {
    assert.strictEqual(sanitizeProgress(null), null);
    assert.strictEqual(sanitizeProgress([1]), null);
    const out = sanitizeProgress({ hair: 1e30, wins: -5, xp: NaN, level: 0, rebirths: 2.9, hack: "x" })!;
    assert.strictEqual(out.hair, 1e18);
    assert.strictEqual(out.wins, 0);
    assert.strictEqual(out.xp, undefined);
    assert.strictEqual(out.level, 1);
    assert.strictEqual(out.rebirths, 2);
    assert.ok(!("hack" in out));
  });

  it("derives bestHair and prestige", () => {
    const out = sanitizeProgress({ hair: 500, bestHair: 100, wins: 7, rebirths: 3 })!;
    assert.strictEqual(out.bestHair, 500);
    assert.strictEqual(out.prestigeScore, 37);
  });

  it("keeps well-formed ids and drops the rest", () => {
    const out = sanitizeProgress({
      equipped: "gummy",
      prestige: 2.7,
      owned: ["gummy", "gummy", "tm:x500", "cut:royal", "charm:prestigeStar", "<evil>", "", 5],
      cut: "has space",
      aura: "dragon",
      charms: { top: "bowClip", middle: "<bogus>", tip: null, bonus: "prestigeStar" },
      chests: { group: 1.7e12, rebirth: 3, "bad key!": 1 },
      upgrades: { hair: 4.8, wins: 999, junk: "x" },
      flags: { treadmill: true, portal: "yes", x2: false },
      lengthPick: 4,
    })!;
    assert.strictEqual(out.equipped, "gummy");
    assert.strictEqual(out.prestige, 2);
    assert.deepStrictEqual(out.owned, ["gummy", "tm:x500", "cut:royal", "charm:prestigeStar"]);
    assert.strictEqual(out.cut, undefined);
    assert.strictEqual(out.aura, "dragon");
    assert.deepStrictEqual(out.charms, { top: "bowClip", tip: null, bonus: "prestigeStar" });
    assert.deepStrictEqual(out.chests, { group: 1.7e12, rebirth: 3 });
    assert.deepStrictEqual(out.upgrades, { hair: 4, wins: 100 });
    assert.deepStrictEqual(out.flags, { treadmill: true, x2: false });
    assert.strictEqual(out.lengthPick, 1);
  });

  it("never lets a timestamp run far into the future", () => {
    const out = sanitizeProgress({ boostUntil: Date.now() * 2, giftAt: Date.now() * 2 })!;
    assert.ok(out.boostUntil! <= Date.now() + 24 * 3600e3);
    assert.ok(out.giftAt! <= Date.now() + 11 * 60e3);
  });
});
