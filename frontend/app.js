// app.js

document.addEventListener('DOMContentLoaded', () => {

    // Configuration - Point this to your backend's address
    const API_URL = 'http://localhost:3000';
    const WEBSOCKET_URL = 'ws://localhost:3000';

    // DOM Elements
    const views = document.querySelectorAll('.view');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username-input');
    const playAgainButton = document.getElementById('play-again-button');
    
    // UI Displays
    const playerNameDisplay = document.getElementById('player-name-display');
    const scoreDisplay = document.getElementById('score-display');
    const livesDisplay = document.getElementById('lives-display');
    const questionText = document.getElementById('question-text');
    const finalScoreDisplay = document.getElementById('final-score-display');

    // Overlays & Modals
    const resultOverlay = document.getElementById('result-overlay');
    const resultText = document.getElementById('result-text');
    const resultDistance = document.getElementById('result-distance');
    
    // Chart
    const leaderboardChartCanvas = document.getElementById('leaderboard-chart');

    // App State
    let playerId = null;
    let username = '';
    let ws = null;
    let leaderboardChart = null;

    // --- Main Functions ---

    function switchView(viewId) {
        views.forEach(view => view.classList.remove('active-view'));
        document.getElementById(viewId).classList.add('active-view');
    }

    async function login(event) {
        event.preventDefault(); // Prevent form from reloading the page
        username = usernameInput.value.trim();
        if (!username) {
            alert('Please enter a username.');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/player`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            const player = await response.json();

            if (player.error) {
                alert(`Error: ${player.details || player.error}`);
                return;
            }

            playerId = player.id;
            playerNameDisplay.textContent = username;
            connectWebSocket();

        } catch (error) {
            alert('Could not connect to the server. Is it running?');
            console.error('Login error:', error);
        }
    }

    function connectWebSocket() {
        ws = new WebSocket(WEBSOCKET_URL);

        ws.onopen = () => {
            console.log('WebSocket connection established.');
            // The game officially starts now by sending the 'startGame' message
            ws.send(JSON.stringify({ type: 'startGame', playerId }));
            switchView('game-view');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed.');
            // Don't show an alert if the game is over, as this is expected.
            if (document.getElementById('game-over-view').classList.contains('active-view')) return;
            
            alert('Connection to the game server lost.');
            switchView('login-view');
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            alert('A connection error occurred.');
        };
    }

    function handleServerMessage(data) {
        console.log('Message from server:', data);
        switch (data.type) {
            case 'newQuestion':
                updateQuestion(data.question, data.score);
                updateStats(data.score, data.lives);
                break;
            case 'roundResult':
                updateStats(data.newScore, data.lives);
                showResult(data.result, data.distance);
                break;
            case 'gameOver':
                showGameOver(data.finalScore);
                fetchAndDrawLeaderboard(); // Update leaderboard at the end of the game
                break;
        }
    }

    function updateQuestion(text, currentScore) {
        resultOverlay.classList.remove('visible'); // Hide previous result
        questionText.textContent = text;
        targetCountDisplay.textContent = currentScore + 1;
    }

    function updateStats(score, lives) {
        scoreDisplay.textContent = score;
        livesDisplay.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
    }

    function showResult(result, distance) {
        resultText.textContent = result + ' !';
        resultText.style.color = result === 'Correct' ? 'var(--success-color)' : 'var(--danger-color)';
        resultDistance.textContent = `The distance was: ${distance.toFixed(2)} cm`;
        resultOverlay.classList.add('visible');
        // The next question will be sent by the server after the timeout specified in the backend
    }

    function showGameOver(finalScore) {
        finalScoreDisplay.textContent = finalScore;
        switchView('game-over-view');
        if (ws) {
            ws.close(); // Cleanly close the connection now that the game is over
        }
    }

    async function fetchAndDrawLeaderboard() {
        try {
            const response = await fetch(`${API_URL}/api/leaderboard`);
            const data = await response.json();

            const labels = data.map(item => item.username);
            const scores = data.map(item => item.highScore);

            if (leaderboardChart) leaderboardChart.destroy(); // Clear old chart before drawing new one

            leaderboardChart = new Chart(leaderboardChartCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Highest Score',
                        data: scores,
                        backgroundColor: 'rgba(41, 128, 185, 0.6)',
                        borderColor: 'rgba(41, 128, 185, 1)',
                        borderWidth: 2,
                        borderRadius: 5,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.raw} points`
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
        }
    }

    // --- Event Listeners ---
    loginForm.addEventListener('submit', login);
    playAgainButton.addEventListener('click', () => {
        switchView('login-view');
        fetchAndDrawLeaderboard(); // Refresh leaderboard when going back to login
    });

    // --- Initial Load ---
    // Load the leaderboard as soon as the page is ready
    fetchAndDrawLeaderboard();
});
