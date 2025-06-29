const mysql = require("mysql2/promise");

//Setup Database Connection Pool - initialize setup mysql
const pool = mysql.createPool({
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "distance_measuring_game",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ** NEW: Added a connection test to see detailed errors on startup **
pool
  .getConnection()
  .then((connection) => {
    console.log("✅ Database connected successfully!");
    connection.release(); // Release the connection back to the pool
  })
  .catch((err) => {
    console.error(
      "❌ FATAL: Database connection failed. Check your credentials and if the server is running."
    );
    console.error(err); // Log the detailed MySQL error
  });

/**
 * Finds a player by their ID to verify they exist.
 * @param {number} id The ID of the player to find.
 * @returns {Promise<object|null>} A promise that resolves to the player object or null if not found.
 */
async function findPlayerById(id) {
  try {
    const [rows] = await pool.query("SELECT * FROM players WHERE id = ?", [id]);
    return rows[0] || null; // Return the player or null
  } catch (error) {
    console.error(`Database error in findPlayerById for ID: ${id}`, error);
    throw error;
  }
}

/**
 * Finds a player by their username. If they don't exist, a new player is created.
 * This is wrapped in a transaction to ensure atomicity (both operations succeed or fail together).
 * @param {string} username The username to find or create.
 * @returns {Promise<object>} A promise that resolves to the player object (e.g., { id, username }).
 */
async function findOrCreatePlayer(username) {
  try {
    // Langsung INSERT username ke tabel players.
    const [result] = await pool.query(
      "INSERT INTO players(username) VALUES (?)",
      [username]
    );

    // Buat objek player untuk dikembalikan, berisi ID baru dan username.
    const newPlayer = {
      id: result.insertId,
      username: username,
    };

    console.log(
      `Created new session for player '${username}' with new ID: ${newPlayer.id}`
    );
    return newPlayer;
  } catch (error) {
    console.error(
      `Database error in createPlayer for user: ${username}`,
      error
    );
    throw error;
  }
}

/**
 * Saves a player's final score to the scores table.
 * @param {number} playerId The ID of the player.
 * @param {number} score The final score to save.
 * @returns {Promise<any>} A promise that resolves when the score is saved.
 */
async function saveScore(playerId, score) {
  try {
    const [result] = await pool.query(
      "INSERT INTO scores (player_id, score) VALUES (?, ?)",
      [playerId, score]
    );
    console.log(
      `Score of ${score} saved for player ID ${playerId}. Insert ID: ${result.insertId}`
    );
    return result;
  } catch (error) {
    console.error("Error saving score:", error);
    throw error;
  }
}

/**
 * Retrieves the top 10 players based on their highest score.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of leaderboard objects.
 */
async function getLeaderboard() {
  try {
    const query = `
      SELECT p.username, MAX(s.score) as highScore
      FROM scores s
      JOIN players p ON s.player_id = p.id
      GROUP BY p.username
      ORDER BY highScore DESC
      LIMIT 10;
    `;
    const [rows] = await pool.query(query);
    console.log("Leaderboard data fetched successfully.");
    return rows;
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    throw error;
  }
}

/**
 * Menghitung distribusi skor: 5 skor teratas yang paling sering didapat.
 * @returns {Promise<Array<object>>} Array objek berisi { score, timesAchieved }.
 */
async function getScoreDistribution() {
  try {
    // Query ini melakukan:
    // 1. SELECT score, COUNT(id) as timesAchieved -> Pilih kolom skor, dan hitung jumlah baris untuk setiap skor (beri nama 'timesAchieved')
    // 2. FROM scores -> Dari tabel scores
    // 3. GROUP BY score -> Kelompokkan baris berdasarkan nilai skor yang sama
    // 4. ORDER BY timesAchieved DESC -> Urutkan hasilnya berdasarkan jumlah pencapaian (paling banyak di atas)
    // 5. LIMIT 5 -> Ambil hanya 5 baris teratas
    const query = `
      SELECT score, COUNT(id) as timesAchieved
      FROM scores
      GROUP BY score
      ORDER BY timesAchieved DESC
      LIMIT 5;
    `;
    const [rows] = await pool.query(query);
    return rows;
  } catch (error) {
    console.error(`Database error in getScoreDistribution`, error);
    throw error;
  }
}

// Export the functions to be used in other parts of the application
module.exports = {
  findOrCreatePlayer,
  saveScore,
  getLeaderboard,
  findPlayerById,
  getScoreDistribution,
};
