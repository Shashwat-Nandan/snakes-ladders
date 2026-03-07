/* ═══════════════════════════════════════════
   SNAKES & LADDERS — Client
   ═══════════════════════════════════════════ */

const PLAYER_COLORS = ["#ef4444", "#22c55e", "#3b82f6"];
const DICE_DOTS = ["", "\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"];

// Boustrophedon cell order: row 10 at top, row 1 at bottom, snaking
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

/* ── DOM ───────────────────────────────── */

const dom = {
  lobby: document.getElementById("lobby"),
  authForm: document.getElementById("auth-form"),
  joinSubmit: document.getElementById("join-submit"),
  authError: document.getElementById("auth-error"),
  game: document.getElementById("game"),
  roomLabel: document.getElementById("room-label"),
  shareLink: document.getElementById("share-link"),
  copyLink: document.getElementById("copy-link"),
  playerList: document.getElementById("player-list"),
  turnLabel: document.getElementById("turn-label"),
  rollButton: document.getElementById("roll-button"),
  rollResult: document.getElementById("roll-result"),
  board: document.getElementById("board"),
  diceVisual: document.getElementById("dice-visual"),
  winnerBanner: document.getElementById("winner-banner"),
  winnerName: document.getElementById("winner-name"),
  playAgain: document.getElementById("play-again"),
};

/* ── State ─────────────────────────────── */

let state = null;
let polling = false;
let boardBuilt = false;
let cellMap = new Map();

/* ── Session ───────────────────────────── */

function getSession() {
  try { return JSON.parse(localStorage.getItem("snl-session") || "null"); }
  catch { return null; }
}

function setSession(s) {
  localStorage.setItem("snl-session", JSON.stringify(s));
}

/* ── API ───────────────────────────────── */

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ── Board ─────────────────────────────── */

function buildBoard(gs) {
  if (boardBuilt) return;
  dom.board.innerHTML = "";
  cellMap = new Map();

  CELL_ORDER.forEach((sq, idx) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    const row = Math.floor(idx / 10);
    const col = idx % 10;
    cell.classList.add((row + col) % 2 === 0 ? "cell-even" : "cell-odd");

    const jump = gs.snakesAndLadders[sq];
    if (jump) {
      cell.classList.add(jump > sq ? "cell-ladder" : "cell-snake");
    }
    if (sq === gs.boardSize) {
      cell.classList.add("cell-finish");
    }

    const num = document.createElement("span");
    num.className = "cell-number";
    num.textContent = sq;
    cell.appendChild(num);

    if (jump) {
      const tag = document.createElement("span");
      tag.className = "cell-jump " + (jump > sq ? "is-ladder" : "is-snake");
      tag.textContent = (jump > sq ? "\u2191" : "\u2193") + jump;
      cell.appendChild(tag);
    }

    const tokens = document.createElement("div");
    tokens.className = "tokens";
    cell.appendChild(tokens);

    dom.board.appendChild(cell);
    cellMap.set(sq, { cell, tokens });
  });

  boardBuilt = true;
}

function updateTokens(gs) {
  for (const [, entry] of cellMap) entry.tokens.innerHTML = "";

  gs.players.forEach((p, i) => {
    const entry = cellMap.get(p.position);
    if (!entry) return;

    const tok = document.createElement("span");
    tok.className = "token";
    if (p.isMe) tok.classList.add("token-me");
    tok.style.background = PLAYER_COLORS[i % PLAYER_COLORS.length];
    tok.title = p.name;
    tok.textContent = p.name.charAt(0).toUpperCase();
    entry.tokens.appendChild(tok);
  });
}

/* ── Players ───────────────────────────── */

function renderPlayers(gs) {
  dom.playerList.innerHTML = "";
  gs.players.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "player-item" + (p.isCurrentTurn ? " is-active" : "");

    const dot = document.createElement("div");
    dot.className = "player-dot";
    dot.style.background = PLAYER_COLORS[i % PLAYER_COLORS.length];
    dot.textContent = p.name.charAt(0).toUpperCase();

    const info = document.createElement("div");
    info.className = "player-info";

    const nameRow = document.createElement("div");
    nameRow.className = "player-name";
    nameRow.textContent = p.name;
    if (p.isMe) {
      const you = document.createElement("span");
      you.className = "player-you-tag";
      you.textContent = "you";
      nameRow.appendChild(you);
    }

    const sq = document.createElement("div");
    sq.className = "player-square";
    sq.textContent = "Square " + p.position;

    info.appendChild(nameRow);
    info.appendChild(sq);
    li.appendChild(dot);
    li.appendChild(info);

    if (p.isCurrentTurn) {
      const badge = document.createElement("span");
      badge.className = "player-turn-tag";
      badge.textContent = "turn";
      li.appendChild(badge);
    }

    dom.playerList.appendChild(li);
  });
}

/* ── Log ───────────────────────────────── */

function renderLog(gs) {
  dom.gameLog = dom.gameLog || document.getElementById("game-log");
  dom.gameLog.innerHTML = "";
  [...gs.log].reverse().forEach((msg) => {
    const li = document.createElement("li");
    li.textContent = msg;
    dom.gameLog.appendChild(li);
  });
}

/* ── Dice ──────────────────────────────── */

function animateDice(value) {
  const el = dom.diceVisual;
  el.classList.remove("is-landed");
  el.classList.add("is-rolling");
  el.textContent = "?";

  let ticks = 0;
  const total = 10;
  const iv = setInterval(() => {
    ticks++;
    el.textContent = DICE_DOTS[Math.floor(Math.random() * 6) + 1];
    if (ticks >= total) {
      clearInterval(iv);
      el.classList.remove("is-rolling");
      el.classList.add("is-landed");
      el.textContent = DICE_DOTS[value];
    }
  }, 70);
}

/* ── Render ─────────────────────────────── */

function render(gs) {
  state = gs;
  dom.lobby.classList.add("hidden");
  dom.game.classList.remove("hidden");

  dom.roomLabel.textContent = gs.roomId;
  dom.shareLink.value = location.origin + "/?room=" + encodeURIComponent(gs.roomId);

  renderPlayers(gs);
  renderLog(gs);
  buildBoard(gs);
  updateTokens(gs);

  const winner = gs.players.find((p) => p.id === gs.winnerId);
  if (winner) {
    dom.turnLabel.textContent = "Game Over";
    dom.winnerBanner.classList.remove("hidden");
    dom.winnerName.textContent = winner.name;
    dom.rollButton.classList.add("hidden");
  } else {
    dom.winnerBanner.classList.add("hidden");
    dom.rollButton.classList.remove("hidden");
    const cur = gs.players.find((p) => p.isCurrentTurn);
    dom.turnLabel.textContent = cur ? cur.name + "'s turn" : "Waiting for players...";
  }

  dom.rollButton.disabled = !gs.canRoll;
  if (gs.canRoll) {
    dom.rollResult.textContent = "Your move!";
  } else if (!winner) {
    dom.rollResult.textContent = "Waiting for your turn";
  }
}

/* ── Polling ───────────────────────────── */

async function fetchState(version = 0) {
  const s = getSession();
  if (!s) return null;
  return api("/api/state?roomId=" + encodeURIComponent(s.roomId)
    + "&playerSecret=" + encodeURIComponent(s.playerSecret)
    + "&version=" + version);
}

async function startPolling() {
  if (!state || polling) return;
  polling = true;
  let retries = 0;

  while (polling) {
    try {
      const gs = await fetchState(state.version);
      if (gs) render(gs);
      retries = 0;
    } catch {
      retries++;
      if (retries > 5) {
        dom.authError.textContent = "Lost connection to server.";
        polling = false;
        return;
      }
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (retries - 1), 16000)));
    }
  }
}

/* ── Auth ──────────────────────────────── */

async function handleAuth(mode) {
  dom.authError.textContent = "";
  const fd = new FormData(dom.authForm);
  const name = String(fd.get("name") || "").trim();
  const roomId = String(fd.get("roomId") || "").trim().toUpperCase();

  if (!name) { dom.authError.textContent = "Please enter your name."; return; }
  if (mode === "join" && !roomId) { dom.authError.textContent = "Please enter a room code."; return; }

  try {
    const result = mode === "create"
      ? await api("/api/rooms", { method: "POST", body: { name } })
      : await api("/api/join", { method: "POST", body: { name, roomId } });

    setSession({ roomId: result.roomId, playerSecret: result.me.secret });
    history.replaceState({}, "", "/?room=" + encodeURIComponent(result.roomId));
    render(result);
    startPolling();
  } catch (err) {
    dom.authError.textContent = err.message;
  }
}

/* ── Events ────────────────────────────── */

dom.authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleAuth("create");
});

dom.joinSubmit.addEventListener("click", () => handleAuth("join"));

dom.rollButton.addEventListener("click", async () => {
  const s = getSession();
  if (!s || !state) return;
  dom.rollButton.disabled = true;

  try {
    const result = await api("/api/roll", {
      method: "POST",
      body: { roomId: s.roomId, playerSecret: s.playerSecret },
    });
    animateDice(result.roll);
    dom.rollResult.textContent = "You rolled " + result.roll;
    setTimeout(() => render(result.state), 750);
  } catch (err) {
    dom.rollResult.textContent = err.message;
    dom.rollButton.disabled = false;
  }
});

dom.copyLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(dom.shareLink.value);
    dom.copyLink.textContent = "Copied!";
    setTimeout(() => (dom.copyLink.textContent = "Copy"), 1500);
  } catch {
    dom.copyLink.textContent = "Failed";
  }
});

dom.playAgain.addEventListener("click", () => {
  localStorage.removeItem("snl-session");
  boardBuilt = false;
  cellMap = new Map();
  state = null;
  polling = false;
  dom.winnerBanner.classList.add("hidden");
  dom.game.classList.add("hidden");
  dom.lobby.classList.remove("hidden");
  dom.diceVisual.textContent = "?";
  dom.diceVisual.classList.remove("is-rolling", "is-landed");
  dom.rollResult.textContent = "";
  history.replaceState({}, "", "/");
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
    if (gs) { render(gs); startPolling(); }
  } catch {
    localStorage.removeItem("snl-session");
  }
})();
