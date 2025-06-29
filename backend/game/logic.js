/**
 * Menghasilkan pertanyaan baru dengan target jarak dan toleransi acak.
 * @returns {object} Objek pertanyaan berisi { text, answer, tolerance }.
 */
function generateQuestion() {
  // Generate target jarak acak, misalnya antara 5 cm sampai 100 cm
  const targetDistance = Math.floor(Math.random() * 100) + 5;

  // Generate toleransi acak antara 1 sampai 5 cm
  // Rumus: Math.floor(Math.random() * (max - min + 1)) + min
  const tolerance = Math.floor(Math.random() * 5) + 1;

  // Buat teks pertanyaan yang lebih sesuai dengan logika baru
  const questionText = `Measure the distance about ${targetDistance} cm (tolerance ${tolerance} cm)`;

  // Kembalikan objek pertanyaan lengkap
  return {
    text: questionText,
    answer: targetDistance, // Ini adalah target utamanya
    tolerance: tolerance, // Ini adalah rentang toleransinya
  };
}

/**
 * Memeriksa apakah hasil pengukuran dari ESP32 berada dalam rentang toleransi.
 * @param {object} question - Objek pertanyaan dari generateQuestion().
 * @param {number} measuredDistance - Jarak yang diukur oleh ESP32.
 * @returns {boolean} - True jika jawaban benar, false jika salah.
 */
function checkAnswer(question, measuredDistance) {
  // Hitung selisih/jarak absolut antara target jawaban dan hasil ukur.
  // Math.abs() digunakan untuk memastikan hasilnya selalu positif (nilai mutlak).
  const difference = Math.abs(question.answer - measuredDistance);

  // Bandingkan selisih tersebut dengan toleransi yang ada di objek pertanyaan.
  // Jawaban benar jika selisihnya lebih kecil atau sama dengan toleransi.
  // Contoh:
  // Target = 100, Toleransi = 5. Selisih (difference) harus <= 5.
  // Jika hasil ukur 97, selisihnya 3. 3 <= 5, maka BENAR.
  // Jika hasil ukur 106, selisihnya 6. 6 > 5, maka SALAH.
  const isWithinTolerance = difference <= question.tolerance;

  // Kembalikan hasilnya
  return isWithinTolerance;
}

// Export fungsi agar bisa digunakan di index.js
module.exports = {
  generateQuestion,
  checkAnswer,
};
