// Client-side JavaScript for handling game logic and communication with the server
const socket = io.connect('https://cool-accessible-pint.glitch.me');

const config = {
  directions: { DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3, DOWN_LEFT: 4, DOWN_RIGHT: 5, UP_LEFT: 6, UP_RIGHT: 7 },
  tileSize: 64,
  world: { width: 200, height: 200 },
  camera: { width: 30, height: 20 },
  tiles: { FLOOR: 0, WALL: 1, DOOR: 2 },
  animationSpeed: 1
};

const state = {
  gameWorld: [],
  players: {},
  playerMessages: {},
  keysPressed: {},
  tileImages: {},
  loadedImages: 0,
  lastRenderTime: 0
};

const player = {
  id: null, x: 400, y: 300, width: 64, height: 64,
  direction: config.directions.DOWN, moving: false, sprite: new Image(),
  frameIndex: 0, frameCount: 3, animationTimer: 0
};
player.sprite.src = 'Images/player_sprite_frames.png';
player.sprite.onload = () => startGame();
player.sprite.onerror = e => console.error("Failed to load player sprite:", e);

const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');
canvas.width = config.camera.width * config.tileSize;
canvas.height = config.camera.height * config.tileSize;

function startGame() {
    initializeGameWorld(); // Ensure the game world is initialized before starting
    loadTileImages();
  }
  

function loadTileImages() {
  Object.values(config.tiles).forEach(type => {
    const img = new Image();
    img.src = `Images/tile_${type}.png`;
    img.onload = () => {
      state.tileImages[type] = img;
      state.loadedImages++;
      if (state.loadedImages === Object.keys(config.tiles).length) {
        requestAnimationFrame(gameLoop);
      }
    };
    img.onerror = () => console.error(`Failed to load tile image: Images/tile_${type}.png`);
  });
}

function gameLoop(timestamp) {
  const deltaTime = (timestamp - state.lastRenderTime) / 1000;
  requestAnimationFrame(gameLoop);

  if (player.id) {
    updatePlayerPosition(deltaTime);
    handleAnimation(deltaTime);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPlayers();
  state.lastRenderTime = timestamp;
}

// Adjust player position based on input, considering deltaTime for smooth movement across devices
function updatePlayerPosition(deltaTime) {
    let dx = 0, dy = 0;
    player.moving = false;
  
    if (state.keysPressed['a'] || state.keysPressed['ArrowLeft']) { dx -= 1; player.moving = true; }
    if (state.keysPressed['d'] || state.keysPressed['ArrowRight']) { dx += 1; player.moving = true; }
    if (state.keysPressed['w'] || state.keysPressed['ArrowUp']) { dy -= 1; player.moving = true; }
    if (state.keysPressed['s'] || state.keysPressed['ArrowDown']) { dy += 1; player.moving = true; }
  
    // Adjust direction based on movement
    adjustPlayerDirection(dx, dy);
  
    // Calculate new position considering movement speed
    const movementSpeed = 250; // Pixels per second
    const newX = player.x + dx * movementSpeed * deltaTime;
    const newY = player.y + dy * movementSpeed * deltaTime;
  
    // Check for wall collision
    if (!isCollision(newX, newY)) {
      player.x = newX;
      player.y = newY;
    }
  
    // Emit movement if position or frameIndex changed
    if (dx !== 0 || dy !== 0) {
      socket.emit('playerMovement', { x: player.x, y: player.y, direction: player.direction, frameIndex: player.frameIndex });
    }
  }
  
  // Adjust player direction based on dx, dy movement
  function adjustPlayerDirection(dx, dy) {
    if (dy < 0 && dx < 0) player.direction = config.directions.UP_LEFT;
    else if (dy < 0 && dx > 0) player.direction = config.directions.UP_RIGHT;
    else if (dy > 0 && dx < 0) player.direction = config.directions.DOWN_LEFT;
    else if (dy > 0 && dx > 0) player.direction = config.directions.DOWN_RIGHT;
    else if (dy < 0) player.direction = config.directions.UP;
    else if (dy > 0) player.direction = config.directions.DOWN;
    else if (dx < 0) player.direction = config.directions.LEFT;
    else if (dx > 0) player.direction = config.directions.RIGHT;
  }
  
  // Check if new position collides with a wall
  function isCollision(newX, newY) {
    const tileX = Math.floor(newX / config.tileSize);
    const tileY = Math.floor(newY / config.tileSize);
    return state.gameWorld[tileY] && state.gameWorld[tileY][tileX] === config.tiles.WALL;
  }
  
  // Handle animation based on player movement
  function handleAnimation(deltaTime) {
    if (player.moving) {
      player.animationTimer += deltaTime;
      if (player.animationTimer >= config.animationSpeed) {
        player.frameIndex = (player.frameIndex + 1) % player.frameCount;
        player.animationTimer %= config.animationSpeed;
      }
    } else {
      player.frameIndex = 0; // Reset animation frame if not moving
      player.animationTimer = 0;
    }
  }
  
  // Draw the game world
  function drawBackground() {
    const cameraX = player.x - (canvas.width / 2);
    const cameraY = player.y - (canvas.height / 2);
  
    for (let y = 0; y < config.camera.height; y++) {
      for (let x = 0; x < config.camera.width; x++) {
        const worldX = Math.floor(cameraX / config.tileSize) + x;
        const worldY = Math.floor(cameraY / config.tileSize) + y;
  
        if (worldX >= 0 && worldX < config.world.width && worldY >= 0 && worldY < config.world.height) {
          const tile = state.gameWorld[worldY][worldX];
          ctx.drawImage(state.tileImages[tile], x * config.tileSize, y * config.tileSize, config.tileSize, config.tileSize);
        } else {
          // Fallback fill if out of world bounds
          ctx.fillStyle = '#000';
          ctx.fillRect(x * config.tileSize, y * config.tileSize, config.tileSize, config.tileSize);
        }
      }
    }
  }
  
  // Render players on canvas
  function drawPlayers() {
    Object.values(state.players).forEach(drawPlayer);
    drawPlayer(player); // Draw current player last to be on top
  }
  
  // Draw a single player
  function drawPlayer(p) {
    if (!p.sprite.complete || p.frameIndex === undefined) return;
    const srcX = p.frameIndex * p.width;
    const srcY = p.direction * p.height;
    const screenX = p.x - player.x + (canvas.width / 2) - (p.width / 2);
    const screenY = p.y - player.y + (canvas.height / 2) - (p.height / 2);
  
    ctx.drawImage(p.sprite, srcX, srcY, p.width, p.height, screenX, screenY, p.width, p.height);
    if (state.playerMessages[p.id]) {
      // Display player messages above their heads
      displayPlayerMessages(p, screenX, screenY);
    }
  }
  
  // Display player messages
  function displayPlayerMessages(p, screenX, screenY) {
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = '16px Arial';
    ctx.fillText(p.name, screenX + p.width / 2, screenY - 20);
    ctx.fillStyle = 'yellow';
    ctx.fillText(state.playerMessages[p.id], screenX + p.width / 2, screenY - 40);
  }
  

document.addEventListener('keydown', e => state.keysPressed[e.key] = true);
document.addEventListener('keyup', e => delete state.keysPressed[e.key]);

socket.on('currentPlayers', playersData => {
    Object.values(playersData).forEach(p => {
      if (!state.players[p.id]) { // New player
        p.sprite = new Image();
        p.sprite.src = player.sprite.src; // Assuming all players use the same sprite
        p.sprite.onload = () => drawPlayers(); // Redraw players when a new sprite is loaded
      }
      state.players[p.id] = p; // Update or add player data
    });
  });
  
  socket.on('newPlayer', playerData => {
    const newPlayer = { ...playerData, sprite: new Image() };
    newPlayer.sprite.src = player.sprite.src;
    state.players[playerData.id] = newPlayer;
  });
  
  socket.on('playerMoved', data => {
    if (state.players[data.playerId]) {
      const p = state.players[data.playerId];
      p.x = data.x;
      p.y = data.y;
      p.direction = data.direction;
      p.frameIndex = data.frameIndex;
    }
  });
  
  socket.on('playerDisconnected', id => {
    delete state.players[id]; // Remove player from the state
  });
  
  socket.on('chatMessage', data => {
    state.playerMessages[data.playerId] = data.message; // Show message
    setTimeout(() => delete state.playerMessages[data.playerId], 5000); // Remove message after 5 seconds
  });
  

  function initializeGameWorld() {
    for (let y = 0; y < config.world.height; y++) {
      state.gameWorld[y] = [];
      for (let x = 0; x < config.world.width; x++) {
        // Example: Simple boundary walls
        if (x === 0 || x === config.world.width - 1 || y === 0 || y === config.world.height - 1) {
          state.gameWorld[y][x] = config.tiles.WALL;
        } else {
          state.gameWorld[y][x] = config.tiles.FLOOR;
        }
      }
    }
    // Further initialization like generating rooms or obstacles can be added here
  }
  
