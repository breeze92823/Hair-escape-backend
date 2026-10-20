import {
  CURRENCY_MAX, REBIRTH_MAX, LEVEL_MAX, DAYS_MAX, OWNED_MAX, TEXT_MAX, QUEST_MAX, PRESTIGE_MAX, UPGRADE_LEVEL_MAX, TUTORIAL_DONE,
  ID_PATTERN, MAP_KEYS_MAX, BOOST_MAX_AHEAD_MS, CLOCK_SLACK_MS,
} from "./constants.js";
import type { PlayerDoc } from "./db.js";

export function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
export function clampNum(v: number, max: number): number {
  return Math.min(max, Math.max(0, v));
}
export function clampInt(v: number, max: number, min = 0): number {
  return Math.min(max, Math.max(min, Math.floor(v)));
}
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
// A catalog id by shape only (see ID_PATTERN).
export function isId(v: unknown): v is string {
  return typeof v === "string" && ID_PATTERN.test(v);
}

// Owned ids: well-formed, no duplicates, capped.
export function sanitizeOwned(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isId))].slice(0, OWNED_MAX);
}

// Map of id -> value, keeping well-formed ids whose value `pick` accepts (returns undefined to drop).
function sanitizeMap<T>(raw: unknown, pick: (v: unknown) => T | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObject(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, MAP_KEYS_MAX)) {
    const picked = isId(k) ? pick(v) : undefined;
    if (picked !== undefined) out[k] = picked;
  }
  return out;
}

// { top: "bowClip", middle: null } -> slot -> charm id or null.
export function sanitizeCharms(raw: unknown): Record<string, string | null> {
  return sanitizeMap(raw, (v) => (v === null ? null : isId(v) ? v : undefined));
}

// The game is client-authoritative -- no server-side gameplay validation. What IS enforced:
// shape and bounds, so a malformed payload can never corrupt this player's own Mongo document.
// A forged number can only ever affect the sender's own save and their leaderboard rows.
export function sanitizeProgress(raw: unknown): Partial<PlayerDoc> | null {
  if (!isObject(raw)) return null;
  const out: Partial<PlayerDoc> = {};
  const now = Date.now();

  for (const key of ["hair", "xp", "wins", "bestHair"] as const) {
    if (finite(raw[key])) out[key] = clampNum(raw[key] as number, CURRENCY_MAX);
  }
  if (finite(raw.level)) out.level = clampInt(raw.level, LEVEL_MAX, 1);
  if (finite(raw.rebirths)) out.rebirths = clampInt(raw.rebirths, REBIRTH_MAX);
  if (finite(raw.prestige)) out.prestige = clampInt(raw.prestige, PRESTIGE_MAX);
  // Peak hair is never below current hair.
  if (out.hair !== undefined) out.bestHair = Math.max(out.bestHair ?? 0, out.hair);
  // Derived for the TOP PRESTIGE board (client leaderboards.js: rebirths * 10 + wins).
  if (out.rebirths !== undefined && out.wins !== undefined) out.prestigeScore = out.rebirths * 10 + Math.floor(out.wins);
  if (isId(raw.equipped)) out.equipped = raw.equipped;
  if (raw.owned !== undefined) out.owned = sanitizeOwned(raw.owned);
  if (finite(raw.spinAt)) out.spinAt = clampInt(raw.spinAt, now + CLOCK_SLACK_MS);
  if (finite(raw.giftAt)) out.giftAt = clampInt(raw.giftAt, now + CLOCK_SLACK_MS);
  if (finite(raw.lastSeen)) out.lastSeen = clampInt(raw.lastSeen, now + CLOCK_SLACK_MS);
  if (finite(raw.boostUntil)) out.boostUntil = clampInt(raw.boostUntil, now + BOOST_MAX_AHEAD_MS);
  // Timed chests hold the last-opened time, the rebirth chest the number claimed: both fit under the clock bound.
  if (raw.chests !== undefined) out.chests = sanitizeMap(raw.chests, (v) => (finite(v) ? clampInt(v, now + CLOCK_SLACK_MS) : undefined));
  if (raw.upgrades !== undefined) out.upgrades = sanitizeMap(raw.upgrades, (v) => (finite(v) ? clampInt(v, UPGRADE_LEVEL_MAX) : undefined));
  if (finite(raw.quest)) out.quest = clampInt(raw.quest, QUEST_MAX);
  if (finite(raw.tutorial)) out.tutorial = clampInt(raw.tutorial, TUTORIAL_DONE);
  if (raw.flags !== undefined) out.flags = sanitizeMap(raw.flags, (v) => (typeof v === "boolean" ? v : undefined));
  if (isId(raw.cut)) out.cut = raw.cut;
  if (raw.charms !== undefined) out.charms = sanitizeCharms(raw.charms);
  if (isId(raw.aura)) out.aura = raw.aura;
  if (isId(raw.trail)) out.trail = raw.trail;
  if (finite(raw.lengthPick)) out.lengthPick = Math.min(1, Math.max(0, raw.lengthPick));
  if (finite(raw.days)) out.days = clampInt(raw.days, DAYS_MAX);
  if (typeof raw.lastDay === "string" && raw.lastDay.length <= TEXT_MAX) out.lastDay = raw.lastDay;
  return out;
}

// The tutorial step loadProgress sends down: a doc without one predates the tutorial and belongs to a
// player who never needed it, so it reads as finished. New accounts get an explicit 0 (WorldRoom.ts
// persistAvatar) or no doc at all (noProgress: the client starts at 0).
export function resolveTutorialStep(doc: Partial<PlayerDoc>): number {
  return finite(doc.tutorial) ? clampInt(doc.tutorial, TUTORIAL_DONE) : TUTORIAL_DONE;
}
