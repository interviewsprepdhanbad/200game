# Game 200 (Digital Edition)

Fast-paced multiplayer card game based on Yaniv, built for mobile-first web play with real-time sync via WebSockets.

## Stack

- **Frontend:** HTML5, CSS3, ES modules (vanilla JS), Socket.io client
- **Backend:** Node.js (ESM), Express, Socket.io
- **Shared:** `shared/` — meld rules and constants used by server and browser

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:3000`. Create a room (leave code blank) or join with a 6-character code.

Development with auto-restart:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## Project layout

```
src/
  server.js              Entry point
  config.js              Environment configuration
  createApp.js           Express app + static files
  game/
    engine.js            Deck, scoring, show resolution (pure logic)
    roomStore.js         In-memory room registry
    roomService.js       Room lifecycle and game actions
    clientView.js        Server → client state projection
  socket/
    registerHandlers.js  Socket.io event wiring
    roomBroadcast.js     Per-player roomState broadcast

shared/
  constants.js           Game limits and phase names
  meld.js                Drop / set / run validation
  result.js              Service-layer result helpers

public/
  js/
    main.js              Client bootstrap
    app/GameApp.js       Application controller
    state.js             Client state object
    session.js           Player id + room session persistence
    ui/                  DOM, screens, cards, animations
    game/                Drop animation helpers

test/                    Node built-in test runner
```

## Game rules (implemented)

| Rule | Detail |
|------|--------|
| Hand size | 5 cards per round |
| Deck | 1×54 (1–4 players), 2×108 (5–9), +1 deck per 5 players |
| Empty deck | Discard pile (except top card) shuffled back into draw pile |
| Points | Joker 0, Ace 1, 2–10 face, J/Q/K 10 |
| Turn | Drop valid meld + draw 1; or match discard rank with no draw; or Call Show |
| Show lock | Disabled until each player has had a turn |
| Show scoring | Lowest wins 0; caught caller pays **50** penalty |
| Elimination | Score ≥ **200** → out; last player wins |

## Socket events

| Client → Server | Description |
|-----------------|-------------|
| `createRoom` | Host new room |
| `joinRoom` | Join or reconnect by code + `playerId` |
| `startGame` | Host starts (2+ players) |
| `dropAndSwap` | `{ cardIds, drawFrom: 'deck' \| 'discard' \| 'none' }` |
| `callShow` | End round with showdown |
| `nextRound` | Host deals next round |

| Server → Client | Description |
|-----------------|-------------|
| `roomState` | Sanitized snapshot (own hand only unless showdown) |
| `roomClosed` | Room deleted (all players left) |

## Session & reconnection

- **Player id** — stored in `localStorage`, stable across refreshes
- **Room session** — room code, name, and phase in `localStorage`
- On load or socket reconnect, the client re-joins automatically and restores the correct screen (lobby or in-game)

## Production notes

- State is **in-memory**; lost on server restart. For production, add Redis or a database behind `RoomStore`.
- Serve over **HTTPS**; set `CORS_ORIGIN` to your domain in `.env`.
- Health check: `GET /health`
- Horizontal scale requires shared room storage and sticky sessions (or Socket.io Redis adapter).

## Environment

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `CORS_ORIGIN` | `*` | Socket.io CORS origin |
