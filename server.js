const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://godfreydev.github.io",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.static(__dirname)); // Serve static files from the directory where this script is located.

let players = {};

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    // Initialize player object without projectile-related properties
    players[socket.id] = {
        id: socket.id,
        x: 400,
        y: 300,
        width: 32,
        height: 32,
        color: 'red',
    };

    // Send current state of the game to the new player
    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (data) => {
        let movingPlayer = players[socket.id];
        if (movingPlayer) {
            movingPlayer.x = data.x;
            movingPlayer.y = data.y;
            // Notify all clients about the movement
            io.emit('playerMoved', {
                playerId: socket.id,
                x: movingPlayer.x,
                y: movingPlayer.y
            });
        }
    });

    // New event listener for receiving chat messages
    socket.on('chatMessage', (data) => {
        // Broadcast the chat message to all players
        io.emit('chatMessage', {
            playerId: socket.id,
            message: data.message
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
