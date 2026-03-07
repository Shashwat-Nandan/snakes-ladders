# Snakes and Ladders Online

A remote multiplayer Snakes and Ladders game, built with React, Vite, and Node.js.

**Play the game online:** [https://snakes-ladders-two.vercel.app/](https://snakes-ladders-two.vercel.app/)

## Features

- **Multiplayer:** Play with up to 3 friends remotely in real-time.
- **Direct Link Sharing:** Easily invite friends by sharing a direct room link — no need to manually type room codes.
- **Real-time updates:** Watch your friends' moves live, powered by HTTP long-polling with automatic reconnection.
- **Classic Gameplay:** Standard 100-square board with traditional snakes and ladders mechanics.

## Tech Stack

- **Frontend:** React 19, TanStack Router, Vite
- **Backend:** Node.js (Vanilla HTTP Server, zero external dependencies)
- **Deployment:** Vercel (serverless function + static assets)

## Setup & Installation

1. **Clone the repository** or download the code.

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode** (recommended for local dev — includes hot reload):
   ```bash
   # Terminal 1: Start the API server
   npm run serve

   # Terminal 2: Start the Vite dev server (proxies /api to the Node server)
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

4. **Run in production mode**:
   ```bash
   npm start
   ```
   This builds the frontend and starts the full server at `http://localhost:3000`.

## How to Play

1. **Create a Room:** Enter your name and click **"Create Room"**.
2. **Invite Friends:** The game will generate a unique Room ID and a shareable link. Copy the link and send it to your friends.
3. **Join Game:** When friends open the link, the Room ID will be auto-filled for them. They just need to enter their name and click **"Join Room"**.
4. **Take Turns:** Once everyone is in, the first player rolls the dice to begin. The active player's name will be highlighted.
5. **Move:** Players take turns rolling the dice. The game will automatically move your token and apply any snakes (go down) or ladders (go up).
6. **Win:** The first player to reach exactly square 100 wins the game!

