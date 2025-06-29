const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');

//Import our custom modules
const db = require('./db')  
const {generateQuestion, checkAnswer} = require('./game/logic');

// Server Setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Middleware ---
// CORS is needed to allow your frontend (on a different domain/port) to communicate with this backend.
app.use(cors()); 
// This middleware parses incoming JSON requests and puts the parsed data in `req.body`.
app.use(express.json());

// --- In-Memory Game State Management ---
// We use Maps to keep track of active games and player WebSocket connections.
// This is suitable for a single server instance. For scaling, a service like Redis would be used.
const activeGames = new Map(); // Key: playerId, Value: { score, lives, questionsAnswered, currentQuestion }
const clients = new Map();     // Key: playerId, Value: WebSocket connection object


// --- WebSocket Server Logic ---
wss.on('connection', (ws) => {
    console.log('A client connected via WebSocket.');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // The first message a client sends after connecting should be 'startGame'.
            if (data.type === 'startGame' && data.playerId) {
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
                    currentQuestion: newQuestion
                });

                // Send the very first question to the player
                ws.send(JSON.stringify({
                    type: 'newQuestion',
                    question: newQuestion.text,
                    lives: 3,
                    score: 0
                }));
            }
        } catch (error) {
            console.error('Failed to handle WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        console.log('A client disconnected.');
        // Here you could add logic to find which player disconnected and clean up their game state if needed.
        // For now, we'll let game states time out or end naturally.
    });
});

// --- REST API Endpoints ---

// Endpoint for the frontend to log in a player.
app.post('/api/player', async (req, res) => {
    const { username } = req.body;
    if (!username || username.trim().length === 0) {
        return res.status(400).json({ error: 'Username cannot be empty.' });
    }
    try {
        const player = await db.findOrCreatePlayer(username.trim());
        res.status(200).json(player);
    } catch (error) {
        // res.status(500).json({ error: 'Database error while creating/finding player.' });
    console.error("--- ERROR REACHED INDEX.JS ---", error); // Adding a loud console log here just in case
    res.status(500).json({
        error: "A database error occurred. See details.",
        details: error.message, // This is the REAL error message from the database driver
        code: error.code // This is the MySQL error code (e.g., ER_NO_SUCH_TABLE)
    });

    }
});


app.post('/api/submit', async (req, res) => {
    try {
        const { playerId, distance } = req.body;
        if (playerId === undefined || distance === undefined) {
            return res.status(400).json({ error: 'Missing playerId or distance.' });
        }

        const playerExists = await db.findPlayerById(playerId);
        if (!playerExists) {
            return res.status(404).json({ error: `Invalid playerId. Player with ID ${playerId} does not exist.` });
        }


        let gameState = activeGames.get(playerId);
        
        //temporary code for testing backend and frontend
        if (!gameState) { //command this if esp32 has been configured and connected
            console.log(`TESTING: No game found for player ${playerId}. Starting a new one.`);
            const newQuestion = generateQuestion();
            gameState = {
                score: 0,
                lives: 3,
                questionsAnswered: 0,
                currentQuestion: newQuestion
            };
            activeGames.set(playerId, gameState);
            // We can't send the first question via WebSocket here, but the game is now active for submission.
        }
        
        // let gameState = activeGames.get(playerId);
        if (!gameState) {
             return res.status(404).json({ error: 'No active game found. Please start the game on the website first.' });
        }

        const isCorrect = checkAnswer(gameState.currentQuestion, distance);
        if (isCorrect) {
            gameState.score++;
            gameState.questionsAnswered++;
        } else {
            gameState.lives--;
        }
        console.log(`[Player ${playerId}] Answered. Correct: ${isCorrect}. Score: ${gameState.score}, Lives: ${gameState.lives}`);

        const playerSocket = clients.get(playerId);
        if (playerSocket) {
            playerSocket.send(JSON.stringify({
                type: 'roundResult',
                result: isCorrect ? 'Correct' : 'Wrong',
                distance: distance,
                newScore: gameState.score,
                lives: gameState.lives
            }));
        }

        if (gameState.lives <= 0) {
            console.log(`[Player ${playerId}] Game over. Final score: ${gameState.score}`);
            await db.saveScore(playerId, gameState.score);
            if (playerSocket) {
                playerSocket.send(JSON.stringify({ type: 'gameOver', finalScore: gameState.score }));
            }
            activeGames.delete(playerId);
            clients.delete(playerId);
        } else {
             // Generate and log the next question after a delay
             setTimeout(() => {
                // Ensure the game hasn't been deleted in the meantime
                if (!activeGames.has(playerId)) return;

                const nextQuestion = generateQuestion();
                gameState.currentQuestion = nextQuestion;
                console.log(`[Player ${playerId}] New Question: "${nextQuestion.text}"`);
                activeGames.set(playerId, gameState);

                if (playerSocket && playerSocket.readyState === playerSocket.OPEN) {
                    playerSocket.send(JSON.stringify({
                        type: 'newQuestion',
                        question: nextQuestion.text,
                        lives: gameState.lives,
                        score: gameState.score
                    }));
                }
            }, 2500); // 2.5 second delay to show result screen
        }
        
        res.status(200).json({ status: 'Received', correct: isCorrect });

    } catch (error) {
        console.error("--- ERROR IN /api/submit ---", error);
        res.status(500).json({ error: 'An unexpected error occurred in the submit endpoint.' });
    }
});

// Endpoint to fetch the leaderboard.
app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboardData = await db.getLeaderboard();
        res.status(200).json(leaderboardData);
    } catch (error) {
        res.status(500).json({ error: 'Database error while fetching leaderboard.' });
    }
});


// --- Start Server ---
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running and listening on http://localhost:${PORT}`);
    console.log(`WebSocket server is ready.`);
});