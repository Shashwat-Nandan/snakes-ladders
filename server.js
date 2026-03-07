const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_PLAYERS = 3;
const POLL_TIMEOUT_MS = 25000;
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const BOARD_SIZE = 100;
const SNAKES_AND_LADDERS = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
};

const rooms = new Map();

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function randomId(length) {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

function createRoom() {
  let roomId = randomId(6).toUpperCase();
  while (rooms.has(roomId)) {
    roomId = randomId(6).toUpperCase();
  }
  const room = {
    id: roomId,
    players: [],
    currentTurn: 0,
    winnerId: null,
    log: ["Room created. Share the link so other players can join."],
    version: 1,
    watchers: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  rooms.set(roomId, room);
  return room;
}

function createPlayer(name) {
  return {
    id: randomId(10),
    secret: randomId(24),
    name: String(name || "Player").trim().slice(0, 20) || "Player",
    position: 1,
    finishedAt: null,
  };
}

function touchRoom(room) {
  room.updatedAt = Date.now();
  room.version += 1;
  const watchers = room.watchers.splice(0, room.watchers.length);
  for (const watcher of watchers) {
    clearTimeout(watcher.timeoutId);
    json(watcher.res, 200, buildState(room, watcher.playerSecret));
  }
}

function cleanupRooms() {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [roomId, room] of rooms.entries()) {
    if (room.updatedAt >= cutoff) {
      continue;
    }
    for (const watcher of room.watchers) {
      clearTimeout(watcher.timeoutId);
      json(watcher.res, 410, { error: "Room expired" });
    }
    rooms.delete(roomId);
  }
}

function buildState(room, playerSecret) {
  const me = room.players.find((player) => player.secret === playerSecret) || null;
  return {
    roomId: room.id,
    boardSize: BOARD_SIZE,
    snakesAndLadders: SNAKES_AND_LADDERS,
    players: room.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      isCurrentTurn: room.players.length > 0 && room.currentTurn === index && !room.winnerId,
      isMe: Boolean(me && me.id === player.id),
    })),
    me: me
      ? {
          id: me.id,
          name: me.name,
          secret: me.secret,
        }
      : null,
    winnerId: room.winnerId,
    log: room.log.slice(-10),
    canRoll: Boolean(
      me &&
        !room.winnerId &&
        room.players[room.currentTurn] &&
        room.players[room.currentTurn].id === me.id
    ),
    version: room.version,
  };
}

function getRoom(roomId) {
  return rooms.get(String(roomId || "").toUpperCase()) || null;
}

function getAuthedPlayer(room, playerSecret) {
  if (!room || !playerSecret) {
    return null;
  }
  return room.players.find((player) => player.secret === playerSecret) || null;
}

function addLog(room, message) {
  room.log.push(message);
  if (room.log.length > 40) {
    room.log.shift();
  }
}

function nextTurn(room) {
  if (room.players.length === 0 || room.winnerId) {
    return;
  }
  room.currentTurn = (room.currentTurn + 1) % room.players.length;
}

function movePlayer(room, player, roll) {
  const start = player.position;
  const tentative = start + roll;
  let destination = tentative;

  if (tentative > BOARD_SIZE) {
    destination = start;
    addLog(room, `${player.name} rolled ${roll} but needs an exact finish.`);
    return;
  }

  if (SNAKES_AND_LADDERS[destination]) {
    const mapped = SNAKES_AND_LADDERS[destination];
    const isLadder = mapped > destination;
    addLog(
      room,
      `${player.name} rolled ${roll} and landed on ${destination}, then ${isLadder ? "climbed" : "slid"} to ${mapped}.`
    );
    destination = mapped;
  } else {
    addLog(room, `${player.name} rolled ${roll} and moved to ${destination}.`);
  }

  player.position = destination;

  if (destination === BOARD_SIZE) {
    room.winnerId = player.id;
    player.finishedAt = Date.now();
    addLog(room, `${player.name} wins the game.`);
  }
}

function serveFile(req, res, pathname) {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      json(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath);
    const mimeType =
      {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
      }[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": mimeType,
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

setInterval(cleanupRooms, 60_000);

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/api/rooms" && req.method === "POST") {
      const body = await readBody(req);
      const room = createRoom();
      const player = createPlayer(body.name);
      room.players.push(player);
      addLog(room, `${player.name} joined the room.`);
      touchRoom(room);
      json(res, 201, buildState(room, player.secret));
      return;
    }

    if (pathname === "/api/join" && req.method === "POST") {
      const body = await readBody(req);
      const room = getRoom(body.roomId);
      if (!room) {
        json(res, 404, { error: "Room not found" });
        return;
      }
      if (room.players.length >= MAX_PLAYERS) {
        json(res, 409, { error: "Room already has 3 players" });
        return;
      }
      if (room.winnerId) {
        json(res, 409, { error: "Game already finished" });
        return;
      }
      const player = createPlayer(body.name);
      room.players.push(player);
      addLog(room, `${player.name} joined the room.`);
      touchRoom(room);
      json(res, 200, buildState(room, player.secret));
      return;
    }

    if (pathname === "/api/state" && req.method === "GET") {
      const room = getRoom(url.searchParams.get("roomId"));
      const playerSecret = url.searchParams.get("playerSecret");
      const knownVersion = Number(url.searchParams.get("version") || "0");
      if (!room) {
        json(res, 404, { error: "Room not found" });
        return;
      }

      if (room.version > knownVersion) {
        json(res, 200, buildState(room, playerSecret));
        return;
      }

      const watcher = { res, playerSecret, timeoutId: null };
      watcher.timeoutId = setTimeout(() => {
        room.watchers = room.watchers.filter((entry) => entry !== watcher);
        json(res, 200, buildState(room, playerSecret));
      }, POLL_TIMEOUT_MS);

      room.watchers.push(watcher);
      req.on("close", () => {
        room.watchers = room.watchers.filter((entry) => entry !== watcher);
        clearTimeout(watcher.timeoutId);
      });
      return;
    }

    if (pathname === "/api/roll" && req.method === "POST") {
      const body = await readBody(req);
      const room = getRoom(body.roomId);
      if (!room) {
        json(res, 404, { error: "Room not found" });
        return;
      }

      const player = getAuthedPlayer(room, body.playerSecret);
      if (!player) {
        json(res, 403, { error: "Unauthorized player" });
        return;
      }
      if (room.winnerId) {
        json(res, 409, { error: "Game already finished" });
        return;
      }
      const currentPlayer = room.players[room.currentTurn];
      if (!currentPlayer || currentPlayer.id !== player.id) {
        json(res, 409, { error: "Not your turn" });
        return;
      }

      const roll = crypto.randomInt(1, 7);
      movePlayer(room, player, roll);
      if (!room.winnerId) {
        nextTurn(room);
      }
      touchRoom(room);
      json(res, 200, { roll, state: buildState(room, player.secret) });
      return;
    }

    serveFile(req, res, pathname);
  } catch (error) {
    json(res, 400, { error: error.message || "Request failed" });
  }
}

// Vercel serverless export
module.exports = handler;

// Local development: start HTTP server
if (require.main === module) {
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`Snakes and Ladders server listening on http://localhost:${PORT}`);
  });
}
