import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import GameRoom from "./models/GameRoom.js";
import { createGame, getLegalMoves, moveToken, publicGame } from "./game.js";

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"] }
});
const rooms = new Map();

const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const cleanName = value => String(value || "Player").trim().slice(0, 18) || "Player";
const emitRoom = code => {
  const room = rooms.get(code);
  if (room) io.to(code).emit("room:update", room);
};
async function persist(room) {
  if (mongoose.connection.readyState !== 1) return;
  await GameRoom.findOneAndUpdate({ code: room.code }, {
    code: room.code, hostId: room.hostId, status: room.status,
    players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color, connected: p.connected })),
    game: room.game, updatedAt: new Date()
  }, { upsert: true, setDefaultsOnInsert: true }).catch(err => console.error("Mongo save:", err.message));
}
function sendError(socket, message) { socket.emit("game:error", { message }); }

app.get("/health", (_req, res) => res.json({ ok: true, service: "LudoConnect API" }));
app.get("/api/rooms/:code", (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ code: room.code, status: room.status, players: room.players.map(p => ({ name: p.name, color: p.color, connected: p.connected })) });
});

io.on("connection", socket => {
  socket.on("room:create", ({ name }, callback = () => {}) => {
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const player = { id: socket.id, name: cleanName(name), color: "red", connected: true };
    const room = { code, hostId: socket.id, status: "waiting", players: [player], game: null, createdAt: Date.now() };
    rooms.set(code, room);
    socket.join(code);
    callback({ ok: true, code, room });
    emitRoom(code);
  });

  socket.on("room:join", ({ code, name }, callback = () => {}) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return callback({ ok: false, error: "Room not found. Check the code." });
    if (room.status !== "waiting") return callback({ ok: false, error: "This game has already started." });
    if (room.players.length >= 4) return callback({ ok: false, error: "This room is full." });
    const player = { id: socket.id, name: cleanName(name), color: ["red", "green", "yellow", "blue"][room.players.length], connected: true };
    room.players.push(player);
    socket.join(code);
    callback({ ok: true, code, room });
    emitRoom(code);
  });

  socket.on("room:start", ({ code }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return sendError(socket, "Room not found.");
    if (room.hostId !== socket.id) return sendError(socket, "Only the room host can start the game.");
    if (room.players.length < 2) return sendError(socket, "At least two players are required.");
    if (room.status !== "waiting") return;
    room.status = "playing";
    room.game = createGame(room.players);
    emitRoom(room.code);
    persist(room);
  });

  socket.on("game:roll", ({ code }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.status !== "playing" || !room.game) return sendError(socket, "Game is not active.");
    const game = room.game;
    const player = game.players[game.currentTurn];
    if (!player || player.id !== socket.id) return sendError(socket, "It is not your turn.");
    if (game.dice !== null) return sendError(socket, "Move a token before rolling again.");
    const dice = Math.floor(Math.random() * 6) + 1;
    game.dice = dice;
    game.legalMoves = getLegalMoves(game, game.currentTurn, dice);
    if (!game.legalMoves.length) {
      game.turnMessage = `${player.name} rolled ${dice}; no legal moves.`;
      if (dice !== 6) game.currentTurn = (game.currentTurn + 1) % game.players.length;
      game.dice = null;
    } else {
      game.turnMessage = `${player.name} rolled ${dice}. Select a highlighted token.`;
    }
    emitRoom(room.code);
    persist(room);
  });

  socket.on("game:move", ({ code, tokenIndex }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.status !== "playing" || !room.game) return sendError(socket, "Game is not active.");
    const game = room.game;
    const playerIndex = game.currentTurn;
    const player = game.players[playerIndex];
    if (!player || player.id !== socket.id) return sendError(socket, "It is not your turn.");
    if (game.dice === null || !game.legalMoves.includes(Number(tokenIndex))) return sendError(socket, "That token cannot move.");
    room.game = moveToken(game, playerIndex, Number(tokenIndex), game.dice);
    if (room.game.status === "finished") room.status = "finished";
    emitRoom(room.code);
    persist(room);
  });

  socket.on("room:rejoin", ({ code, playerId }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return sendError(socket, "Room no longer exists on this server.");
    const player = room.players.find(p => p.id === playerId);
    if (!player) return sendError(socket, "Player session not found. Join as a new player.");
    player.id = socket.id;
    player.connected = true;
    if (room.game) {
      const gp = room.game.players.find(p => p.name === player.name && p.color === player.color);
      if (gp) { gp.id = socket.id; gp.connected = true; }
    }
    socket.join(room.code);
    emitRoom(room.code);
    socket.emit("room:rejoined", { code: room.code, room });
    persist(room);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.connected = false;
        if (room.game) {
          const gp = room.game.players.find(p => p.id === socket.id);
          if (gp) gp.connected = false;
        }
        emitRoom(room.code);
        persist(room);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection failed:", err.message));
}
server.listen(PORT, () => console.log(`LudoConnect server listening on ${PORT}`));
