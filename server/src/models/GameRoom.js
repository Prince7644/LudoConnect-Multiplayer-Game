import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  code: { type: String, unique: true, index: true },
  hostId: String,
  status: { type: String, default: "waiting" },
  players: [{ id: String, name: String, color: String, connected: Boolean }],
  game: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.models.GameRoom || mongoose.model("GameRoom", roomSchema);
