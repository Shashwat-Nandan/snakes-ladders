/* ============================================
   SNAKES & LADDERS — Client
   ============================================ */

const PLAYER_COLORS = ["#b5432a", "#2d6b3f", "#2a4f8f"];

const DICE_ROTATIONS = {
  1: "rotateX(0deg)   rotateY(0deg)",
  2: "rotateX(0deg)   rotateY(180deg)",
  3: "rotateX(0deg)   rotateY(-90deg)",
  4: "rotateX(0deg)   rotateY(90deg)",
  5: "rotateX(-90deg) rotateY(0deg)",
  6: "rotateX(90deg)  rotateY(0deg)",
};

// Pre-compute boustrophedon cell order (row 10 at top, row 1 at bottom, snaking)
const CELL_ORDER = (() => {
  const order = [];
  for (let row = 9; row >= 0; row--) {
    const start = row * 10 + 1;
    const cells = Array.from({ length: 10 }, (_, i) => start + i);
    if ((9 - row) % 2 === 1) cells.reverse();
    order.push(...cells);
  }
  return order;
})();

/* ── DOM refs ──────────────────────────── */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const lobbySection = $("#lobby");
const authForm = $("#auth-form");
const joinSubmit = $("#join-submit");
const authError = $("#auth-error");

const gameSection = $("#game");
const roomLabel = $("#room-label");
const shareLinkInput = $("#share-link");
const copyLinkBtn = $("#copy-link");
const playerList = $("#player-list");
const turnLabel = $("#turn-label");
const rollButton = $("#roll-button");
const rollResult = $("#roll-result");
const gameLog = $("#game-log");
const board = $("#board");
const boardCanvas = $("#board-canvas");
const dice = $("#dice");
const winnerBanner = $("#winner-banner");
const winnerName = $("#winner-name");
const playAgainBtn = $("#play-again");

/* ── State ─────────────────────────────── */

let state = null;
let polling = false;
let boardBuilt = false;
let cellMap = new Map(); // square -> { cell, tokens }

/* ── Session ───────────────────────────── */

function getSession() {
  try { return JSON.parse(localStorage.getItem("snakes-ladders-session") || "null"); }
  catch { return null; }
}

function setSession(s) {
  localStorage.setItem("snakes-ladders-session", JSON.stringify(s));
}

/* ── API ───────────────────────────────── */

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ── Board rendering ───────────────────── */

function buildBoard(gameState) {
  if (boardBuilt) return;
  board.innerHTML = "";
  cellMap = new Map();

  CELL_ORDER.forEach((sq, idx) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    // Checkerboard pattern
    const row = Math.floor(idx / 10);
    const col = idx % 10;
    cell.classList.add((row + col) % 2 === 0 ? "cell-light" : "cell-dark");

    // Snake/ladder highlight
    const jump = gameState.snakesAndLadders[sq];
    if (jump) {
      cell.classList.add(jump > sq ? "cell-ladder" : "cell-snake");
    }

    const num = document.createElement("div");
    num.className = "cell-number";
    num.textContent = sq;
    cell.appendChild(num);

    if (jump) {
      const ind = document.createElement("div");
      ind.className = `cell-indicator ${jump > sq ? "ladder-ind" : "snake-ind"}`;
      ind.textContent = jump > sq ? `\u2191${jump}` : `\u2193${jump}`;
      cell.appendChild(ind);
    }

    const tokens = document.createElement("div");
    tokens.className = "tokens";
    cell.appendChild(tokens);

    board.appendChild(cell);
    cellMap.set(sq, { cell, tokens });
  });

  boardBuilt = true;
  drawConnections(gameState);
}

function drawConnections(gameState) {
  const frame = boardCanvas.parentElement;
  const w = frame.clientWidth - 16; // account for padding
  const h = frame.clientHeight - 16;
  boardCanvas.width = w * devicePixelRatio;
  boardCanvas.height = h * devicePixelRatio;
  boardCanvas.style.width = w + "px";
  boardCanvas.style.height = h + "px";

  const ctx = boardCanvas.getContext("2d");
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, w, h);

  const cellW = w / 10;
  const cellH = h / 10;

  function cellCenter(sq) {
    const idx = CELL_ORDER.indexOf(sq);
    const row = Math.floor(idx / 10);
    const col = idx % 10;
    return { x: col * cellW + cellW / 2, y: row * cellH + cellH / 2 };
  }

  const snakesAndLadders = gameState.snakesAndLadders;

  for (const [fromStr, to] of Object.entries(snakesAndLadders)) {
    const from = Number(fromStr);
    const isLadder = to > from;
    const a = cellCenter(from);
    const b = cellCenter(to);

    ctx.save();
    ctx.lineWidth = isLadder ? 3 : 4;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.2;

    if (isLadder) {
      // Ladder: two parallel lines
      ctx.strokeStyle = "#2d6b3f";
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = (-dy / len) * 5;
      const ny = (dx / len) * 5;

      ctx.beginPath();
      ctx.moveTo(a.x + nx, a.y + ny);
      ctx.lineTo(b.x + nx, b.y + ny);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(a.x - nx, a.y - ny);
      ctx.lineTo(b.x - nx, b.y - ny);
      ctx.stroke();

      // Rungs
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.12;
      const steps = Math.max(3, Math.floor(len / 25));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const mx = a.x + dx * t;
        const my = a.y + dy * t;
        ctx.beginPath();
        ctx.moveTo(mx + nx * 1.2, my + ny * 1.2);
        ctx.lineTo(mx - nx * 1.2, my - ny * 1.2);
        ctx.stroke();
      }
    } else {
      // Snake: curved line
      ctx.strokeStyle = "#b5432a";
      const midX = (a.x + b.x) / 2 + (Math.random() - 0.5) * cellW * 1.5;
      const midY = (a.y + b.y) / 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(midX, midY, b.x, b.y);
      ctx.stroke();

      // Snake head dot
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#b5432a";
      ctx.beginPath();
      ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function updateTokens(gameState) {
  for (const [, entry] of cellMap) {
    entry.tokens.innerHTML = "";
  }

  gameState.players.forEach((player, i) => {
    const entry = cellMap.get(player.position);
    if (!entry) return;

    const tok = document.createElement("span");
    tok.className = "token";
    if (player.isMe) tok.classList.add("token-me");
    tok.style.background = PLAYER_COLORS[i % PLAYER_COLORS.length];
    tok.title = player.name;
    tok.textContent = player.name.charAt(0).toUpperCase();

    // Bounce animation on position change
    tok.classList.add("token-bounce");

    entry.tokens.appendChild(tok);
  });
}

/* ── Players ───────────────────────────── */

function renderPlayers(gameState) {
  playerList.innerHTML = "";
  gameState.players.forEach((player, i) => {
    const li = document.createElement("li");
    li.className = "player-item";
    if (player.isCurrentTurn) li.classList.add("active");

    const dot = document.createElement("div");
    dot.className = "player-token-dot";
    dot.style.background = PLAYER_COLORS[i % PLAYER_COLORS.length];
    dot.textContent = player.name.charAt(0).toUpperCase();

    const details = document.createElement("div");
    details.className = "player-details";

    const nameEl = document.createElement("span");
    nameEl.className = "player-name";
    nameEl.textContent = player.name;

    if (player.isMe) {
      const you = document.createElement("span");
      you.className = "player-you";
      you.textContent = "you";
      nameEl.appendChild(you);
    }

    const pos = document.createElement("div");
    pos.className = "player-pos";
    pos.textContent = `Square ${player.position}`;

    details.appendChild(nameEl);
    details.appendChild(pos);

    li.appendChild(dot);
    li.appendChild(details);

    if (player.isCurrentTurn) {
      const badge = document.createElement("span");
      badge.className = "player-turn-badge";
      badge.textContent = "rolling";
      li.appendChild(badge);
    }

    playerList.appendChild(li);
  });
}

/* ── Log ───────────────────────────────── */

function renderLog(gameState) {
  gameLog.innerHTML = "";
  [...gameState.log].reverse().forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    gameLog.appendChild(li);
  });
}

/* ── Dice ──────────────────────────────── */

function animateDice(value) {
  dice.classList.add("rolling");
  dice.style.transform = "";

  setTimeout(() => {
    dice.classList.remove("rolling");
    dice.style.transform = DICE_ROTATIONS[value];
  }, 600);
}

/* ── Main render ───────────────────────── */

function render(gameState) {
  state = gameState;
  lobbySection.classList.add("hidden");
  gameSection.classList.remove("hidden");

  roomLabel.textContent = gameState.roomId;
  shareLinkInput.value = `${location.origin}/?room=${encodeURIComponent(gameState.roomId)}`;

  renderPlayers(gameState);
  renderLog(gameState);
  buildBoard(gameState);
  updateTokens(gameState);

  const winner = gameState.players.find((p) => p.id === gameState.winnerId);
  if (winner) {
    turnLabel.textContent = "Game Over";
    winnerBanner.classList.remove("hidden");
    winnerName.textContent = winner.name;
    rollButton.classList.add("hidden");
  } else {
    winnerBanner.classList.add("hidden");
    rollButton.classList.remove("hidden");
    const current = gameState.players.find((p) => p.isCurrentTurn);
    turnLabel.textContent = current ? `${current.name}'s turn` : "Waiting for players";
  }

  rollButton.disabled = !gameState.canRoll;
  if (!gameState.canRoll && !winner) {
    rollResult.textContent = "Waiting for your turn";
  } else if (gameState.canRoll) {
    rollResult.textContent = "Your move!";
  }
}

/* ── Polling ───────────────────────────── */

async function fetchState(version = 0) {
  const session = getSession();
  if (!session) return null;
  return api(
    `/api/state?roomId=${encodeURIComponent(session.roomId)}&playerSecret=${encodeURIComponent(session.playerSecret)}&version=${version}`
  );
}

async function startPolling() {
  if (!state || polling) return;
  polling = true;
  let retries = 0;

  while (polling) {
    try {
      const next = await fetchState(state.version);
      if (next) render(next);
      retries = 0;
    } catch {
      retries++;
      if (retries > 5) {
        authError.textContent = "Lost connection to server.";
        polling = false;
        return;
      }
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (retries - 1), 16000)));
    }
  }
}

/* ── Auth ──────────────────────────────── */

async function handleAuth(mode) {
  authError.textContent = "";
  const fd = new FormData(authForm);
  const name = String(fd.get("name") || "").trim();
  const roomId = String(fd.get("roomId") || "").trim().toUpperCase();

  if (!name) {
    authError.textContent = "Please enter your name.";
    return;
  }

  if (mode === "join" && !roomId) {
    authError.textContent = "Please enter a room code.";
    return;
  }

  try {
    const result = mode === "create"
      ? await api("/api/rooms", { method: "POST", body: { name } })
      : await api("/api/join", { method: "POST", body: { name, roomId } });

    setSession({ roomId: result.roomId, playerSecret: result.me.secret });
    history.replaceState({}, "", `/?room=${encodeURIComponent(result.roomId)}`);
    render(result);
    startPolling();
  } catch (err) {
    authError.textContent = err.message;
  }
}

/* ── Event Listeners ───────────────────── */

authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleAuth("create");
});

joinSubmit.addEventListener("click", () => handleAuth("join"));

rollButton.addEventListener("click", async () => {
  const session = getSession();
  if (!session || !state) return;

  rollButton.disabled = true;
  try {
    const result = await api("/api/roll", {
      method: "POST",
      body: { roomId: session.roomId, playerSecret: session.playerSecret },
    });
    animateDice(result.roll);
    rollResult.textContent = `You rolled ${result.roll}`;
    // Delay render to let dice animation finish
    setTimeout(() => render(result.state), 650);
  } catch (err) {
    rollResult.textContent = err.message;
    rollButton.disabled = false;
  }
});

copyLinkBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    copyLinkBtn.textContent = "Copied!";
    setTimeout(() => (copyLinkBtn.textContent = "Copy Link"), 1500);
  } catch {
    copyLinkBtn.textContent = "Failed";
  }
});

playAgainBtn.addEventListener("click", () => {
  localStorage.removeItem("snakes-ladders-session");
  boardBuilt = false;
  cellMap = new Map();
  state = null;
  polling = false;
  winnerBanner.classList.add("hidden");
  gameSection.classList.add("hidden");
  lobbySection.classList.remove("hidden");
  rollResult.textContent = "Waiting for game to start";
  dice.style.transform = DICE_ROTATIONS[1];
  history.replaceState({}, "", "/");
});

// Redraw canvas on resize
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state && boardBuilt) drawConnections(state);
  }, 200);
});

/* ── Boot ──────────────────────────────── */

(async function boot() {
  const session = getSession();
  const roomFromUrl = new URL(location.href).searchParams.get("room");

  if (roomFromUrl) {
    document.getElementById("room-id").value = roomFromUrl.toUpperCase();
  }

  if (!session || (roomFromUrl && session.roomId !== roomFromUrl.toUpperCase())) return;

  try {
    const gs = await fetchState();
    if (gs) {
      render(gs);
      startPolling();
    }
  } catch {
    localStorage.removeItem("snakes-ladders-session");
  }
})();
