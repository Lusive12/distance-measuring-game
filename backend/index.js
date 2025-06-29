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
// CORS is needed to allow your frontend (on a different domain/port) to communicate with this backend.
app.use(cors());
// This middleware parses incoming JSON requests and puts the parsed data in `req.body`.
app.use(express.json());

app.use(express.static("frontend"));

// --- In-Memory Game State Management ---
// We use Maps to keep track of active games and player WebSocket connections.
// This is suitable for a single server instance. For scaling, a service like Redis would be used.
const activeGames = new Map(); // Key: playerId, Value: { score, lives, questionsAnswered, currentQuestion }
const clients = new Map(); // Key: playerId, Value: WebSocket connection object

// --- WebSocket Server Logic ---
wss.on("connection", (ws) => {
  console.log("A client connected via WebSocket.");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      // The first message a client sends after connecting should be 'startGame'.
      if (data.type === "startGame" && data.playerId) {
        const { playerId } = data;
        console.log(`Player ${playerId} is starting a game.`);

        // Associate the WebSocket connection with the player ID
        clients.set(playerId, ws);

        // Initialize a new game state for this player
        const newQuestion = generateQuestion();
        activeGames.set(playerId, {
          score: 0,
          lives: 3,
          questionsAnswered: 0,
          currentQuestion: newQuestion,
        });

        // Send the very first question to the player
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

  ws.on("close", () => {
    console.log("A client disconnected.");
    // Here you could add logic to find which player disconnected and clean up their game state if needed.
    // For now, we'll let game states time out or end naturally.
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

// Endpoint for the frontend to log in a player.
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
      error: "A database error occurred. See details.",
      details: error.message, // This is the REAL error message from the database driver
      code: error.code, // This is the MySQL error code (e.g., ER_NO_SUCH_TABLE)
    });
  }
});

// Endpoint for the ESP32 to submit a measured distance.
app.post("/api/submit", async (req, res) => {
  const { playerId, distance } = req.body;
  if (playerId === undefined || distance === undefined) {
    return res
      .status(400)
      .json({ error: "Missing playerId or distance in request body." });
  }

  const playerExists = await db.findPlayerById(playerId);
  if (!playerExists) {
    return res.status(404).json({
      error: `Invalid playerId. Player with ID ${playerId} does not exist.`,
    });
  }

  const gameState = activeGames.get(playerId);
  if (!gameState) {
    return res.status(404).json({
      error: "No active game found for this player. Please start a new game.",
    });
  }

  const isCorrect = checkAnswer(gameState.currentQuestion, distance);

  // Update game state
  if (isCorrect) {
    gameState.score++;
    gameState.questionsAnswered++;
  } else {
    gameState.lives--;
  }

  const playerSocket = clients.get(playerId);
  if (!playerSocket) {
    return res
      .status(500)
      .json({ error: "Internal server error: Player socket not found." });
  }

  // Notify frontend of the result
  playerSocket.send(
    JSON.stringify({
      type: "roundResult",
      result: isCorrect ? "Correct" : "Wrong",
      distance: distance,
      newScore: gameState.score,
      lives: gameState.lives,
    })
  );

  // Check for Game Over condition
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

    // Clean up
    activeGames.delete(playerId);
    clients.delete(playerId);
  } else {
    // Game continues: generate the next question and send it after a delay
    setTimeout(() => {
      const nextQuestion = generateQuestion();
      gameState.currentQuestion = nextQuestion;
      activeGames.set(playerId, gameState); // Update state with new question

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
    }, 2500); // 2.5-second delay to let the player see the result
  }

  // Respond to the ESP32
  res.status(200).json({ status: "Received", correct: isCorrect });
});

// Endpoint to fetch the leaderboard.
app.get("/api/leaderboard", async (req, res) => {
  try {
    const leaderboardData = await db.getLeaderboard();
    res.status(200).json(leaderboardData);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Database error while fetching leaderboard." });
  }
});

// --- Start Server ---
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running and listening on http://localhost:${PORT}`);
  console.log(`WebSocket server is ready.`);
});
