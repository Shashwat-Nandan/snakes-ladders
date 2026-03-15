export async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
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

export function fetchState(roomId, playerSecret, version = 0, signal) {
  return api(
    `/api/state?roomId=${encodeURIComponent(roomId)}&playerSecret=${encodeURIComponent(playerSecret)}&version=${version}`,
    { signal }
  );
}

export function rollDice(roomId, playerSecret) {
  return api("/api/roll", {
    method: "POST",
    body: { roomId, playerSecret },
  });
}
