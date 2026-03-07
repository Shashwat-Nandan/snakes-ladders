const authForm = document.getElementById("auth-form");
const joinRoomButton = document.getElementById("join-room-button");
const joinFields = document.getElementById("join-fields");
const joinSubmit = document.getElementById("join-submit");
const authError = document.getElementById("auth-error");
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

const tokenColors = ["#c24d2c", "#2f7a45", "#3454d1"];

let state = null;
let polling = false;

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

function cellOrder() {
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
}

function renderBoard(gameState) {
  board.innerHTML = "";
  const cells = cellOrder();
  for (const square of cells) {
    const cell = document.createElement("div");
    cell.className = "cell";
    const jump = gameState.snakesAndLadders[square];
    const playersHere = gameState.players
      .map((player, index) => ({ ...player, color: tokenColors[index % tokenColors.length] }))
      .filter((player) => player.position === square);

    const num = document.createElement("div");
    num.className = "cell-number";
    num.textContent = square;
    cell.appendChild(num);

    if (jump) {
      const jumpLabel = document.createElement("div");
      jumpLabel.className = `cell-jump ${jump > square ? "jump-up" : "jump-down"}`;
      jumpLabel.textContent = `${jump > square ? "L" : "S"} ${jump}`;
      cell.appendChild(jumpLabel);
    }

    const tokens = document.createElement("div");
    tokens.className = "tokens";
    playersHere.forEach((player) => {
      const token = document.createElement("span");
      token.className = "token";
      token.style.background = player.color;
      token.title = player.name;
      tokens.appendChild(token);
    });
    cell.appendChild(tokens);
    board.appendChild(cell);
  }
}

function renderPlayers(gameState) {
  playerList.innerHTML = "";
  gameState.players.forEach((player, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="player-chip" style="background:${tokenColors[index % tokenColors.length]}"></span>
      <strong>${player.name}</strong> • square ${player.position}${player.isMe ? " • you" : ""}${player.isCurrentTurn ? " • turn" : ""}
    `;
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
  gameSection.classList.remove("hidden");
  roomLabel.textContent = gameState.roomId;
  const link = `${window.location.origin}/?room=${encodeURIComponent(gameState.roomId)}`;
  shareLinkInput.value = link;
  renderPlayers(gameState);
  renderLog(gameState);
  renderBoard(gameState);

  const winner = gameState.players.find((player) => player.id === gameState.winnerId) || null;
  if (winner) {
    turnLabel.textContent = `${winner.name} won`;
  } else {
    const current = activePlayer(gameState);
    turnLabel.textContent = current ? `${current.name}'s turn` : "Waiting for players";
  }

  rollButton.disabled = !gameState.canRoll;
  rollResult.textContent = gameState.canRoll ? "Your move" : "Waiting for your turn";
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

  while (true) {
    try {
      const nextState = await fetchState(state.version);
      if (nextState) {
        render(nextState);
      }
    } catch (error) {
      authError.textContent = error.message;
      polling = false;
      return;
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
    rollResult.textContent = `You rolled ${result.roll}`;
    render(result.state);
  } catch (error) {
    rollResult.textContent = error.message;
  }
});

copyLinkButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    copyLinkButton.textContent = "Copied";
    setTimeout(() => {
      copyLinkButton.textContent = "Copy";
    }, 1200);
  } catch {
    copyLinkButton.textContent = "Failed";
  }
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
