import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BOARD_SIZE, PLAYER_COLORS, PLAYER_GLOWS, boardOrder } from "../game/constants";
import { useGameClient } from "../game/useGameClient";

function DicePreview({ canRoll, feedback }) {
  return (
    <div className={`dice-preview ${canRoll ? "is-live" : ""}`}>
      <div className="dice-face">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p>{feedback}</p>
    </div>
  );
}

function AuthPanel({ roomIdFromUrl, onCreate, onJoin, busy, authError, clearError }) {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(roomIdFromUrl);
  const [joinMode, setJoinMode] = useState(Boolean(roomIdFromUrl));

  useEffect(() => {
    setRoomId(roomIdFromUrl);
    if (roomIdFromUrl) {
      setJoinMode(true);
    }
  }, [roomIdFromUrl]);

  return (
    <section className="hero-shell">
      <div className="hero-copy">
        <p className="kicker">TanStack Rebuild</p>
        <h1>Snakes & Ladders with a sharper table-side feel.</h1>
        <p className="lede">
          Create a room, send the link, and play from different devices with a cleaner layout,
          stronger turn feedback, and a more tactile board.
        </p>
        <div className="hero-badges">
          <span>Up to 3 players</span>
          <span>Remote room links</span>
          <span>Live turn sync</span>
        </div>
      </div>

      <div className="auth-card panel">
        <div className="panel-header">
          <p className="section-label">Join the table</p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              clearError();
              setJoinMode((current) => !current);
            }}
          >
            {joinMode ? "Create instead" : "Have a code?"}
          </button>
        </div>

        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            maxLength={20}
            placeholder="Player 1"
            onChange={(event) => {
              clearError();
              setName(event.target.value);
            }}
          />
        </label>

        {joinMode ? (
          <label className="field">
            <span>Room code</span>
            <input
              value={roomId}
              maxLength={6}
              placeholder="ABC123"
              onChange={(event) => {
                clearError();
                setRoomId(event.target.value.toUpperCase());
              }}
            />
          </label>
        ) : null}

        <div className="auth-actions">
          {joinMode ? (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => onJoin(name.trim(), roomId.trim().toUpperCase())}
            >
              {busy ? "Joining..." : "Join room"}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => onCreate(name.trim())}
            >
              {busy ? "Creating..." : "Create room"}
            </button>
          )}
        </div>

        <p className="error-text">{authError}</p>
      </div>
    </section>
  );
}

function PlayerRail({ gameState }) {
  return (
    <div className="player-rail">
      {gameState.players.map((player, index) => (
        <article
          key={player.id}
          className={`player-card ${player.isCurrentTurn ? "is-current" : ""} ${player.isMe ? "is-me" : ""}`}
          style={{
            "--player-color": PLAYER_COLORS[index % PLAYER_COLORS.length],
            "--player-glow": PLAYER_GLOWS[index % PLAYER_GLOWS.length],
          }}
        >
          <div className="player-card-top">
            <span className="player-token" />
            <div>
              <h3>{player.name}</h3>
              <p>{player.isMe ? "You" : "Remote player"}</p>
            </div>
          </div>
          <div className="player-card-meta">
            <strong>{player.position}</strong>
            <span>{player.isCurrentTurn ? "Rolling now" : "Waiting"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function Board({ gameState }) {
  const boardSquares = boardOrder();
  const playerIndex = new Map(gameState.players.map((player, index) => [player.id, index]));

  return (
    <div className="board-grid">
      {boardSquares.map((square) => {
        const jump = gameState.snakesAndLadders[square];
        const playersHere = gameState.players.filter((player) => player.position === square);
        const toneClass = square % 2 === 0 ? "is-sand" : "is-ivory";

        return (
          <div key={square} className={`board-cell ${toneClass}`}>
            <span className="board-square-number">{square}</span>
            {jump ? (
              <span className={`board-jump ${jump > square ? "is-ladder" : "is-snake"}`}>
                {jump > square ? "L" : "S"} {jump}
              </span>
            ) : null}
            {playersHere.length > 0 ? (
              <div className="board-tokens">
                {playersHere.map((player) => {
                  const index = playerIndex.get(player.id) || 0;
                  return (
                    <span
                      key={player.id}
                      className="board-token"
                      title={player.name}
                      style={{
                        "--token-color": PLAYER_COLORS[index % PLAYER_COLORS.length],
                        "--token-glow": PLAYER_GLOWS[index % PLAYER_GLOWS.length],
                      }}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function GameLog({ log }) {
  return (
    <div className="log-list">
      {[...log].reverse().map((entry, reverseIndex) => (
        <div key={log.length - 1 - reverseIndex} className="log-entry">
          {entry}
        </div>
      ))}
    </div>
  );
}

function GamePanel({ gameState, rollFeedback, busy, onRoll }) {
  const winner = gameState.players.find((player) => player.id === gameState.winnerId);
  const currentPlayer = gameState.players.find((player) => player.isCurrentTurn);
  const shareLink = `${window.location.origin}/?room=${encodeURIComponent(gameState.roomId)}`;

  return (
    <section className="table-layout">
      <aside className="left-column">
        <div className="panel spotlight-panel">
          <div className="panel-header">
            <p className="section-label">Room</p>
            <Link to="/" search={{ room: gameState.roomId }} className="text-link">
              shareable link
            </Link>
          </div>
          <div className="room-row">
            <div>
              <h2>{gameState.roomId}</h2>
              <p>Invite friends with this room link.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigator.clipboard.writeText(shareLink)}
            >
              Copy link
            </button>
          </div>
          <input className="share-input" value={shareLink} readOnly />
        </div>

        <div className="panel">
          <div className="panel-header">
            <p className="section-label">Players</p>
            <span className="muted-small">{gameState.players.length}/3 seated</span>
          </div>
          <PlayerRail gameState={gameState} />
        </div>

        <div className="panel control-panel">
          <div className="turn-copy">
            <p className="section-label">Turn status</p>
            <h2>{winner ? `${winner.name} wins` : currentPlayer ? `${currentPlayer.name}'s turn` : "Waiting"}</h2>
            <p>
              {winner
                ? "The board is locked until a new room is created."
                : gameState.canRoll
                  ? "Your turn is live. Roll when ready."
                  : "Watching for the next move."}
            </p>
          </div>
          <DicePreview canRoll={gameState.canRoll} feedback={rollFeedback} />
          <button type="button" className="primary-button giant-button" disabled={!gameState.canRoll || busy} onClick={onRoll}>
            {busy && gameState.canRoll ? "Rolling..." : "Roll Dice"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <p className="section-label">Game log</p>
            <span className="muted-small">Latest moves</span>
          </div>
          <GameLog log={gameState.log} />
        </div>
      </aside>

      <div className="board-column">
        <div className="board-frame panel">
          <div className="board-header">
            <div>
              <p className="section-label">Board</p>
              <h2>{BOARD_SIZE} squares</h2>
            </div>
            <div className="board-legend">
              <span className="ladder-pill">Ladders</span>
              <span className="snake-pill">Snakes</span>
            </div>
          </div>
          <Board gameState={gameState} />
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const { authError, booting, busy, gameState, roomIdFromUrl, rollFeedback, createGame, joinExistingGame, roll, clearError } =
    useGameClient();

  if (booting) {
    return (
      <main className="page-shell">
        <section className="boot-panel panel">
          <p className="section-label">Loading room</p>
          <h1>Restoring your seat at the table.</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      {gameState ? (
        <GamePanel gameState={gameState} rollFeedback={rollFeedback} busy={busy} onRoll={roll} />
      ) : (
        <AuthPanel
          roomIdFromUrl={roomIdFromUrl}
          onCreate={createGame}
          onJoin={joinExistingGame}
          busy={busy}
          authError={authError}
          clearError={clearError}
        />
      )}
    </main>
  );
}
