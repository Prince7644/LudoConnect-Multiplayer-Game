export const COLORS = ["red", "green", "yellow", "blue"];
export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Progress 0..51 is the shared track; 52..57 is the player's private home lane.
export function createGame(players) {
  return {
    status: "playing",
    players: players.map((p, index) => ({
      id: p.id, name: p.name, color: COLORS[index], connected: true,
      tokens: [-1, -1, -1, -1], finished: false
    })),
    currentTurn: 0, dice: null, legalMoves: [], lastMove: null, winner: null,
    turnMessage: "Roll the dice to begin."
  };
}

export function getLegalMoves(game, playerIndex, dice) {
  const player = game.players[playerIndex];
  return player.tokens.map((progress, tokenIndex) => {
    if (progress === -1) return dice === 6 ? tokenIndex : null;
    if (progress >= 57 || progress + dice > 57) return null;
    return tokenIndex;
  }).filter(v => v !== null);
}

function globalSquare(playerIndex, progress) {
  const starts = [0, 13, 26, 39];
  return (starts[playerIndex] + progress) % 52;
}

export function moveToken(game, playerIndex, tokenIndex, dice) {
  const next = structuredClone(game);
  const player = next.players[playerIndex];
  const oldProgress = player.tokens[tokenIndex];
  const newProgress = oldProgress === -1 ? 0 : oldProgress + dice;
  player.tokens[tokenIndex] = newProgress;

  let captured = [];
  if (newProgress >= 0 && newProgress <= 51) {
    const square = globalSquare(playerIndex, newProgress);
    if (!SAFE_SQUARES.has(square)) {
      next.players.forEach((opponent, oi) => {
        if (oi === playerIndex) return;
        opponent.tokens = opponent.tokens.map((progress, ti) => {
          if (progress >= 0 && progress <= 51 && globalSquare(oi, progress) === square) {
            captured.push({ player: opponent.name, token: ti });
            return -1;
          }
          return progress;
        });
      });
    }
  }

  const finishedTokens = player.tokens.filter(v => v === 57).length;
  if (finishedTokens === 4) {
    player.finished = true;
    next.status = "finished";
    next.winner = { id: player.id, name: player.name, color: player.color };
    next.turnMessage = `${player.name} wins the game!`;
  } else {
    const getsExtraTurn = dice === 6 || captured.length > 0;
    if (!getsExtraTurn) next.currentTurn = (playerIndex + 1) % next.players.length;
    next.turnMessage = captured.length
      ? `${player.name} captured ${captured.length} token(s)!`
      : `${player.name} moved a token.`;
  }
  next.dice = null;
  next.legalMoves = [];
  next.lastMove = { playerId: player.id, tokenIndex, from: oldProgress, to: newProgress, captured };
  return next;
}

export function publicGame(game) {
  return game;
}
