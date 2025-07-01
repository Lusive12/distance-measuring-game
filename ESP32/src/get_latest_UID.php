<?php
require 'koneksi.php';

header('Content-Type: application/json');

$sql = "SELECT id, username FROM players ORDER BY id DESC LIMIT 1";
$result = $conn->query($sql);

if ($row = $result->fetch_assoc()) {
    echo json_encode([
                'user_id' => $row['id'],
        'username' => $row['username']
    ]);
} else {
    echo json_encode(['status' => 'not_found']);
}

$conn->close();
?>
