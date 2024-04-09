// Client-side JavaScript for handling game logic and communication with the server
const socket = io.connect('https://cool-accessible-pint.glitch.me');

// Directions based on sprite sheet layout
const DIRECTIONS = {
  DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3, DOWN_LEFT: 4, DOWN_RIGHT: 5, UP_LEFT: 6, UP_RIGHT: 7
};

// Game world configuration
const TILE_SIZE = 64;
const WORLD_WIDTH = 200;
const WORLD_HEIGHT = 200;

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
const movementSpeed = 200, animationSpeed = 0.1;
let lastRenderTime = 0, animationTimer = 0;

const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d');

// Function to adjust the canvas size dynamically
function adjustCanvasSize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
adjustCanvasSize(); // Adjust canvas size on initial load
window.addEventListener('resize', adjustCanvasSize); // Adjust canvas size on window resize

// Load tile images
const tileImages = {};
const tileTypes = [TILE_FLOOR, TILE_WALL, TILE_DOOR];
let loadedImages = 0;

tileTypes.forEach(type => {
  loadTileImage(type);
});

function loadTileImage(type) {
  tileImages[type] = new Image();
  tileImages[type].src = `Images/tile_${type}.png`;
  tileImages[type].onload = () => {
    loadedImages++;
    if (loadedImages === tileTypes.length) {
      requestAnimationFrame(gameLoop);
    }
  };
  tileImages[type].onerror = () => {
    console.error(`Failed to load tile image: Images/tile_${type}.png`);
  };
}

// Initialize the game world
initializeGameWorld();

// Improved camera movement for smooth background scrolling
let cameraX = 0;
let cameraY = 0;
const cameraEase = 0.1; // Adjust this value to change camera responsiveness

// Draw background function adjusted to account for camera movement
function drawBackground() {
    updateCameraPosition(); // Update camera position to follow player smoothly

    const startX = Math.floor(cameraX / TILE_SIZE);
    const startY = Math.floor(cameraY / TILE_SIZE);
    const offsetX = -(cameraX % TILE_SIZE);
    const offsetY = -(cameraY % TILE_SIZE);

    for (let y = 0; y < Math.ceil(canvas.height / TILE_SIZE) + 1; y++) {
        for (let x = 0; x < Math.ceil(canvas.width / TILE_SIZE) + 1; x++) {
            const tileType = gameWorld[startY + y] && gameWorld[startY + y][startX + x];
            const image = tileImages[tileType];
            if (image) {
                ctx.drawImage(image, x * TILE_SIZE + offsetX, y * TILE_SIZE + offsetY, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

// Function to update the camera position based on the player's position, simulating a camera that follows the player
function updateCameraPosition() {
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;
    cameraX += (targetX - cameraX) * cameraEase;
    cameraY += (targetY - cameraY) * cameraEase;
}

// Render players on canvas
function drawPlayers() {
  Object.values(players).forEach(drawPlayer);
  drawPlayer(player); // Draw current player last to be on top
}

// Draw a single player on the canvas
function drawPlayer(p) {
  if (!p.sprite.complete || p.frameIndex === undefined) return;
  const srcX = p.frameIndex * p.width;
  const srcY = p.direction * p.height;
  const screenX = p.x - player.x + canvas.width / 2 - p.width / 2;
  const screenY = p.y - player.y + canvas.height / 2 - p.height / 2;

  ctx.drawImage(p.sprite, srcX, srcY, p.width, p.height, screenX, screenY, p.width, p.height);
  ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = '16px Arial';
  ctx.fillText(p.name, screenX + p.width / 2, screenY - 20);
  if (playerMessages[p.id]) {
    ctx.fillStyle = 'yellow';
    ctx.fillText(playerMessages[p.id], screenX + p.width / 2, screenY - 40);
  }
}

// Keyboard event listeners for movement
document.addEventListener('keydown', e => keysPressed[e.key] = true);
document.addEventListener('keyup', e => delete keysPressed[e.key]);

// Socket event listeners for game state updates
socket.on('currentPlayers', playersData => {
  players = playersData;
  Object.values(players).forEach(p => {
    if (!p.sprite) {
      p.sprite = new Image();
      p.sprite.src = player.sprite.src;
    }
  });
  if (players[socket.id]) {
    Object.assign(player, players[socket.id]);
  }
});

socket.on('newPlayer', playerData => {
  players[playerData.id] = playerData;
  players[playerData.id].sprite = new Image();
  players[playerData.id].sprite.src = player.sprite.src;
});

socket.on('playerMoved', data => {
  const p = players[data.playerId];
  if (p) {
    p.x = data.x;
    p.y = data.y;
    p.direction = data.direction;
    p.frameIndex = data.frameIndex;
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