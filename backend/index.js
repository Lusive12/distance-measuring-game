const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const cors = require("cors");

//Import our custom modules
const db = require("./db");
const { generateQuestion, checkAnswer } = require("./game/logic");

// Server Setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static("frontend"));

// --- In-Memory Game State Management ---
const activeGames = new Map();
const clients = new Map();

// --- WebSocket Server Logic ---
wss.on("connection", (ws) => {
  console.log("A client connected via WebSocket.");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "startGame" && data.playerId) {
        const { playerId } = data;

        // FIX #1: Pastikan game lama (jika ada) untuk player ini sudah bersih
        if (activeGames.has(playerId)) {
          console.log(
            `Found an old game for player ${playerId}. Clearing it before starting a new one.`
          );
          activeGames.delete(playerId);
          const oldSocket = clients.get(playerId);
          if (oldSocket && oldSocket !== ws) {
            oldSocket.close();
          }
        }

        console.log(`Player ${playerId} is starting a new game.`);

        clients.set(playerId, ws);

        const newQuestion = generateQuestion();
        activeGames.set(playerId, {
          score: 0,
          lives: 3,
          questionsAnswered: 0,
          currentQuestion: newQuestion,
        });

        ws.send(
          JSON.stringify({
            type: "newQuestion",
            question: newQuestion.text,
            lives: 3,
            score: 0,
          })
        );
      }
    } catch (error) {
      console.error("Failed to handle WebSocket message:", error);
    }
  });

  // FIX #2: Implementasi pembersihan saat koneksi terputus
  ws.on("close", () => {
    console.log("A client disconnected.");
    let disconnectedPlayerId = null;

    // Cari tahu playerId mana yang terkait dengan websocket (ws) ini
    for (const [playerId, clientWs] of clients.entries()) {
      if (clientWs === ws) {
        disconnectedPlayerId = playerId;
        break;
      }
    }

    // Jika ditemukan, bersihkan data pemain tersebut
    if (disconnectedPlayerId) {
      console.log(
        `Cleaning up stale game state for player ${disconnectedPlayerId}.`
      );
      activeGames.delete(disconnectedPlayerId);
      clients.delete(disconnectedPlayerId);
    }
  });
});

// --- REST API Endpoints ---
app.get("/", (req, res) => {
  res
    .status(200)
    .send(
      "<h1>Welcome to the Distance Game API!</h1><p>The server is running correctly.</p>"
    );
});

app.post("/api/player", async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: "Username cannot be empty." });
  }
  try {
    const player = await db.findOrCreatePlayer(username.trim());
    res.status(200).json(player);
  } catch (error) {
    res.status(500).json({
      error: "A database error occurred.",
      details: error.message,
      code: error.code,
    });
  }
});

app.post("/api/submit", async (req, res) => {
  const { playerId, distance } = req.body;
  if (playerId === undefined || distance === undefined) {
    return res.status(400).json({ error: "Missing playerId or distance." });
  }

  const playerExists = await db.findPlayerById(playerId);
  if (!playerExists) {
    return res.status(404).json({ error: `Invalid playerId: ${playerId}.` });
  }

  const gameState = activeGames.get(playerId);
  if (!gameState) {
    return res
      .status(404)
      .json({ error: "No active game found for this player." });
  }

  const isCorrect = checkAnswer(gameState.currentQuestion, distance);

  if (isCorrect) {
    gameState.score++;
    gameState.questionsAnswered++;
  } else {
    gameState.lives--;
  }

  const playerSocket = clients.get(playerId);
  if (!playerSocket) {
    return res.status(500).json({ error: "Player socket not found." });
  }

  playerSocket.send(
    JSON.stringify({
      type: "roundResult",
      result: isCorrect ? "Correct" : "Wrong",
      distance: distance,
      newScore: gameState.score,
      lives: gameState.lives,
    })
  );

  if (gameState.lives <= 0) {
    console.log(
      `Game over for player ${playerId}. Final score: ${gameState.score}`
    );
    try {
      await db.saveScore(playerId, gameState.score);
    } catch (error) {
      console.error("Failed to save score on game over:", error);
    }

    playerSocket.send(
      JSON.stringify({ type: "gameOver", finalScore: gameState.score })
    );

    // FIX #3: Tutup koneksi secara eksplisit dari server
    playerSocket.close();

    // Pembersihan segera
    activeGames.delete(playerId);
    clients.delete(playerId);
  } else {
    setTimeout(() => {
      const nextQuestion = generateQuestion();
      gameState.currentQuestion = nextQuestion;
      activeGames.set(playerId, gameState);

      if (playerSocket.readyState === playerSocket.OPEN) {
        playerSocket.send(
          JSON.stringify({
            type: "newQuestion",
            question: nextQuestion.text,
            lives: gameState.lives,
            score: gameState.score,
          })
        );
      }
    }, 2500);
  }
  res.status(200).json({ status: "Received", correct: isCorrect });
});

app.get("/api/score-distribution", async (req, res) => {
  try {
    const distributionData = await db.getScoreDistribution();
    res.status(200).json(distributionData);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Database error while fetching score distribution." });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const leaderboardData = await db.getLeaderboard();
    res.status(200).json(leaderboardData);
  } catch (error) {
    res.status(500).json({ error: "Database error fetching leaderboard." });
  }
});

// --- Start Server ---
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running and listening on http://localhost:${PORT}`);
  console.log(`WebSocket server is ready.`);
});
