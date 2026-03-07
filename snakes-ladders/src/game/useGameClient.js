import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { createRoom, fetchState, joinRoom, rollDice } from "./api";
import { clearStoredSession, getStoredSession, setStoredSession } from "./session";

export function useGameClient() {
  const navigate = useNavigate({ from: "/" });
  const search = useSearch({ from: "/" });
  const [gameState, setGameState] = useState(null);
  const [authError, setAuthError] = useState("");
  const [rollFeedback, setRollFeedback] = useState("Roll to begin.");
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const pollStateRef = useRef({
    active: false,
    session: null,
    version: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const roomFromUrl = search.room || "";
    const session = getStoredSession();

    if (!session || (roomFromUrl && session.roomId !== roomFromUrl)) {
      pollStateRef.current.session = null;
      setBooting(false);
      return;
    }

    pollStateRef.current.session = session;

    async function boot() {
      try {
        const nextState = await fetchState(session.roomId, session.playerSecret, 0);
        if (cancelled) {
          return;
        }
        setGameState(nextState);
        pollStateRef.current.version = nextState.version;
        navigate({
          search: (prev) => ({ ...prev, room: nextState.roomId }),
          replace: true,
        });
      } catch {
        clearStoredSession();
        pollStateRef.current.session = null;
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [navigate, search.room]);

  useEffect(() => {
    if (!gameState) {
      return undefined;
    }

    let cancelled = false;
    pollStateRef.current.active = true;

    async function poll() {
      let retries = 0;

      while (!cancelled && pollStateRef.current.session) {
        const currentSession = pollStateRef.current.session;

        try {
          const nextState = await fetchState(
            currentSession.roomId,
            currentSession.playerSecret,
            pollStateRef.current.version
          );
          if (cancelled) {
            return;
          }
          pollStateRef.current.version = nextState.version;
          setGameState(nextState);
          retries = 0;
        } catch (error) {
          retries++;
          if (retries > 5) {
            if (!cancelled) {
              setAuthError("Lost connection to server.");
            }
            return;
          }
          const delay = Math.min(1000 * Math.pow(2, retries - 1), 16000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      pollStateRef.current.active = false;
    };
  }, [gameState?.roomId]);

  const roomIdFromUrl = useMemo(() => search.room || "", [search.room]);

  async function handleCreate(name) {
    if (!name) {
      setAuthError("Enter your name first.");
      return;
    }

    setBusy(true);
    setAuthError("");

    try {
      const nextState = await createRoom(name);
      const session = {
        roomId: nextState.roomId,
        playerSecret: nextState.me.secret,
      };

      setStoredSession(session);
      pollStateRef.current.session = session;
      pollStateRef.current.version = nextState.version;
      setGameState(nextState);
      setRollFeedback("Room ready. Share the link and start rolling.");
      navigate({
        search: { room: nextState.roomId },
        replace: true,
      });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(name, roomId) {
    if (!name) {
      setAuthError("Enter your name first.");
      return;
    }

    if (!roomId) {
      setAuthError("Enter a room code first.");
      return;
    }

    setBusy(true);
    setAuthError("");

    try {
      const nextState = await joinRoom(name, roomId);
      const session = {
        roomId: nextState.roomId,
        playerSecret: nextState.me.secret,
      };

      setStoredSession(session);
      pollStateRef.current.session = session;
      pollStateRef.current.version = nextState.version;
      setGameState(nextState);
      setRollFeedback("Joined the room. Wait for your turn.");
      navigate({
        search: { room: nextState.roomId },
        replace: true,
      });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRoll() {
    const session = pollStateRef.current.session;
    if (!session || !gameState) {
      return;
    }

    setBusy(true);
    setAuthError("");

    try {
      const result = await rollDice(session.roomId, session.playerSecret);
      pollStateRef.current.version = result.state.version;
      setGameState(result.state);
      setRollFeedback(`You rolled ${result.roll}.`);
    } catch (error) {
      setRollFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  function resetError() {
    setAuthError("");
  }

  function resetGame() {
    clearStoredSession();
    pollStateRef.current.session = null;
    pollStateRef.current.active = false;
    pollStateRef.current.version = 0;
    setGameState(null);
    setAuthError("");
    setRollFeedback("Roll to begin.");
    setBusy(false);
    navigate({ to: "/", search: {}, replace: true });
  }

  return {
    authError,
    booting,
    busy,
    gameState,
    roomIdFromUrl,
    rollFeedback,
    createGame: handleCreate,
    joinExistingGame: handleJoin,
    roll: handleRoll,
    clearError: resetError,
    resetGame,
  };
}
