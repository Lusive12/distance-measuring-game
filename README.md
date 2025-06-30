# Distance Target Game: An Interactive ESP32 Project

![Gameplay Sneakpeek](/gameplay_preview.jpg)

Welcome to the Distance Target Game, a full-stack interactive project that bridges the gap between the physical and digital worlds. This game challenges players to use a real-world ultrasonic sensor to meet randomly generated distance objectives displayed in a web application.

This project was built from the ground up, integrating hardware programming, a robust backend API, a dynamic frontend interface, and a persistent database.

*For the project's gameplay video demo, check out this [link](https://drive.google.com/file/d/1zo0kr2LgxWeNiCi3Elj63wnRQgImW_Qk/view?usp=drive_link)*

## ✨ Features
* **Interactive Hardware Gameplay**: Uses an ESP32 microcontroller and an HC-SR04 ultrasonic sensor as the primary game controller.

* **Dynamic Web Interface**: A clean, responsive frontend built with HTML, CSS, and JavaScript that updates in real-time.

* **Real-Time Updates**: Leverages WebSockets for instant communication between the server and the client (e.g., displaying results and new questions immediately).

* **Persistent Leaderboard**: A MySQL database stores player data and high scores, displayed on a bar chart using Chart.js.

* **Full-Stack Architecture**: A complete client-server model with a Node.js & Express backend handling game logic and API requests.

* **Life-Based Game Mode**: The game continues as long as the player has lives, with the score being the ultimate measure of success.

## 🛠️ Architecture Overview
The project is built on a classic four-component architecture, with each part handling specific responsibilities:

* **Frontend (Client)**: The user-facing web application. It handles user login, displays game information (questions, score, lives), visualizes the leaderboard, and communicates with the backend in real-time.

* **Backend (Server)**: The Node.js application using the Express framework. It serves as the brain of the operation, managing game state, validating user input, processing submissions from the ESP32, and interacting with the database.

* **Database**: A MySQL database that provides persistent storage for player profiles and their scores, forming the foundation of the leaderboard system.

* **ESP32 (Hardware Controller)**: The physical device that measures distance upon a button press and sends the data to the backend's API endpoint, acting as the bridge to the real world.


## 🚀 Tech Stack
* Hardware: ESP32, HC-SR04 Ultrasonic Sensor

* Backend: Node.js, Express.js, WebSocket (ws) library

* Frontend: HTML5, CSS3, JavaScript (ES6+)

* Database: MySQL

> Libraries: Chart.js (for leaderboard visualization)

## 🔧 Setup and Installation
To run this project locally, you will need Node.js, a MySQL server (like XAMPP), and the Arduino IDE installed.

1. Database
    1. Start your MySQL server.
       
    2. Using a tool like phpMyAdmin, create a new database named distance_measuring_game.  
    
    3. Run the following SQL queries to create the necessary tables:
```
CREATE TABLE players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    score INT NOT NULL,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
```
2. Backend
    1. Navigate to the backend directory: cd BackEnd

    2. Install the required dependencies: npm install

    3. Configure the database connection in db.js. Make sure the host, port, user, password, and database fields match your local MySQL setup.

    4. Start the server: node index.js
       > The server should now be running on http://localhost:3000.

3. Frontend
    1. Navigate to the frontend directory.

    2. The easiest way to run the frontend is with a simple local server to avoid CORS issues. If you have VS Code, I recommend the Live Server extension.

    3. Right-click on index.html and select "Open with Live Server".

    4. Your browser will open the game, ready to play.

4. ESP32
    1. Open the .ino file from the esp32 directory in the Arduino IDE.

    2. Install the necessary libraries for your ESP32 board if you haven't already.

    3. Modify the following variables in the code:
    ```
    ssid: Your WiFi network name.
    
    password: Your WiFi password.
    
    serverName: The IP address of your computer running the backend (e.g., http://192.168.1.10:3000/api/submit).
    ```
    4. Connect your ESP32, select the correct board and port, and upload the sketch.

## 🎮 How to Play
1. Open the frontend website in your browser.

2. Enter your desired username and click "Continue".

3. The game screen will appear with your first distance challenge.

4. Aim the ultrasonic sensor on your ESP32 device at an object that you estimate matches the required distance.

5. Press the physical button on your device.

6. The website will instantly update to show whether you were "Correct" or "Wrong" and display your new score and remaining lives.

7. A new challenge will appear automatically. Keep playing until you run out of lives!

8. Your final score will be saved, and the leaderboard will update if you made it into the top 10.
