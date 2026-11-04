import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Users, Copy, ArrowLeft, Crown, Volume2, VolumeX, Dice5, Wifi, WifiOff, Gamepad2, Sparkles } from "lucide-react";

const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const socket = io(SERVER, { autoConnect: true, transports: ["websocket", "polling"] });
const COLORS = ["red", "green", "yellow", "blue"];
const STARTS = [0, 13, 26, 39];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const TRACK = Array.from({ length: 52 }, (_, i) => i);

function App() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState(localStorage.getItem("ludo-name") || "");
  const [codeInput, setCodeInput] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [muted, setMuted] = useState(true);
  const [myPlayerId, setMyPlayerId] = useState(socket.id || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    socket.on("connect", () => setMyPlayerId(socket.id));
    socket.on("room:update", data => {
      setRoom(data);
      setScreen(data.status === "waiting" ? "lobby" : "game");
    });
    socket.on("game:error", data => setError(data.message));
    socket.on("room:rejoined", data => { setRoom(data.room); setScreen(data.room.status === "waiting" ? "lobby" : "game"); });
    return () => {
      socket.off("connect"); socket.off("room:update"); socket.off("game:error"); socket.off("room:rejoined");
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invite = params.get("room");
    if (invite) setCodeInput(invite.toUpperCase());
  }, []);

  const me = room?.players?.find(p => p.id === myPlayerId) || room?.players?.find(p => p.name === name);
  const gameMe = room?.game?.players?.find(p => p.id === myPlayerId) || room?.game?.players?.find(p => p.name === name);
  const isHost = room?.hostId === myPlayerId || room?.hostId === me?.id;
  const current = room?.game?.players?.[room.game.currentTurn];
  const myTurn = gameMe && current?.id === gameMe.id;

  function validName() {
    const n = name.trim();
    if (!n) { setError("Please enter your name first."); return false; }
    localStorage.setItem("ludo-name", n);
    setError(""); return true;
  }
  function createRoom() {
    if (!validName()) return;
    socket.emit("room:create", { name }, result => {
      if (!result?.ok) return setError(result?.error || "Could not create room.");
      setRoom(result.room); setScreen("lobby"); setError("");
    });
  }
  function joinRoom() {
    if (!validName()) return;
    socket.emit("room:join", { name, code: codeInput }, result => {
      if (!result?.ok) return setError(result?.error || "Could not join room.");
      setRoom(result.room); setScreen("lobby"); setError("");
    });
  }
  function startGame() { socket.emit("room:start", { code: room.code }); }
  function rollDice() { setError(""); socket.emit("game:roll", { code: room.code }); }
  function moveToken(tokenIndex) { socket.emit("game:move", { code: room.code, tokenIndex }); }
  async function copyInvite() {
    const url = `${location.origin}?room=${room.code}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setNotice(`Invite code: ${room.code}`); }
  }
  function backHome() { setRoom(null); setScreen("home"); setError(""); history.replaceState({}, "", location.pathname); }

  return <main className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={backHome}><span className="brand-icon"><Gamepad2 size={21}/></span><span>Ludo<span className="brand-accent">Connect</span></span></button>
      <div className="top-right"><span className="online-pill"><i/> Live multiplayer</span><button className="icon-btn" title="Toggle sound" onClick={() => setMuted(!muted)}>{muted ? <VolumeX/> : <Volume2/>}</button></div>
    </header>

    {screen === "home" && <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> THE CLASSIC, CONNECTED</div>
        <h1>Good times.<br/><em>Great company.</em></h1>
        <p className="hero-sub">Bring your people together for a game of Ludo. Create a room, share the code, and play from anywhere.</p>
        <div className="name-field"><label>Your player name</label><input value={name} onChange={e => setName(e.target.value)} maxLength={18} placeholder="Enter your name" onKeyDown={e => e.key === "Enter" && createRoom()}/></div>
        <div className="home-actions"><button className="primary-btn" onClick={createRoom}>Create a room <span>↗</span></button><button className="secondary-btn" onClick={() => { setScreen("join"); setError(""); }}>Join a room</button></div>
        {error && <p className="error">{error}</p>}
        <div className="feature-row"><span><Users size={16}/> 2–4 players</span><span><Wifi size={16}/> Real-time play</span><span>✦ Free to play</span></div>
      </div>
      <div className="hero-art"><BoardPreview/><div className="floating-note"><span className="pulse-dot"/> Your next game night starts here</div></div>
    </section>}

    {screen === "join" && <section className="center-panel"><button className="back-link" onClick={backHome}><ArrowLeft size={16}/> Back</button><div className="panel-icon"><Users/></div><h2>Join the fun</h2><p>Enter the room code your friend shared with you.</p><label>Room code</label><input className="code-input" value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 6))} placeholder="e.g. A1B2C3" maxLength={6}/><button className="primary-btn full" onClick={joinRoom}>Join room <span>↗</span></button>{error && <p className="error">{error}</p>}</section>}

    {screen === "lobby" && room && <section className="lobby-wrap"><div className="section-head"><div><div className="eyebrow">GAME LOBBY</div><h2>Waiting for players</h2><p>Invite friends to join your room. The game starts when at least two players are ready.</p></div><div className="room-code"><small>ROOM CODE</small><strong>{room.code}</strong><button onClick={copyInvite}><Copy size={15}/>{copied ? "Copied!" : "Invite link"}</button></div></div><div className="lobby-card"><div className="lobby-card-head"><strong><Users size={18}/> Players <span>{room.players.length}/4</span></strong><span className="waiting-label"><i/> Waiting for players</span></div><div className="player-grid">{room.players.map((p, i) => <PlayerCard key={p.id} player={p} index={i} host={p.id === room.hostId}/>)}{Array.from({length: 4-room.players.length}, (_,i) => <div className="empty-slot" key={i}><span>＋</span><p>Waiting for player</p></div>)}</div><div className="lobby-footer"><span>Share the room code with your friends to invite them.</span><button className="primary-btn" disabled={!isHost || room.players.length < 2} onClick={startGame}>{room.players.length < 2 ? "Waiting for 2 players" : "Start game"} <span>→</span></button></div></div>{error && <p className="error">{error}</p>}</section>}

    {screen === "game" && room?.game && <section className="game-layout">
      <div className="game-top"><div><div className="eyebrow">ROOM {room.code}</div><h2>{room.game.status === "finished" ? "Game complete!" : "Let’s play Ludo"}</h2></div><button className="secondary-btn small" onClick={copyInvite}><Copy size={15}/> {copied ? "Copied" : "Copy invite"}</button></div>
      <div className="game-columns"><div className="board-card"><LudoBoard game={room.game} onMove={moveToken} currentPlayerId={current?.id} myPlayerId={myPlayerId}/></div><aside className="game-sidebar"><div className="turn-card"><small>{room.game.status === "finished" ? "WINNER" : "CURRENT TURN"}</small><div className="turn-person"><span className={`avatar ${room.game.status === "finished" ? room.game.winner.color : current?.color}`}>{(room.game.status === "finished" ? room.game.winner.name : current?.name || "?").slice(0,1).toUpperCase()}</span><div><strong>{room.game.status === "finished" ? room.game.winner.name : current?.name}</strong><span>{room.game.status === "finished" ? "Champion 🏆" : current?.id === myPlayerId ? "Your turn" : "Playing now"}</span></div></div>{room.game.status !== "finished" && <button className="dice-btn" disabled={!myTurn || room.game.dice !== null} onClick={rollDice}><Dice5 size={20}/> Roll dice</button>}{room.game.dice !== null && <div className="dice-result"><span>{room.game.dice}</span><small>Rolled a {room.game.dice}</small></div>}</div>
        <div className="players-card"><h3>Players</h3>{room.game.players.map(p => <div className={`score-row ${p.id === current?.id ? "active" : ""}`} key={p.id}><span className={`mini-dot ${p.color}`}/><span>{p.name}{p.id === myPlayerId ? " (You)" : ""}</span><small>{p.tokens.filter(t => t === 57).length}/4 home</small><span className={p.connected ? "connected" : "disconnected"}>{p.connected ? <Wifi size={14}/> : <WifiOff size={14}/>}</span></div>)}</div>
        <div className="status-card"><span className="status-spark">✦</span><p>{room.game.turnMessage}</p>{room.game.status === "finished" && <button className="secondary-btn full" onClick={backHome}>Back to home</button>}</div>
      </aside></div>
      <p className="game-hint">Roll a 6 to bring a token out. Select one of your highlighted tokens to move. First to bring all four tokens home wins.</p>
      {error && <p className="error">{error}</p>}
    </section>}

    <footer className="footer"><span>© 2026 LudoConnect</span><span>Made for game nights, wherever you are.</span></footer>
    {notice && <div className="toast" onClick={() => setNotice("")}>{notice}</div>}
  </main>;
}

function PlayerCard({ player, index, host }) {
  return <div className="player-slot"><div className={`avatar large ${COLORS[index]}`}>{player.name.slice(0,1).toUpperCase()}</div><strong>{player.name}</strong><span>{host ? <><Crown size={12}/> Host</> : "Joined"} · <i className={player.connected ? "status-online" : "status-offline"}/></span></div>;
}
function BoardPreview() {
  return <div className="preview-board"><div className="preview-grid">{["red","green","blue","yellow"].map(c => <div className={`preview-home ${c}`} key={c}><div className="preview-inner"><i/><i/><i/><i/></div></div>)}<div className="preview-center">✦</div></div><div className="preview-caption"><span className="mini-dot red"/> <span className="mini-dot green"/> <span className="mini-dot yellow"/> <span className="mini-dot blue"/> FOUR COLORS. ONE WINNER.</div></div>;
}

function LudoBoard({ game, onMove, currentPlayerId, myPlayerId }) {
  const path = useMemo(() => TRACK.map(i => {
    // A compact 15x15 perimeter-like track with evenly distributed positions.
    const coords = [];
    for (let x=1; x<=6; x++) coords.push([x,0]);
    for (let y=0; y<=6; y++) coords.push([7,y]);
    for (let x=8; x<=13; x++) coords.push([x,6]);
    for (let y=7; y<=13; y++) coords.push([13,y]);
    for (let x=12; x>=7; x--) coords.push([x,14]);
    for (let y=13; y>=8; y--) coords.push([6,y]);
    for (let x=5; x>=0; x--) coords.push([x,7]);
    for (let y=6; y>=1; y--) coords.push([0,y]);
    return coords[i % coords.length];
  }), []);
  const occupants = {};
  game.players.forEach((p, pi) => p.tokens.forEach((progress, ti) => {
    if (progress >= 0 && progress <= 51) {
      const square = (STARTS[pi] + progress) % 52;
      (occupants[square] ||= []).push({ p, pi, ti });
    }
  }));
  const myIndex = game.players.findIndex(p => p.id === myPlayerId);
  const movable = game.currentTurn === myIndex ? game.legalMoves : [];
  return <div className="board-wrap"><div className="ludo-board">
    {game.players.map((p, pi) => <div className={`home-zone zone-${p.color}`} key={p.id}><div className="home-label">{p.name}</div><div className="home-token-grid">{p.tokens.map((v, ti) => <button key={ti} disabled={!(p.id === myPlayerId && movable.includes(ti))} onClick={() => onMove(ti)} className={`home-token ${p.color} ${v === -1 ? "in-base" : "used"} ${p.id === myPlayerId && movable.includes(ti) && v === -1 ? "movable" : ""}`} title={`Token ${ti+1}`}>{v === -1 ? "●" : "✓"}</button>)}</div></div>)}
    <div className="track-ring">{TRACK.map(i => <div className={`track-cell cell-${i}`} key={i} style={{left:`${path[i][0]/14*100}%`,top:`${path[i][1]/14*100}%`}}><span>{occupants[i]?.map((o,j) => <button key={`${o.pi}-${o.ti}`} disabled={!(o.p.id === myPlayerId && movable.includes(o.ti))} onClick={() => onMove(o.ti)} className={`board-token ${o.p.color} ${o.p.id === myPlayerId && movable.includes(o.ti) ? "movable" : ""}`} title={`${o.p.name}, token ${o.ti+1}`}>{o.ti+1}</button>)}</span></div>)}</div>
    <div className="center-home"><div className="center-diamond"><span className="red"/><span className="green"/><span className="yellow"/><span className="blue"/></div><small>HOME</small></div>
  </div></div>;
}
export default App;
