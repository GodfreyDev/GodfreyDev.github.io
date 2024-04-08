const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname)); // Serve static files from the directory where this script is located.

let players = {};
let projectiles = [];

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    players[socket.id] = {
        id: socket.id,
        x: 400,
        y: 300,
        width: 32,
        height: 32,
        color: 'red',
        health: 100,
        lastDirection: 'stationary',
        frame: 0,
    };

    // Send current state of the game to the new player
    socket.emit('currentPlayers', players);
    socket.emit('updateProjectiles', projectiles); // Also send current projectiles
    socket.broadcast.emit('newPlayer', players[socket.id]);

    socket.on('playerMovement', (data) => {
        let movingPlayer = players[socket.id];
        if (movingPlayer) {
            movingPlayer.x = data.x;
            movingPlayer.y = data.y;
            io.emit('playerMoved', {
                playerId: socket.id,
                x: movingPlayer.x,
                y: movingPlayer.y,
                color: movingPlayer.color, // This could be removed if color doesn't change with movement
                lastDirection: movingPlayer.lastDirection, // Update if using animation frames
                frame: movingPlayer.frame // Update if using animation frames
            });
        }
    });

    socket.on('shootProjectile', (data) => {
        if (players[socket.id]) {
            const { dx, dy } = data;
            const newProjectile = {
                id: generateProjectileId(),
                ownerId: socket.id,
                x: players[socket.id].x + players[socket.id].width / 2,
                y: players[socket.id].y + players[socket.id].height / 2,
                dx,
                dy,
            };
            projectiles.push(newProjectile);
            io.emit('updateProjectiles', projectiles); // Update clients with new projectile
        }
    });    

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

function generateProjectileId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

setInterval(() => {
    projectiles.forEach((projectile, index) => {
        projectile.x += projectile.dx;
        projectile.y += projectile.dy;

        if(projectile.x < 0 || projectile.x > 800 || projectile.y < 0 || projectile.y > 600) {
            //projectiles.splice(index, 1); // Remove projectile if it goes off screen
        } else {
            Object.values(players).forEach(player => {
                // Ignore the player who shot the projectile
                if (projectile.ownerId !== player.id && checkCollision(projectile, player)) {
                    player.health -= 10;
                    if (player.health <= 0) {
                        delete players[player.id];
                        io.emit('playerDied', { playerId: player.id });
                    } else {
                        io.emit('playerHealthUpdated', { playerId: player.id, health: player.health });
                    }
                    projectiles.splice(index, 1); // Remove projectile after hit
                }
            });
        }
    });

    io.emit('updateProjectiles', projectiles);
}, 1000 / 60);


function checkCollision(projectile, player) {
    return projectile.x < player.x + player.width &&
           projectile.x + 5 > player.x &&
           projectile.y < player.y + player.height &&
           projectile.y + 10 > player.y;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
