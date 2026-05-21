# Game 200 (Digital Edition)

Fast-paced multiplayer card game based on Yaniv, built for mobile-first web play with real-time sync via WebSockets.

## Stack

- **Frontend:** HTML5, CSS3 (flexbox, 100vh fixed viewport), vanilla JavaScript, Socket.io client
- **Backend:** Node.js, Express (static files), Socket.io (rooms & game loop)

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:3000` on your phone or desktop. Create a room (leave code blank) or join with a 6-character code.

## Game rules (implemented)

| Rule | Detail |
|------|--------|
| Hand size | 5 cards per round |
| Deck | 1×54 (1–4 players), 2×108 (5–9), 3×162 (10–14), +1 deck per 5 players |
| Empty deck | Discard pile (except top card) is shuffled back into the draw pile |
| Points | Joker 0, Ace 1, 2–10 face, J/Q/K 10 |
| Turn | Drop valid meld + draw 1 (deck or discard top); **or** drop matching discard rank with no draw; **or** Call Show at turn start |
| Show lock | Disabled until `turnCount >= playerCount` |
| Show scoring | Lowest wins 0; caught caller pays **50** penalty (not hand value) |
| Elimination | Score ≥ **200** → out; last player wins |

## Project layout

```
server.js           Express + Socket.io entry
lib/gameEngine.js   Deck, scoring, meld validation, Show resolution
lib/roomManager.js  In-memory rooms, turns, rounds
public/             Mobile UI (auth → lobby → board)
```

## Socket events

| Client → Server | Description |
|-----------------|-------------|
| `createRoom` | Host new room |
| `joinRoom` | Join by code |
| `startGame` | Host starts (2+ players) |
| `dropAndSwap` | `{ cardIds, drawFrom: 'deck' \| 'discard' \| 'none' }` (`none` when cards match discard rank) |
| `callShow` | End round with showdown |
| `nextRound` | Host deals next round |

| Server → Client | Description |
|-----------------|-------------|
| `roomState` | Sanitized game snapshot (own hand only unless showdown) |
| `roomClosed` | Room deleted |

## Development notes

- State is **in-memory** and lost on server restart.
- Reconnection uses a new socket id (rejoin flow can be added later).
- For production, put the server behind HTTPS and enable sticky sessions if scaling horizontally.
