// Client-side JavaScript for handling game logic and communication with the server
const socket = io.connect('https://cool-accessible-pint.glitch.me');

// Directions based on sprite sheet layout
const DIRECTIONS = {
  DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3, DOWN_LEFT: 4, DOWN_RIGHT: 5, UP_LEFT: 6, UP_RIGHT: 7
};

// Game world configuration
const TILE_SIZE = 64;
const WORLD_WIDTH = 50;
const WORLD_HEIGHT = 50;

// Tile types
const TILE_FLOOR = 0;
const TILE_WALL = 1;
const TILE_DOOR = 2;

// Game world array
let gameWorld = [];

// Player object definition
let player = {
  id: null, x: 400, y: 300, width: 64, height: 64,
  direction: DIRECTIONS.DOWN, moving: false, sprite: new Image(),
  frameIndex: 0, frameCount: 8
};
player.sprite.src = 'Images/player_sprite_frames.png';
player.sprite.onload = () => requestAnimationFrame(gameLoop);
player.sprite.onerror = e => console.error("Failed to load player sprite:", e);

let players = {}, playerMessages = {}, keysPressed = {};
const movementSpeed = 150, animationSpeed = 0.1, canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
let lastRenderTime = 0, animationTimer = 0, zoomLevel = 1;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Initialize the game world
function initializeGameWorld() {
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    gameWorld[y] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
      if (x === 0 || x === WORLD_WIDTH - 1 || y === 0 || y === WORLD_HEIGHT - 1) {
        gameWorld[y][x] = TILE_WALL;
      } else {
        gameWorld[y][x] = TILE_FLOOR;
      }
    }
  }
  
  // Create rooms by adding walls and doors
  // Example: Creating a room in the center
  for (let y = 10; y < 20; y++) {
    for (let x = 10; x < 20; x++) {
      if (y === 10 || y === 19 || x === 10 || x === 19) {
        gameWorld[y][x] = TILE_WALL;
      }
    }
  }
  gameWorld[15][10] = TILE_DOOR;
}

// Game loop for rendering and updating
function gameLoop(timeStamp) {
  const deltaTime = (timeStamp - lastRenderTime) / 1000;
  requestAnimationFrame(gameLoop);
  if (player.id) {
    updatePlayerPosition(deltaTime);
    handleAnimation(deltaTime);
  }
  updateCamera();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPlayers();
  lastRenderTime = timeStamp;
}

// Update camera position and scaling based on window size
function updateCamera() {
  const aspectRatio = canvas.width / canvas.height;
  const targetAspectRatio = WORLD_WIDTH / WORLD_HEIGHT;

  if (aspectRatio > targetAspectRatio) {
    // Window is wider than the game world
    zoomLevel = canvas.height / (WORLD_HEIGHT * TILE_SIZE);
  } else {
    // Window is taller than the game world
    zoomLevel = canvas.width / (WORLD_WIDTH * TILE_SIZE);
  }
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
  const newX = player.x + dx * deltaTime;
  const newY = player.y + dy * deltaTime;

  // Check collision with walls
  const tileX = Math.floor(newX / TILE_SIZE);
  const tileY = Math.floor(newY / TILE_SIZE);
  if (gameWorld[tileY][tileX] !== TILE_WALL) {
    player.x = newX;
    player.y = newY;
  }

  // Emit movement if position or frameIndex changed
  if (newX !== player.x || newY !== player.y || player.frameIndex !== player.lastFrameIndex) {
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

// Draw the game world
function drawBackground() {
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoomLevel, zoomLevel);
  ctx.translate(-player.x, -player.y);

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const tile = gameWorld[y][x];
      switch (tile) {
        case TILE_FLOOR:
          ctx.fillStyle = '#ccc';
          break;
        case TILE_WALL:
          ctx.fillStyle = '#666';
          break;
        case TILE_DOOR:
          ctx.fillStyle = '#a52a2a';
          break;
      }
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  ctx.restore();
}

// Render players on canvas
function drawPlayers() {
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoomLevel, zoomLevel);
  ctx.translate(-player.x, -player.y);

  Object.values(players).forEach(drawPlayer);
  drawPlayer(player); // Draw current player last to be on top

  ctx.restore();
}

// Draw a single player on the canvas
function drawPlayer(p) {
  if (!p.sprite.complete || p.frameIndex === undefined) return;
  const srcX = p.frameIndex * p.width;
  const srcY = p.direction * p.height;
  const screenX = p.x;
  const screenY = p.y;

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
    players[data.playerId].x = data.x;
    players[data.playerId].y = data.y;
    players[data.playerId].direction = data.direction;
    players[data.playerId].frameIndex = data.frameIndex;
  }
});

socket.on('playerDisconnected', id => delete players[id]);
socket.on('chatMessage', data => {
  playerMessages[data.playerId] = data.message;
  setTimeout(() => delete playerMessages[data.playerId], 5000);
});

// Initialize the game world
initializeGameWorld();

requestAnimationFrame(gameLoop);