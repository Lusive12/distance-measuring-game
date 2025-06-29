// app.js

document.addEventListener("DOMContentLoaded", () => {
  // Configuration - Point this to your backend's address
  const API_URL = "http://localhost:3000";
  const WEBSOCKET_URL = "ws://localhost:3000";

  // DOM Elements
  const views = document.querySelectorAll(".view");
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username-input");
  const playAgainButton = document.getElementById("play-again-button");

  // UI Displays
  const playerNameDisplay = document.getElementById("player-name-display");
  const scoreDisplay = document.getElementById("score-display");
  const livesDisplay = document.getElementById("lives-display");
  const questionText = document.getElementById("question-text");
  const finalScoreDisplay = document.getElementById("final-score-display");

  // Overlays & Modals
  const resultOverlay = document.getElementById("result-overlay");
  const resultText = document.getElementById("result-text");
  const resultDistance = document.getElementById("result-distance");

  // Chart
  const leaderboardChartCanvas = document.getElementById("leaderboard-chart");
  const scoreDistributionCanvas = document.getElementById(
    "scoreDistributionChart"
  );

  // App State
  let playerId = null;
  let username = "";
  let ws = null;
  let leaderboardChart = null;
  let scoreDistributionChart = null;
  // --- Main Functions ---

  function switchView(viewId) {
    views.forEach((view) => view.classList.remove("active-view"));
    document.getElementById(viewId).classList.add("active-view");
  }

  async function login(event) {
    event.preventDefault(); // Prevent form from reloading the page
    username = usernameInput.value.trim();
    if (!username) {
      alert("Please enter a username.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      alert("Could not connect to the server. Is it running?");
      console.error("Login error:", error);
    }
  }

  function connectWebSocket() {
    ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      console.log("WebSocket connection established.");

      // LANGKAH 1: Ganti tampilan ke layar permainan DULU.
      // Ini memastikan semua elemen seperti 'lives-display' sudah ada dan siap.
      switchView("game-view");

      // LANGKAH 2: BARU setelah layar siap, minta server untuk memulai game.
      // Server akan merespons dengan data awal (termasuk nyawa).
      ws.send(JSON.stringify({ type: "startGame", playerId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed.");
      // Don't show an alert if the game is over, as this is expected.
      if (
        document
          .getElementById("game-over-view")
          .classList.contains("active-view")
      )
        return;

      alert("Connection to the game server lost.");
      switchView("login-view");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      alert("A connection error occurred.");
    };
  }

  function handleServerMessage(data) {
    console.log("Message from server:", data);
    switch (data.type) {
      case "newQuestion":
        updateQuestion(data.question, data.score);
        updateStats(data.score, data.lives);
        break;
      case "roundResult":
        updateStats(data.newScore, data.lives);
        showResult(data.result, data.distance);
        break;
      case "gameOver":
        showGameOver(data.finalScore);
        fetchAndDrawLeaderboard(); // Update leaderboard at the end of the game
        break;
    }
  }

  function updateQuestion(text, currentScore) {
    resultOverlay.classList.remove("visible"); // Hide previous result
    questionText.textContent = text;
    targetCountDisplay.textContent = currentScore + 1;
  }

  function updateStats(score, lives) {
    scoreDisplay.textContent = score;
    livesDisplay.textContent = "❤️".repeat(lives) + "🖤".repeat(3 - lives);
  }

  function showResult(result, distance) {
    resultText.textContent = result + " !";
    resultText.style.color =
      result === "Correct" ? "var(--success-color)" : "var(--danger-color)";
    resultDistance.textContent = `The distance was: ${distance.toFixed(2)} cm`;
    resultOverlay.classList.add("visible");
    // The next question will be sent by the server after the timeout specified in the backend
  }

  function showGameOver(finalScore) {
    finalScoreDisplay.textContent = finalScore;
    switchView("game-over-view");
    fetchAndDrawLeaderboard();
    fetchAndDrawScoreDistribution();
    if (ws) {
      ws.close(); // Cleanly close the connection now that the game is over
    }
  }

  async function fetchAndDrawLeaderboard() {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      const data = await response.json();

      const labels = data.map((item) => item.username);
      const scores = data.map((item) => item.highScore);

      if (leaderboardChart) leaderboardChart.destroy(); // Clear old chart before drawing new one

      leaderboardChart = new Chart(leaderboardChartCanvas, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Highest Score",
              data: scores,
              backgroundColor: "rgba(41, 128, 185, 0.6)",
              borderColor: "rgba(41, 128, 185, 1)",
              borderWidth: 2,
              borderRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,

          // KUNCI UTAMA: Mengubah orientasi grafik menjadi horizontal
          indexAxis: "x",

          scales: {
            // Sumbu X sekarang adalah sumbu nilai (skor)
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1, // Angka di sumbu skor akan kelipatan 1
                precision: 0, // Tidak ada angka desimal
              },
              title: {
                display: true,
                text: "Skor",
              },
            },
            // Sumbu Y sekarang adalah sumbu kategori (nama pemain)
            x: {
              title: {
                display: true,
                text: "Pemain",
              },
              // Tidak perlu konfigurasi khusus, label akan otomatis lurus
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `${context.raw} points`,
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    }
  }

  async function fetchAndDrawScoreDistribution() {
    try {
      const response = await fetch(`${API_URL}/api/score-distribution`);
      const data = await response.json();

      // Siapkan data untuk Chart.js
      // Label adalah nilai skornya (misal: "10 Points")
      const labels = data.map((item) => `${item.score} Points`);
      // Data adalah berapa kali skor tersebut dicapai
      const scores = data.map((item) => item.timesAchieved);

      // Hapus grafik lama sebelum menggambar yang baru (jika ada)
      if (scoreDistributionChart) {
        scoreDistributionChart.destroy();
      }

      scoreDistributionChart = new Chart(scoreDistributionCanvas, {
        type: "bar", // Tipe grafik bar
        data: {
          labels: labels,
          datasets: [
            {
              label: "Banyak Kali Dicapai",
              data: scores,
              backgroundColor: "rgba(231, 76, 60, 0.6)", // Warna merah
              borderColor: "rgba(231, 76, 60, 1)",
              borderWidth: 2,
              borderRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // indexAxis: 'y', <-- HAPUS ATAU BERI KOMENTAR PADA BARIS INI
          scales: {
            // 'y' sekarang adalah sumbu vertikal (jumlah pemain)
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1, // Pastikan sumbu Y adalah bilangan bulat
                precision: 0,
              },
              title: {
                display: true,
                text: "Jumlah Pemain",
              },
            },
            // 'x' adalah sumbu horizontal (label skor)
            x: {
              ticks: {
                // KUNCI UTAMA: Izinkan Chart.js untuk melewati label secara otomatis jika terlalu ramai.
                autoSkip: true,

                // Jarak minimum (dalam piksel) antar label sebelum autoSkip diaktifkan.
                // Anda bisa sesuaikan nilai ini jika perlu.
                autoSkipPadding: 10,

                // Putar sedikit labelnya jika membantu (opsional, tapi bisa sangat efektif)
                maxRotation: 25,
                minRotation: 0,
              },
              title: {
                display: true,
                text: "Skor",
              },
              // tidak perlu konfigurasi khusus untuk sumbu x saat ini
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `${context.raw} kali dicapai`,
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Failed to fetch score distribution:", error);
    }
  }

  // --- Event Listeners ---
  loginForm.addEventListener("submit", login);
  playAgainButton.addEventListener("click", () => {
    // switchView("login-view");
    // fetchAndDrawLeaderboard(); // Refresh leaderboard when going back to login
    location.reload();
  });

  // --- Initial Load ---
  // Load the leaderboard as soon as the page is ready
  fetchAndDrawLeaderboard();
  fetchAndDrawScoreDistribution();
});
