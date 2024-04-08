const socket = io.connect('https://cool-accessible-pint.glitch.me');


let player = {
    id: null,
    x: 400,
    y: 300,
    width: 32,
    height: 32,
    color: 'red',
    health: 100
};
let players = {};
let projectiles = [];

const movementSpeed = 150; // pixels per second
let zoomLevel = 1; // 1 is default, <1 is zoomed out, >1 is zoomed in
const keysPressed = {};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800; // Consider making dynamic based on window size or desired gameplay area
canvas.height = 600;

let lastRenderTime = 0;

function gameLoop(timeStamp) {
    requestAnimationFrame(gameLoop);
    const deltaTime = (timeStamp - lastRenderTime) / 1000;
    if (player.id) {
        updatePlayerPosition(deltaTime);
    }
    drawPlayers();
    drawProjectiles();
    lastRenderTime = timeStamp;
}

function updatePlayerPosition(deltaTime) {
    let dx = 0;
    let dy = 0;

    if (keysPressed['ArrowLeft']) dx -= movementSpeed * deltaTime;
    if (keysPressed['ArrowRight']) dx += movementSpeed * deltaTime;
    if (keysPressed['ArrowUp']) dy -= movementSpeed * deltaTime;
    if (keysPressed['ArrowDown']) dy += movementSpeed * deltaTime;

    // Adjust for zoom level
    dx /= zoomLevel;
    dy /= zoomLevel;

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX !== player.x || newY !== player.y) {
        player.x = newX;
        player.y = newY;
        socket.emit('playerMovement', { x: player.x, y: player.y });
    }
}

function drawPlayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); // Save the default state
    ctx.scale(zoomLevel, zoomLevel); // Scale everything based on the current zoom level
    Object.values(players).forEach(p => {
        ctx.fillStyle = p.color;
        // Adjust drawing positions to make the player appear in the center
        const x = p.x - player.x + canvas.width / 2 / zoomLevel;
        const y = p.y - player.y + canvas.height / 2 / zoomLevel;
        ctx.fillRect(x, y, p.width, p.height);
    });
    ctx.restore(); // Restore to the default state to prevent scaling issues in other drawing functions
}

function drawProjectiles() {
    ctx.save(); // Save the current drawing context
    ctx.scale(zoomLevel, zoomLevel); // Apply zoom level

    // Calculate the center of the screen relative to the player
    const centerX = canvas.width / 2 / zoomLevel;
    const centerY = canvas.height / 2 / zoomLevel;

    projectiles.forEach(projectile => {
        ctx.fillStyle = 'yellow';

        // Calculate projectile's position relative to the center (player's position)
        const projectileX = centerX + (projectile.x - player.x);
        const projectileY = centerY + (projectile.y - player.y);

        // Draw projectile
        ctx.fillRect(projectileX, projectileY, 5, 10);
    });

    ctx.restore(); // Restore the drawing context
}

function shoot() {
    // Example shooting mechanism - shoots directly upwards
    const dx = 0; // Change dx for shooting in different horizontal directions
    const dy = -5; // Negative for shooting up, positive for down. Adjust for speed and direction
    
    // Emit the shootProjectile event to the server with the calculated dx, dy
    socket.emit('shootProjectile', { dx: dx, dy: dy });
}


// Add zoom in and zoom out functionality
document.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
    if (e.key === " " || e.key === "Spacebar") {
        shoot();
    } else if (e.key === 'z') {
        zoomLevel = Math.max(0.5, zoomLevel - 0.1); // Zoom out
    } else if (e.key === 'x') {
        zoomLevel = Math.min(2, zoomLevel + 0.1); // Zoom in
    }
});

document.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
});


socket.on('currentPlayers', (playersData) => {
    players = playersData;
    if (socket.id in players) {
        player.id = socket.id;
    }
});

socket.on('newPlayer', (playerData) => {
    players[playerData.id] = playerData;
});

socket.on('playerMoved', (playerData) => {
    if (players[playerData.playerId]) {
        players[playerData.playerId].x = playerData.x;
        players[playerData.playerId].y = playerData.y;
    }
});

socket.on('playerDisconnected', (playerId) => {
    delete players[playerId];
});

socket.on('updateProjectiles', (updatedProjectiles) => {
    projectiles = updatedProjectiles;
});

socket.on('playerDied', (data) => {
    if (data.playerId === player.id) {
        // The current player has died, refresh the game
        window.location.reload(); // This refreshes the page
    } else {
        // Another player died, handle accordingly (if needed)
        console.log(`Player ${data.playerId} has died.`);
    }
});

requestAnimationFrame(gameLoop);
