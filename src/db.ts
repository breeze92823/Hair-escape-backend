import { MongoClient, type Collection } from "mongodb";

// Bloxity Legion hosting injects MONGODB_URI per game+channel -- an isolated database with
// scoped credentials. A local `npm start` normally has no Mongo reachable, so a missing or
// unreachable URI must degrade to "no persistence" rather than crash the room.

// Mirrors the persisted half of the client's src/game/state.js.
export interface PlayerDoc {
  _id: string; // Bloxity user id -- see WorldRoom.ts (guests are never saved)
  // Display name as of the last save, so an offline leaderboard row still has something to show.
  username?: string;
  // Bloxity avatar JSON as last reported, so a board's top row can still be dressed offline.
  avatar?: string;
  hair?: number; // the currency
  level?: number;
  xp?: number;
  wins?: number;
  rebirths?: number;
  prestige?: number; // prestiges done
  prestigeScore?: number; // rebirths * 10 + wins, derived on save for the TOP PRESTIGE board
  equipped?: string; // equipped hair style
  owned?: string[]; // hair styles, treadmills (tm:), salon items (cut:/charm:/aura:/trail:)
  spinAt?: number; // epoch ms of the last Lucky Spin
  chests?: Record<string, number>;
  upgrades?: Record<string, number>; // upgrade id -> level
  lastSeen?: number; // epoch ms, for offline earnings
  quest?: number;
  tutorial?: number; // new-player tutorial step; a doc without it predates the tutorial (reads as finished)
  bestHair?: number; // peak hair, ranked by TOP HAIR
  stageReached?: number; // furthest teleport stage index reached
  giftAt?: number;
  boostUntil?: number;
  flags?: Record<string, boolean>;
  cut?: string;
  charms?: Record<string, string | null>; // slot -> charm id
  aura?: string;
  trail?: string;
  lengthPick?: number; // 0..1
  days?: number;
  lastDay?: string;
  version: number;
  updatedAt: Date;
}

let client: MongoClient | null = null;
let players: Collection<PlayerDoc> | null = null;

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[db] MONGODB_URI not set -- player progress will not persist");
    return;
  }
  try {
    client = new MongoClient(uri);
    await client.connect();
    // No dbName passed to .db() -- the injected URI already points at this game+channel's database.
    players = client.db().collection<PlayerDoc>("players");
    console.log("[db] connected to MongoDB");

    // refreshLeaderboard() sorts by each of these; createIndex is idempotent. A failure only
    // means those queries stay unindexed, never blocks startup.
    try {
      await players.createIndex({ wins: -1 });
      await players.createIndex({ bestHair: -1 });
      await players.createIndex({ rebirths: -1 });
      await players.createIndex({ prestigeScore: -1 });
    } catch (err) {
      console.warn("[db] failed to create leaderboard indexes:", err);
    }
  } catch (err) {
    console.warn("[db] connect failed -- player progress will not persist:", err);
    client = null;
    players = null;
  }
}

// Null whenever Mongo is unset/unreachable -- every caller must treat that as "skip persistence".
export function getPlayers(): Collection<PlayerDoc> | null {
  return players;
}

// Test-only seam: exercise the leaderboard/save logic against an in-memory fake collection.
export function __setPlayersForTest(fake: Collection<PlayerDoc> | null): void {
  players = fake;
}
