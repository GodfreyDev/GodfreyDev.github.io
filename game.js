// Adjusted client-side JavaScript for game.js
const socket = io.connect('https://cool-accessible-pint.glitch.me');

// Define constants for direction indexes based on your sprite sheet layout
const DIRECTIONS = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
  DOWN_LEFT: 4,
  DOWN_RIGHT: 5,
  UP_LEFT: 6,
  UP_RIGHT: 7
};

let player = {
  id: null,
  x: 400,
  y: 300,
  width: 64, // Match the sprite's frame size
  height: 64,
  direction: DIRECTIONS.DOWN, // Default direction
  moving: false, // Track if the player is moving
  sprite: new Image(),
  frameIndex: 0, // Current frame index in the animation
  frameCount: 8, // Total frames per direction
};

player.sprite.src = 'Images/player_sprite.png'; // Make sure this path is correct
player.sprite.onload = () => {
    console.log("Player sprite loaded successfully.");
    requestAnimationFrame(gameLoop); // Start the game loop after the sprite has loaded
};
player.sprite.onerror = (e) => {
    console.error("Failed to load player sprite:", e);
};

let players = {};
const movementSpeed = 150;
let zoomLevel = 1;
const keysPressed = {};
let playerMessages = {};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let lastRenderTime = 0;
const animationSpeed = 0.1; // Time in seconds each frame is shown
let animationTimer = 0; // Timer to control animation speed

function gameLoop(timeStamp) {
  requestAnimationFrame(gameLoop);
  const deltaTime = (timeStamp - lastRenderTime) / 1000;
  if (player.id) {
    updatePlayerPosition(deltaTime);
    handleAnimation(deltaTime); // Handle player animation based on movement
  }
  drawPlayers();
  lastRenderTime = timeStamp;
}

function sendMessage() {
  const messageInput = document.getElementById('chatInput');
  const message = messageInput.value;
  socket.emit('chatMessage', { message: message });
  messageInput.value = '';
}

function updatePlayerPosition(deltaTime) {
  let dx = 0;
  let dy = 0;
  player.moving = false; // Reset moving status

  if (keysPressed['a'] || keysPressed['ArrowLeft']) {dx -= movementSpeed * deltaTime; player.moving = true;}
  if (keysPressed['d'] || keysPressed['ArrowRight']) {dx += movementSpeed * deltaTime; player.moving = true;}
  if (keysPressed['w'] || keysPressed['ArrowUp']) {dy -= movementSpeed * deltaTime; player.moving = true;}
  if (keysPressed['s'] || keysPressed['ArrowDown']) {dy += movementSpeed * deltaTime; player.moving = true;}

  // Update direction based on movement
  if (dy < 0 && dx < 0) player.direction = DIRECTIONS.UP_LEFT;
  else if (dy < 0 && dx > 0) player.direction = DIRECTIONS.UP_RIGHT;
  else if (dy > 0 && dx < 0) player.direction = DIRECTIONS.DOWN_LEFT;
  else if (dy > 0 && dx > 0) player.direction = DIRECTIONS.DOWN_RIGHT;
  else if (dy < 0) player.direction = DIRECTIONS.UP;
  else if (dy > 0) player.direction = DIRECTIONS.DOWN;
  else if (dx < 0) player.direction = DIRECTIONS.LEFT;
  else if (dx > 0) player.direction = DIRECTIONS.RIGHT;

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

// Handle animation based on movement
function handleAnimation(deltaTime) {
  if (player.moving) {
    animationTimer += deltaTime;
    if (animationTimer >= animationSpeed) {
      player.frameIndex = (player.frameIndex + 1) % player.frameCount;
      animationTimer = 0;
    }
  } else {
    player.frameIndex = 0; // Reset to the standing position when not moving
  }
}


function drawPlayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);

    // Draw other players
    Object.values(players).forEach(drawPlayer);

    // Draw the current player
    drawPlayer(player);

    ctx.restore();
}

function drawPlayer(p) {
    if (!p.sprite.complete) return; // Ensure the sprite image is loaded

    const srcX = p.frameIndex * p.width;
    const srcY = p.direction * p.height;
    const screenX = p.x - player.x + canvas.width / 2 / zoomLevel;
    const screenY = p.y - player.y + canvas.height / 2 / zoomLevel;

    ctx.drawImage(p.sprite, srcX, srcY, p.width, p.height, screenX, screenY, p.width, p.height);

    // Draw name and messages
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText(p.name, screenX + p.width / 2, screenY - 10);
    if (playerMessages[p.id]) {
        ctx.fillStyle = 'yellow';
        ctx.fillText(playerMessages[p.id], screenX + p.width / 2, screenY - 25);
    }
}


document.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
});

// Socket event listeners
socket.on('currentPlayers', (playersData) => {
    players = playersData;
    Object.values(players).forEach(p => {
        p.sprite = new Image();
        p.sprite.src = player.sprite.src; // Assuming all players use the same sprite sheet
        p.frameIndex = 0;
        p.direction = DIRECTIONS.DOWN;
    });
    if (socket.id in players) {
        player.id = socket.id;
        player.name = players[socket.id].name; // Assuming player names are managed server-side
    }
});

socket.on('newPlayer', (playerData) => {
    players[playerData.id] = playerData;
    players[playerData.id].sprite = new Image();
    players[playerData.id].sprite.src = player.sprite.src;
    players[playerData.id].frameIndex = 0;
    players[playerData.id].direction = DIRECTIONS.DOWN;
});

socket.on('playerMoved', (playerData) => {
    if (players[playerData.playerId]) {
        players[playerData.playerId].x = playerData.x;
        players[playerData.playerId].y = playerData.y;
        players[playerData.playerId].direction = playerData.direction;
    }
});

socket.on('playerDisconnected', (playerId) => {
    delete players[playerId];
});

socket.on('chatMessage', (data) => {
    playerMessages[data.playerId] = data.message;
    setTimeout(() => {
        delete playerMessages[data.playerId];
    }, 5000); // Messages disappear after 5 seconds
});

requestAnimationFrame(gameLoop);
