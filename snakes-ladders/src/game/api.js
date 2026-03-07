export async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

export function createRoom(name) {
  return api("/api/rooms", {
    method: "POST",
    body: { name },
  });
}

export function joinRoom(name, roomId) {
  return api("/api/join", {
    method: "POST",
    body: { name, roomId },
  });
}

export function fetchState(roomId, playerSecret, version = 0) {
  return api(
    `/api/state?roomId=${encodeURIComponent(roomId)}&playerSecret=${encodeURIComponent(playerSecret)}&version=${version}`
  );
}

export function rollDice(roomId, playerSecret) {
  return api("/api/roll", {
    method: "POST",
    body: { roomId, playerSecret },
  });
}
