# LudoConnect — Real-Time Multiplayer Ludo

A full-stack multiplayer Ludo starter built with React, Express, Socket.IO and MongoDB.

## Features

- Create private rooms with six-character invite codes
- Join rooms by code or shareable URL (`?room=ABC123`)
- 2–4 human players; no simulated opponents
- Socket.IO live room updates
- Server-authoritative dice rolls and legal move validation
- Four tokens per player, captures, safe squares, six-to-start and winner detection
- Responsive UI for desktop and mobile
- MongoDB room snapshots when `MONGODB_URI` is configured
- Health endpoint at `/health`

## Requirements

- Node.js 20+
- npm
- MongoDB local instance or MongoDB Atlas URI (optional for local in-memory play)

## Run locally

From the project root:

```bash
npm install
npm run install:all
```

Copy environment examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Edit `server/.env`:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/ludoconnect
```

Edit `client/.env`:

```env
VITE_SERVER_URL=http://localhost:4000
```

Start both apps:

```bash
npm run dev
```

Open http://localhost:5173 in two different browsers/devices. One player creates a room; the other joins with the room code. The host starts when at least two players have joined.

## Deployment

### 1. MongoDB Atlas
1. Create a free cluster at https://www.mongodb.com/atlas.
2. Create a database user and allow your deployment host's network access.
3. Copy the Node.js connection string and replace the password/database name.

### 2. Backend on Render
1. Push this project to GitHub.
2. Create a new **Web Service** on https://render.com and select the repository.
3. Set **Root Directory** to `server`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables:
   - `MONGODB_URI` = your Atlas connection string
   - `CLIENT_ORIGIN` = your deployed frontend URL
   - `NODE_ENV` = `production`
7. Deploy and copy the service URL, e.g. `https://your-api.onrender.com`.

### 3. Frontend on Vercel
1. Import the GitHub repository at https://vercel.com.
2. Set **Root Directory** to `client`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add `VITE_SERVER_URL` = your Render backend URL.
6. Deploy.

After deployment, update Render's `CLIENT_ORIGIN` to the final Vercel URL and redeploy/restart the backend.

## Important architecture notes / current limitations

- Active rooms and authoritative live game state are held in the Node process memory. MongoDB stores room snapshots, but this starter does **not** restore active socket sessions after a server restart. For multi-instance production scaling, add a Socket.IO Redis adapter and persist/re-hydrate active room state.
- Reconnection is supported while the server process remains alive when the same browser tab retains its socket session identity; the UI currently provides room invite links but does not yet persist a durable player resume token across a full page refresh.
- This implementation uses a compact board visualization. The 52-space route is represented by an abstract perimeter path; before commercial/competitive use, validate the board geometry and all regional Ludo rule variations.
- Standard Ludo variants differ on consecutive sixes, blockades, exact home entry and safe squares. This project implements a simple consistent variant: exact home entry is required; rolling six or capturing grants another turn; no blockade rule.
- Add HTTPS, rate limiting, input validation, authentication, abuse protection, structured logs and automated tests before production use.
- The current game room state is not durable across server restarts. MongoDB persistence here is a snapshot/audit starting point, not full recovery.

## Project structure

```text
ludoconnect/
  client/
    src/App.jsx
    src/main.jsx
    src/style.css
    .env.example
  server/
    src/index.js
    src/game.js
    src/models/GameRoom.js
    .env.example
  package.json
  README.md
```

## Game rules in this build

1. Two to four human players join a room.
2. Host starts the game.
3. Players take turns rolling a server-generated die.
4. A token can leave base only on a six.
5. A token moves forward by the die value; exact roll is needed to finish.
6. Opponents on the same non-safe shared square are sent back to base.
7. A six or a capture grants another turn.
8. First player to finish all four tokens wins.

## License

For learning and portfolio use. Review third-party dependency licenses before redistribution.
