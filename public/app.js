const authForm = document.getElementById("auth-form");
const joinRoomButton = document.getElementById("join-room-button");
const joinFields = document.getElementById("join-fields");
const joinSubmit = document.getElementById("join-submit");
const authError = document.getElementById("auth-error");
const heroSection = document.querySelector(".hero");
const gameSection = document.getElementById("game");
const roomLabel = document.getElementById("room-label");
const shareLinkInput = document.getElementById("share-link");
const copyLinkButton = document.getElementById("copy-link");
const playerList = document.getElementById("player-list");
const turnLabel = document.getElementById("turn-label");
const rollButton = document.getElementById("roll-button");
const rollResult = document.getElementById("roll-result");
const gameLog = document.getElementById("game-log");
const board = document.getElementById("board");
const diceDisplay = document.getElementById("dice-display");
const winnerBanner = document.getElementById("winner-banner");
const winnerName = document.getElementById("winner-name");
const playAgainButton = document.getElementById("play-again");

const tokenColors = ["#c24d2c", "#2f7a45", "#3454d1"];
const DICE_FACES = [
  "",
  "\u2680", // 1
  "\u2681", // 2
  "\u2682", // 3
  "\u2683", // 4
  "\u2684", // 5
  "\u2685", // 6
];

let state = null;
let polling = false;

// Pre-compute cell order (static — never changes)
const CELL_ORDER = (() => {
  const order = [];
  for (let row = 9; row >= 0; row -= 1) {
    const start = row * 10 + 1;
    const values = Array.from({ length: 10 }, (_, index) => start + index);
    if ((9 - row) % 2 === 1) {
      values.reverse();
    }
    order.push(...values);
  }
  return order;
})();

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("snakes-ladders-session") || "null");
  } catch {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem("snakes-ladders-session", JSON.stringify(session));
}

let boardBuilt = false;
let cellElements = [];

function buildBoardOnce(gameState) {
  if (boardBuilt) return;
  board.innerHTML = "";
  cellElements = [];
  for (const square of CELL_ORDER) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.square = square;

    const num = document.createElement("div");
    num.className = "cell-number";
    num.textContent = square;
    cell.appendChild(num);

    const jump = gameState.snakesAndLadders[square];
    if (jump) {
      const jumpLabel = document.createElement("div");
      jumpLabel.className = `cell-jump ${jump > square ? "jump-up" : "jump-down"}`;
      jumpLabel.textContent = `${jump > square ? "\u2191" : "\u2193"} ${jump}`;
      cell.appendChild(jumpLabel);
    }

    const tokens = document.createElement("div");
    tokens.className = "tokens";
    cell.appendChild(tokens);

    board.appendChild(cell);
    cellElements.push({ square, cell, tokens });
  }
  boardBuilt = true;
}

function updateTokens(gameState) {
  // Clear all token containers
  for (const entry of cellElements) {
    entry.tokens.innerHTML = "";
  }

  // Place tokens
  for (let i = 0; i < gameState.players.length; i++) {
    const player = gameState.players[i];
    const entry = cellElements.find((e) => e.square === player.position);
    if (!entry) continue;

    const token = document.createElement("span");
    token.className = "token";
    if (player.isMe) token.classList.add("token-me");
    token.style.background = tokenColors[i % tokenColors.length];
    token.title = player.name;
    token.textContent = player.name.charAt(0).toUpperCase();
    entry.tokens.appendChild(token);
  }
}

function renderPlayers(gameState) {
  playerList.innerHTML = "";
  gameState.players.forEach((player, index) => {
    const item = document.createElement("li");
    if (player.isCurrentTurn) item.classList.add("active-player");

    const chip = document.createElement("span");
    chip.className = "player-chip";
    chip.style.background = tokenColors[index % tokenColors.length];

    const name = document.createElement("strong");
    name.textContent = player.name;

    const info = document.createElement("span");
    info.className = "player-info";
    info.textContent = ` sq ${player.position}${player.isMe ? " (you)" : ""}`;

    item.appendChild(chip);
    item.appendChild(name);
    item.appendChild(info);

    if (player.isCurrentTurn) {
      const badge = document.createElement("span");
      badge.className = "turn-badge";
      badge.textContent = "turn";
      item.appendChild(badge);
    }

    playerList.appendChild(item);
  });
}

function renderLog(gameState) {
  gameLog.innerHTML = "";
  [...gameState.log].reverse().forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    gameLog.appendChild(item);
  });
}

function activePlayer(gameState) {
  return gameState.players.find((player) => player.isCurrentTurn) || null;
}

function render(gameState) {
  state = gameState;
  heroSection.classList.add("hidden");
  gameSection.classList.remove("hidden");
  roomLabel.textContent = gameState.roomId;
  const link = `${window.location.origin}/?room=${encodeURIComponent(gameState.roomId)}`;
  shareLinkInput.value = link;
  renderPlayers(gameState);
  renderLog(gameState);
  buildBoardOnce(gameState);
  updateTokens(gameState);

  const winner = gameState.players.find((player) => player.id === gameState.winnerId) || null;
  if (winner) {
    turnLabel.textContent = "Game over";
    winnerBanner.classList.remove("hidden");
    winnerName.textContent = winner.name;
    rollButton.classList.add("hidden");
  } else {
    winnerBanner.classList.add("hidden");
    rollButton.classList.remove("hidden");
    const current = activePlayer(gameState);
    turnLabel.textContent = current ? `${escapeHtml(current.name)}'s turn` : "Waiting for players";
  }

  rollButton.disabled = !gameState.canRoll;
  if (!gameState.canRoll && !winner) {
    rollResult.textContent = "Waiting for your turn";
  }
}

function animateDice(finalValue) {
  diceDisplay.classList.remove("hidden");
  let ticks = 0;
  const totalTicks = 8;
  const interval = setInterval(() => {
    ticks++;
    diceDisplay.textContent = DICE_FACES[Math.floor(Math.random() * 6) + 1];
    diceDisplay.classList.add("dice-spin");
    if (ticks >= totalTicks) {
      clearInterval(interval);
      diceDisplay.textContent = DICE_FACES[finalValue];
      diceDisplay.classList.remove("dice-spin");
      diceDisplay.classList.add("dice-land");
      setTimeout(() => diceDisplay.classList.remove("dice-land"), 400);
    }
  }, 80);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

async function createRoom(name) {
  return api("/api/rooms", {
    method: "POST",
    body: { name },
  });
}

async function joinRoom(name, roomId) {
  return api("/api/join", {
    method: "POST",
    body: { name, roomId },
  });
}

async function fetchState(version = 0) {
  const session = getSession();
  if (!session) {
    return null;
  }
  return api(
    `/api/state?roomId=${encodeURIComponent(session.roomId)}&playerSecret=${encodeURIComponent(session.playerSecret)}&version=${version}`
  );
}

async function startPolling() {
  if (!state || polling) {
    return;
  }
  polling = true;
  let retries = 0;

  while (polling) {
    try {
      const nextState = await fetchState(state.version);
      if (nextState) {
        render(nextState);
      }
      retries = 0;
    } catch (error) {
      retries++;
      if (retries > 5) {
        authError.textContent = "Lost connection to server.";
        polling = false;
        return;
      }
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, retries - 1), 16000)));
    }
  }
}

async function handleAuth(mode) {
  authError.textContent = "";
  const formData = new FormData(authForm);
  const name = String(formData.get("name") || "").trim();
  const roomId = String(formData.get("roomId") || "").trim().toUpperCase();

  if (!name) {
    authError.textContent = "Enter your name first.";
    return;
  }

  try {
    const result = mode === "create" ? await createRoom(name) : await joinRoom(name, roomId);
    setSession({
      roomId: result.roomId,
      playerSecret: result.me.secret,
    });
    window.history.replaceState({}, "", `/?room=${encodeURIComponent(result.roomId)}`);
    render(result);
    startPolling();
  } catch (error) {
    authError.textContent = error.message;
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleAuth("create");
});

joinRoomButton.addEventListener("click", () => {
  joinFields.classList.toggle("hidden");
});

joinSubmit.addEventListener("click", async () => {
  await handleAuth("join");
});

rollButton.addEventListener("click", async () => {
  const session = getSession();
  if (!session || !state) {
    return;
  }

  rollButton.disabled = true;
  try {
    const result = await api("/api/roll", {
      method: "POST",
      body: {
        roomId: session.roomId,
        playerSecret: session.playerSecret,
      },
    });
    animateDice(result.roll);
    rollResult.textContent = `You rolled ${result.roll}`;
    render(result.state);
  } catch (error) {
    rollResult.textContent = error.message;
  }
});

copyLinkButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    copyLinkButton.textContent = "Copied!";
    setTimeout(() => {
      copyLinkButton.textContent = "Copy";
    }, 1200);
  } catch {
    copyLinkButton.textContent = "Failed";
  }
});

playAgainButton.addEventListener("click", () => {
  localStorage.removeItem("snakes-ladders-session");
  boardBuilt = false;
  cellElements = [];
  state = null;
  polling = false;
  winnerBanner.classList.add("hidden");
  gameSection.classList.add("hidden");
  heroSection.classList.remove("hidden");
  diceDisplay.classList.add("hidden");
  rollResult.textContent = "Roll pending";
  window.history.replaceState({}, "", "/");
});

async function bootFromSession() {
  const session = getSession();
  const roomFromUrl = new URL(window.location.href).searchParams.get("room");
  if (roomFromUrl) {
    document.getElementById("room-id").value = roomFromUrl.toUpperCase();
    joinFields.classList.remove("hidden");
  }
  if (!session || (roomFromUrl && session.roomId !== roomFromUrl.toUpperCase())) {
    return;
  }
  try {
    const gameState = await fetchState();
    if (gameState) {
      render(gameState);
      startPolling();
    }
  } catch {
    localStorage.removeItem("snakes-ladders-session");
  }
}

bootFromSession();
