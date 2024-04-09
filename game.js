// Client-side JavaScript for handling game logic and communication with the server
const socket = io.connect('https://cool-accessible-pint.glitch.me');

// Directions based on sprite sheet layout
const DIRECTIONS = {
  DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3, DOWN_LEFT: 4, DOWN_RIGHT: 5, UP_LEFT: 6, UP_RIGHT: 7
};

// Player object definition
let player = {
  id: null, x: 400, y: 300, width: 64, height: 64,
  direction: DIRECTIONS.DOWN, moving: false, sprite: new Image(),
  frameIndex: 0, frameCount: 8
};
player.sprite.src = 'Images/player_sprite_frames.png';
player.sprite.onload = () => requestAnimationFrame(gameLoop);
player.sprite.onerror = e => console.error("Failed to load player sprite:", e);

let background = {
image: new Image(),
x: 0,
y: 0,
width: 800,
height: 600
};
background.image.src = 'Images/background.png';
background.image.onload = () => requestAnimationFrame(gameLoop);
background.image.onerror = e => console.error("Failed to load background image:", e);

let players = {}, playerMessages = {}, keysPressed = {};
const movementSpeed = 150, animationSpeed = 0.1, canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
let lastRenderTime = 0, animationTimer = 0, zoomLevel = 1;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game loop for rendering and updating
function gameLoop(timeStamp) {
  const deltaTime = (timeStamp - lastRenderTime) / 1000;
  requestAnimationFrame(gameLoop);
  if (player.id) {
    updatePlayerPosition(deltaTime);
    handleAnimation(deltaTime);
  }
  drawPlayers();
  lastRenderTime = timeStamp;
}

// Send chat message to the server
function sendMessage() {
  const messageInput = document.getElementById('chatInput'), message = messageInput.value.trim();
  if (message) {
    socket.emit('chatMessage', { message });
    messageInput.value = '';
  }
}

// Update player position based on input
function updatePlayerPosition(deltaTime) {
    let dx = 0, dy = 0;
    player.moving = false;
  
    // Determine direction and set moving flag
    if (keysPressed['a'] || keysPressed['ArrowLeft']) { dx -= movementSpeed; player.moving = true; }
    if (keysPressed['d'] || keysPressed['ArrowRight']) { dx += movementSpeed; player.moving = true; }
    if (keysPressed['w'] || keysPressed['ArrowUp']) { dy -= movementSpeed; player.moving = true; }
    if (keysPressed['s'] || keysPressed['ArrowDown']) { dy += movementSpeed; player.moving = true; }
  
    // Adjust direction based on movement
    if (dy < 0 && dx < 0) player.direction = DIRECTIONS.UP_LEFT;
    else if (dy < 0 && dx > 0) player.direction = DIRECTIONS.UP_RIGHT;
    else if (dy > 0 && dx < 0) player.direction = DIRECTIONS.DOWN_LEFT;
    else if (dy > 0 && dx > 0) player.direction = DIRECTIONS.DOWN_RIGHT;
    else if (dy < 0) player.direction = DIRECTIONS.UP;
    else if (dy > 0) player.direction = DIRECTIONS.DOWN;
    else if (dx < 0) player.direction = DIRECTIONS.LEFT;
    else if (dx > 0) player.direction = DIRECTIONS.RIGHT;
  
    // Apply zoom adjustment and update position
    dx /= zoomLevel; dy /= zoomLevel;
    const newX = background.x - dx * deltaTime;
    const newY = background.y - dy * deltaTime;
  
    // Check if background is within the bounds of the canvas
    if (newX >= canvas.width - background.width && newX <= 0 &&
        newY >= canvas.height - background.height && newY <= 0) {
      background.x = newX;
      background.y = newY;
      socket.emit('playerMovement', { x: player.x, y: player.y, direction: player.direction, frameIndex: player.frameIndex });
    }
  
    // Emit movement if position or frameIndex changed
    if (newX !== background.x || newY !== background.y || player.frameIndex !== player.lastFrameIndex) {
      background.x = newX;
      background.y = newY;
      player.lastFrameIndex = player.frameIndex;
      socket.emit('playerMovement', { x: player.x, y: player.y, direction: player.direction, frameIndex: player.frameIndex });
    }
  }

// Handle animation based on player movement
function handleAnimation(deltaTime) {
    if (player.moving) {
      animationTimer += deltaTime;
      if (animationTimer >= animationSpeed) {
        player.frameIndex = (player.frameIndex + 1) % player.frameCount;
        animationTimer = 0;
      }
    } else {
      player.frameIndex = 0; // Reset animation frame if not moving
    }
    player.frameIndex = Math.max(0, Math.min(player.frameIndex, player.frameCount - 1)); // Ensure frameIndex is within valid range
  }

// Render players on canvas
function drawPlayers() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
  
    // Draw background
    ctx.drawImage(background.image, background.x, background.y, background.width, background.height);
  
    Object.values(players).forEach(drawPlayer);
    drawPlayer(player); // Draw current player last to be on top
    ctx.restore();
  }

// Draw a single player on the canvas
function drawPlayer(p) {
    if (!p.sprite.complete || p.frameIndex === undefined) return; // Skip drawing if sprite not loaded or frameIndex is undefined
    const srcX = p.frameIndex * p.width;
    const srcY = p.direction * p.height;
    const screenX = p.x - player.x + canvas.width / 2 / zoomLevel;
    const screenY = p.y - player.y + canvas.height / 2 / zoomLevel;
  
    ctx.drawImage(p.sprite, srcX, srcY, p.width, p.height, screenX, screenY, p.width, p.height);
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = '14px Arial';
    ctx.fillText(p.name, screenX + p.width / 2, screenY - 10);
    if (playerMessages[p.id]) {
      ctx.fillStyle = 'yellow';
      ctx.fillText(playerMessages[p.id], screenX + p.width / 2, screenY - 25);
    }
  }

// Keyboard event listeners for movement
document.addEventListener('keydown', e => keysPressed[e.key] = true);
document.addEventListener('keyup', e => delete keysPressed[e.key]);

// Socket event listeners for game state updates
socket.on('currentPlayers', playersData => {
  Object.values(playersData).forEach(p => { p.sprite = new Image(); p.sprite.src = player.sprite.src; });
  players = playersData;
  if (socket.id in players) {
    Object.assign(player, players[socket.id], { sprite: player.sprite });
  }
});

socket.on('newPlayer', playerData => {
  players[playerData.id] = Object.assign(playerData, { sprite: new Image(), frameIndex: 0, direction: DIRECTIONS.DOWN });
  players[playerData.id].sprite.src = player.sprite.src;
});

socket.on('playerMoved', data => {
    if (data.playerId in players) {
      Object.assign(players[data.playerId], data);
      players[data.playerId].frameIndex = data.frameIndex; // Update frameIndex separately
    }
  });

socket.on('playerDisconnected', id => delete players[id]);
socket.on('chatMessage', data => {
  playerMessages[data.playerId] = data.message;
  setTimeout(() => delete playerMessages[data.playerId], 5000);
});

requestAnimationFrame(gameLoop);