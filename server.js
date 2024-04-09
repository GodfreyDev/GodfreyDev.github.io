// Server-side JavaScript (Node.js with Express and Socket.io)
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

app.use(express.static(__dirname));

let players = {};

function generatePlayerName() {
    const adjectives = ['Quick', 'Lazy', 'Jolly', 'Brave', 'Clever', 'Wise', 'Fierce', 'Gentle', 'Loyal'];
    const nouns = ['Fox', 'Bear', 'Dragon', 'Wolf', 'Tiger', 'Rabbit', 'Eagle', 'Owl', 'Lion'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 100)}`;
}

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    players[socket.id] = {
        id: socket.id,
        name: generatePlayerName(),
        x: 400,
        y: 300,
        direction: 0, // Initial direction
        moving: false,
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (data) => {
        const player = players[socket.id];
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.direction = data.direction;
            io.emit('playerMoved', { playerId: socket.id, x: data.x, y: data.y, direction: data.direction });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
