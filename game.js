const socket = io.connect('https://cool-accessible-pint.glitch.me');

let player = {
    id: null,
    x: 400,
    y: 300,
    width: 32,
    height: 32,
    color: 'red'
};
let players = {};
const movementSpeed = 150; // pixels per second
let zoomLevel = 1; // 1 is default, <1 is zoomed out, >1 is zoomed in
const keysPressed = {};
let playerMessages = {}; // Store recent messages from players

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

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
    const messageInput = document.getElementById('chatInput');
    const message = messageInput.value;
    socket.emit('chatMessage', { message: message });
    messageInput.value = ''; // Clear the input field after sending
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

        // Draw player
        ctx.fillStyle = p.color;
        ctx.fillRect(screenX, screenY, p.width, p.height);

        // Draw player's name
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '14px Arial';
        ctx.fillText(p.name, screenX + p.width / 2, screenY - 10);

        // Display chat message above the player
        if (playerMessages[p.id]) {
            ctx.fillStyle = 'yellow'; // Color for chat messages
            ctx.fillText(playerMessages[p.id], screenX + p.width / 2, screenY - 25); // Adjust for message position
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

socket.on('chatMessage', (data) => {
    // Now data should include player name alongside the message
    const playerName = players[data.playerId].name; // Assuming player's name is sent from the server
    playerMessages[data.playerId] = playerName + ": " + data.message; // Display name with the message
    setTimeout(() => {
        delete playerMessages[data.playerId];
    }, 5000); // Messages disappear after 5 seconds
});

requestAnimationFrame(gameLoop);
