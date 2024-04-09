// Adjusted client-side JavaScript for game.js

const socket = io.connect('https://cool-accessible-pint.glitch.me');

let player = {
    id: null,
    x: 400,
    y: 300,
    width: 32,
    height: 32,
    color: 'red',
    sprite: new Image() // Use sprite images for players
};
player.sprite.src = 'Images/player_sprite.png'; // Set the source of the player sprite
let players = {};
const movementSpeed = 150;
let zoomLevel = 1;
const keysPressed = {};
let playerMessages = {};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// Make canvas responsive and high resolution
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let lastRenderTime = 0;

function gameLoop(timeStamp) {
    requestAnimationFrame(gameLoop);
    const deltaTime = (timeStamp - lastRenderTime) / 1000;
    if (player.id) {
        updatePlayerPosition(deltaTime);
    }
    drawPlayers();
    lastRenderTime = timeStamp;
}

function sendMessage() {
    const messageInput = document.getElementById('chatInput'); // Style this input for better appearance
    const message = messageInput.value;
    socket.emit('chatMessage', { message: message });
    messageInput.value = '';
}

function updatePlayerPosition(deltaTime) {
    let dx = 0;
    let dy = 0;

    if (keysPressed['ArrowLeft']) dx -= movementSpeed * deltaTime;
    if (keysPressed['ArrowRight']) dx += movementSpeed * deltaTime;
    if (keysPressed['ArrowUp']) dy -= movementSpeed * deltaTime;
    if (keysPressed['ArrowDown']) dy += movementSpeed * deltaTime;

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
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
    Object.values(players).forEach(p => {
        const screenX = p.x - player.x + canvas.width / 2 / zoomLevel;
        const screenY = p.y - player.y + canvas.height / 2 / zoomLevel;

        if (p.sprite) { // If the player has a sprite
            ctx.drawImage(p.sprite, screenX, screenY, p.width, p.height); // Draw the sprite instead of a rectangle
        } else {
            ctx.fillStyle = p.color;
            ctx.fillRect(screenX, screenY, p.width, p.height);
        }

        // Improved text styling
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(p.name, screenX + p.width / 2, screenY - 10);

        if (playerMessages[p.id]) {
            ctx.fillStyle = 'yellow';
            ctx.fillText(playerMessages[p.id], screenX + p.width / 2, screenY - 25);
        }
    });
    ctx.restore();
}

document.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
});

socket.on('currentPlayers', (playersData) => {
    players = playersData;
    Object.values(players).forEach(p => {
        p.sprite = new Image();
        p.sprite.src = 'Images/player_sprite.png'; // Assign sprites to each player
    });
    if (socket.id in players) {
        player.id = socket.id;
    }
});

socket.on('newPlayer', (playerData) => {
    players[playerData.id] = playerData;
    players[playerData.id].sprite = new Image();
    players[playerData.id].sprite.src = 'Images/player_sprite.png'; // Assign a sprite to the new player
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

socket.on('chatMessage', (data) => {
    // Simply use the message without prefixing it with the player's name
    playerMessages[data.playerId] = data.message;
    setTimeout(() => {
        delete playerMessages[data.playerId];
    }, 5000); // Messages disappear after 5 seconds
});

requestAnimationFrame(gameLoop);
