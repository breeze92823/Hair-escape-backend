import { schema, t, type SchemaType } from "@colyseus/schema";
import { SPAWN } from "../../constants.js";

// The live roster: everything other clients need to draw this player. The server stores and
// relays it; the game is client-authoritative. Durable progress lives in Mongo (src/db.ts).
// To sync something new about a character, add a field here and accept it in WorldRoom's
// `pose` / `setLook` handlers.
export const PlayerState = schema(
  {
    username: t.string().default(""), // client-reported Bloxity displayName/username, not validated
    x: t.float64().default(SPAWN.x),
    y: t.float64().default(SPAWN.y),
    z: t.float64().default(SPAWN.z),
    yaw: t.float64().default(0),
    speed01: t.float64().default(0), // 0..1 gait factor -- purely cosmetic
    grounded: t.boolean().default(true),
    pose: t.string().default(""), // client animation name ("" = none)
    // The player's Bloxity avatar { equipped, proportions } as an opaque JSON string,
    // stored and relayed as-is (length-capped, never parsed here).
    avatar: t.string().default(""),
    // Hair look (client salon): hair style key, cut, aura, trail, the three charm slots and the
    // visible hair count (drives the rope length).
    equipped: t.string().default("golden"),
    cut: t.string().default("classic"),
    aura: t.string().default("none"),
    trail: t.string().default("none"),
    charmTop: t.string().default(""),
    charmMiddle: t.string().default(""),
    charmTip: t.string().default(""),
    charmBonus: t.string().default(""),
    hair: t.float64().default(3),
    // What the leaderboards rank (client state.js): mirrored from saves.
    wins: t.float64().default(0),
    bestHair: t.float64().default(3),
    rebirths: t.float64().default(0),
    prestigeScore: t.float64().default(0),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const WorldState = schema(
  {
    players: t.map(PlayerState), // keyed by sessionId
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
