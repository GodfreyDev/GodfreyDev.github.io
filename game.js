// Define the player object outside of the event listener to have a global scope
let player = {
    x: 0, // Temporary values, will be set after canvas loads
    y: 0,
    width: 16,
    height: 16,
    speed: 2,
};

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Initialize the player's position to be the center of the canvas
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height / 2 - player.height / 2;

    function drawPlayer() {
        ctx.fillStyle = '#FF0000'; // Player color
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
        drawPlayer();
        requestAnimationFrame(gameLoop); // Continuously run the game loop
    }

    // Start the game loop
    gameLoop();
});

// Handle keyboard controls
document.addEventListener('keydown', function(event) {
    switch (event.key) {
        case 'ArrowLeft':
            player.x -= player.speed;
            break;
        case 'ArrowRight':
            player.x += player.speed;
            break;
        case 'ArrowUp':
            player.y -= player.speed;
            break;
        case 'ArrowDown':
            player.y += player.speed;
            break;
    }
});

// Prevent the player from moving outside the canvas boundaries
function keepPlayerInBounds() {
    const canvas = document.getElementById('gameCanvas');
    if (player.x < 0) {
        player.x = 0;
    } else if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }

    if (player.y < 0) {
        player.y = 0;
    } else if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
    }
}
