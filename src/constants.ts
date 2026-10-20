// Keep in step with the client's src/config.js and src/game/*.js by hand.
export const ROOM_MAX_CLIENTS = 50;

// Where a player appears for everyone else before their first `pose` arrives (client SPAWN).
export const SPAWN = { x: 0, y: 0.3, z: 2 };

// Walkable bounds (client WORLD_BOUNDS: the hub north through Zone 14's Star Palace, z ~ -1484), with a little slack: a
// forged pose cannot put a player outside the world for everyone else to see.
export const WORLD_BOUNDS = { minX: -200, maxX: 200, minZ: -1510, maxZ: 200, minY: -40, maxY: 200 };

// Longest accepted strings.
export const NAME_MAX = 64;
export const POSE_MAX = 32;
// Bloxity avatar JSON, relayed as-is. Kept under the 4 KB cap of the join request's options.
export const AVATAR_MAX_LEN = 3000;

// Colyseus drops the whole connection for a WebSocket message above this (default 4 KB).
export const MAX_PAYLOAD_BYTES = 128 * 1024;

// Leaderboards: how often WorldRoom re-queries Mongo for the all-time top players per stat, how
// many rows it fetches per stat before merging with the live roster, and how many it sends.
export const LEADERBOARD_REFRESH_MS = 15_000;
export const LEADERBOARD_QUERY_LIMIT = 20;
export const LEADERBOARD_ROWS = 10;

// How long a dropped connection (WiFi blip, backgrounded tab) may reconnect with the same session.
export const RECONNECT_SECONDS = 20;

// Upper bounds for saved values, so a forged payload cannot push a bogus number onto the
// leaderboards. Generous ceilings, not game rules.
export const CURRENCY_MAX = 1_000_000_000_000_000_000; // hair, xp, wins
export const REBIRTH_MAX = 1_000_000;
export const LEVEL_MAX = 1_000_000;
export const DAYS_MAX = 100_000;
export const OWNED_MAX = 500;
export const TEXT_MAX = 32; // lastDay, ids

// Quest chain index (client state.js QUESTS) and the other bounded numbers.
export const QUEST_MAX = 1000;
export const PRESTIGE_MAX = 1000;
export const UPGRADE_LEVEL_MAX = 100;

// Catalog ids (hair styles, 'tm:<treadmill>', 'cut:<id>', 'charm:<id>', 'aura:<id>', 'trail:<id>', charm slots,
// chests, upgrades, flags) are checked by shape, not against a list: the client's catalogs grow with every
// update and a hand-kept copy here would silently reject new items. A forged id only ever lands in the
// sender's own save.
export const ID_PATTERN = /^[A-Za-z0-9_:.-]{1,40}$/;
export const MAP_KEYS_MAX = 24; // entries in flags / charms / chests / upgrades maps

// Timestamps (ms): never in the future beyond clock slack; the event boost ends at most
// BOOST_MAX_AHEAD_MS from now.
export const BOOST_MAX_AHEAD_MS = 24 * 60 * 60 * 1000;
export const CLOCK_SLACK_MS = 10 * 60 * 1000;
export const CHEST_COUNT_MAX = 1_000_000;

// Visible hair count relayed for other players' hair length.
export const HAIR_SHOWN_MAX = CURRENCY_MAX;

// The client's per-browser fallback id for players who are not signed in to Bloxity.
// Guests are never persisted.
export const GUEST_ID_PREFIX = "guest-";
