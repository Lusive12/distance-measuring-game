#include <ArduinoJson.h>
#include <EasyButton.h>
#include <HTTPClient.h>
#include <WiFi.h>

EasyButton button(23);

const char* ssid = "realme 10";     // Ganti dengan SSID WiFi kamu
const char* password = "paansih7";  // Ganti dengan password WiFi kamu

const char* getIdUrl = "http://192.168.223.209/get_latest_UID.php";  // Ganti IP sesuai servermu dan letakkan file PHP di folder htdocs xampp
const char* submitUrl = "http://192.168.223.209:3000/api/submit";

const int trigPin = 12;
const int echoPin = 13;

int currentPlayerId = -1;
int measuredDistance = 150;

void fetchLatestUserId() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(getIdUrl);

        int httpCode = http.GET();
        if (httpCode == 200) {
            String payload = http.getString();
            Serial.println("Response: " + payload);

            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, payload);

            if (!error) {
                currentPlayerId = doc["user_id"];
                String username = doc["username"];
                Serial.printf("✅ Dapat ID terbaru: %d (%s)\n", currentPlayerId, username.c_str());
            } else {
                Serial.println("❌ JSON parsing error");
            }
        } else {
            Serial.printf("❌ Gagal GET (%d)\n", httpCode);
        }

        http.end();
    } else {
        Serial.println("WiFi belum tersambung");
    }
}

int measureDistance() {
    long duration;
    float distance;

    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    duration = pulseIn(echoPin, HIGH);
    distance = duration * 0.032 / 2;  // Menghitung jarak dalam cm
    Serial.printf("Jarak terukur: %.2f cm\n", distance);
    return static_cast<int>(distance);
}

void sendDataToServer(int playerId, int distance) {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(submitUrl);
        http.addHeader("Content-Type", "application/json");

        DynamicJsonDocument postData(256);
        postData["playerId"] = playerId;
        postData["distance"] = distance;

        String jsonStr;
        serializeJson(postData, jsonStr);

        int httpResponseCode = http.POST(jsonStr);
        if (httpResponseCode > 0) {
            Serial.printf("Terkirim (%d): %s\n", httpResponseCode, http.getString().c_str());
        } else {
            Serial.printf("Gagal kirim: %d\n", httpResponseCode);
        }

        http.end();
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);
    pinMode(LED_BUILTIN, OUTPUT);  // LED untuk indikator
    pinMode(32, OUTPUT);           // LED untuk indikator

    digitalWrite(LED_BUILTIN, HIGH);  // Nyalakan LED awalnya
    digitalWrite(32, HIGH);           // Nyalakan LED awalnya
    WiFi.begin(ssid, password);

    Serial.print("Menyambungkan WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\n✅ WiFi Tersambung");

    fetchLatestUserId();  // Ambil user_id saat awal

    button.begin();
    button.onPressed([]() {
        fetchLatestUserId();                   // Ambil user_id saat awal
        measuredDistance = measureDistance();  // Ukur jarak
        Serial.printf("📏 Jarak terukur: %d cm\n", measuredDistance);

        if (currentPlayerId > 0) {
            sendDataToServer(currentPlayerId, measuredDistance);
        } else {
            Serial.println("❗ user_id belum didapatkan");
        }
        digitalWrite(LED_BUILTIN, LOW);   // Matikan LED sebagai indikator
        digitalWrite(32, LOW);            // Matikan LED sebagai indikator
        delay(4000);                      // Delay untuk menghindari spam
        digitalWrite(LED_BUILTIN, HIGH);  // Nyalakan LED
        digitalWrite(32, HIGH);           // Nyalakan LED
    });
}

void loop() {
    button.read();
}
