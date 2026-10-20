# Hair Escape — server

Colyseus server for the `Hair-escape` client: progress saving, multiplayer presence (poses, Bloxity
avatars, hair looks) and leaderboards. Same stack and Bloxity Legion deploy flow as
`Clean-leaves-for-loot-backend`.

```
npm install
npm start        # tsx watch, ws://localhost:2567 (playground + /monitor in dev), GET /health
npm test         # mocha integration tests with an in-memory fake Mongo collection
npm run build    # -> build/, run with `node build/index.js` (see Dockerfile)
```

Config (all optional locally, see `.env.example`): `MONGODB_URI` (without it nothing persists),
`CLIENT_ORIGIN`, `PORT`.

## Protocol

Room: `world` (`joinOrCreate("world", { userId, username, avatar })`), up to 50 players per room;
extra players get a new room. `userId` is the Bloxity id; ids starting `guest-` are never saved.

| Client → server | Purpose |
| --- | --- |
| `pose` | `x y z yaw speed01 grounded pose` (~15 Hz) |
| `setAvatar` | Bloxity avatar JSON |
| `setLook` | `{ equipped, cut, aura, trail, charms: { top, middle, tip }, hair }` (hair = visible hair count) |
| `saveProgress` | the persisted `state.js` keys, debounced (sanitized, upserted in Mongo) |
| `identify` | `{ userId, username }` after a sign-in / sign-out; answered with `progress` / `noProgress` |

| Server → client | Purpose |
| --- | --- |
| `progress` | the saved document (hydrates `state`), plus `serverTime` |
| `noProgress` | new account, guest, or no Mongo — keep the local state (and push it) |
| `serverError` | the saved document could not be read; the client must not overwrite it |
| `leaderboard` | `{ wins, hair, rebirths, prestige }`, rows `{ id, name, value }`, top 10 (#1 row also carries `avatar`) |

Persisted keys (`src/sanitize.ts`): `hair level xp wins rebirths equipped owned spinAt chests lastSeen
prestige upgrades quest bestHair giftAt boostUntil flags cut charms aura trail lengthPick days lastDay`. `prestigeScore`
(`rebirths * 10 + wins`) is derived on save for the TOP PRESTIGE board; TOP HAIR ranks `bestHair`.
Room state (`WorldState.players`) syncs pose, avatar, hair look, name and the leaderboard stats.

The game is client-authoritative: the server only enforces shape and bounds on saves. The id lists
and caps in `src/constants.ts` (`SPAWN`, `WORLD_BOUNDS`, the numeric ceilings) must be kept in step with
the client's `src/config.js` by hand. Catalog ids (hair styles, cosmetics, chests, upgrades, flags) are
checked by shape only (`ID_PATTERN`), so new items need no backend change.

The client side is `src/net.js` in the Hair-escape repo.

## Deploy

`.github/workflows/deploy.yml`: pull requests run build + tests; pushes to `dev` deploy the dev
channel and `main` the prod channel on Bloxity Legion (image pushed to GHCR). Needs the repo
variable `LEGION_GAME_ID` (= the client's `GAME_SLUG`, `hair-escape`) and the secret
`LEGION_DEPLOY_TOKEN`.
