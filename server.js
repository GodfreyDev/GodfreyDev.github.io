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

const adjectives = ['Quick', 'Lazy', 'Jolly', 'Brave', 'Clever', 'Wise', 'Fierce', 'Gentle', 'Loyal'];
const nouns = ['Fox', 'Bear', 'Dragon', 'Wolf', 'Tiger', 'Rabbit', 'Eagle', 'Owl', 'Lion'];

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generatePlayerName() {
    return `${getRandomElement(adjectives)}${getRandomElement(nouns)}${Math.floor(Math.random() * 100)}`;
}

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    const playerName = generatePlayerName();
    players[socket.id] = {
        id: socket.id,
        name: playerName,
        x: 400,
        y: 300,
        width: 32,
        height: 32,
        color: 'red',
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            io.emit('playerMoved', {playerId: socket.id, x: data.x, y: data.y});
        }
    });

    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', {playerId: socket.id, message: data.message});
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
