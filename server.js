const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Enable CORS for all routes
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Structure to hold player data
let players = {};

// Arrays of adjectives and nouns for player name generation
const adjectives = ['Quick', 'Lazy', 'Jolly', 'Brave', 'Clever', 'Wise', 'Fierce', 'Gentle', 'Loyal'];
const nouns = ['Fox', 'Bear', 'Dragon', 'Wolf', 'Tiger', 'Rabbit', 'Eagle', 'Owl', 'Lion'];

// Function to return a random element from an array
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generates a unique player name
function generatePlayerName() {
  return `${getRandomElement(adjectives)}${getRandomElement(nouns)}${Math.floor(Math.random() * 100)}`;
}

// Handle socket.io connections
io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);
  const playerName = generatePlayerName();

  // Initialize player data
  players[socket.id] = {
    id: socket.id,
    name: playerName,
    x: 400,
    y: 300,
    direction: 0, // Default direction
    moving: false,
    width: 64, // Sprite width
    height: 64, // Sprite height
  };

  // Emit current players to the newly connected player
  socket.emit('currentPlayers', players);

  // Broadcast new player's arrival to other players
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Update player position and direction based on movement
  socket.on('playerMovement', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].direction = data.direction;
      players[socket.id].frameIndex = data.frameIndex;

      // Broadcast the updated player position and frameIndex to other players
      socket.broadcast.emit('playerMoved', {
        playerId: socket.id,
        x: data.x,
        y: data.y,
        direction: data.direction,
        frameIndex: data.frameIndex
      });
    }
  });

  // Handle chat messages
  socket.on('chatMessage', (data) => {
    io.emit('chatMessage', { playerId: socket.id, message: data.message });
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Determine the server URL based on the environment
const serverUrl = process.env.NODE_ENV === 'production'
  ? 'https://cool-accessible-pint.glitch.me'
  : 'http://localhost:3000';

// Listen on the specified port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${serverUrl}:${PORT}`));