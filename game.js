// Define the player object with more detailed properties
let player = {
    x: 100,
    y: 100,
    width: 32,
    height: 32,
    speed: 2,
};

// Define a larger world map
const world = {
    width: 800,
    height: 600,
};

// Define NPCs with positions and messages
let npcs = [
    { x: 210, y: 210, width: 32, height: 32, message: "Hello, I'm NPC 1!" },
    { x: 310, y: 310, width: 32, height: 32, message: "Hi there, I'm NPC 2!" }
];

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; // Viewport size
    canvas.height = 256;

    // Initialize player position
    player.x = world.width / 2 - player.width / 2;
    player.y = world.height / 2 - player.height / 2;

    // Camera to follow the player
    let camera = {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height,
        update: function() {
            this.x = player.x - (this.width / 2);
            this.y = player.y - (this.height / 2);
            this.x = Math.max(0, Math.min(this.x, world.width - this.width));
            this.y = Math.max(0, Math.min(this.y, world.height - this.height));
        }
    };

    function drawPlayer() {
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(player.x - camera.x, player.y - camera.y, player.width, player.height);
    }

    function drawNPCs() {
        ctx.fillStyle = '#0000FF'; // NPC color
        npcs.forEach(npc => {
            ctx.fillRect(npc.x - camera.x, npc.y - camera.y, npc.width, npc.height);
        });
    }

    // Game loop
    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        camera.update();
        drawPlayer();
        drawNPCs();
        requestAnimationFrame(gameLoop);
    }

    gameLoop();
});

// Movement and Interaction
document.addEventListener('keydown', function(event) {
    switch (event.key) {
        case 'ArrowLeft': player.x = Math.max(0, player.x - player.speed); break;
        case 'ArrowRight': player.x = Math.min(world.width - player.width, player.x + player.speed); break;
        case 'ArrowUp': player.y = Math.max(0, player.y - player.speed); break;
        case 'ArrowDown': player.y = Math.min(world.height - player.height, player.y + player.speed); break;
        case ' ': checkNPCInteraction(); break; // Interaction
    }
});

function checkNPCInteraction() {
    npcs.forEach(npc => {
        if (player.x < npc.x + npc.width && player.x + player.width > npc.x && player.y < npc.y + npc.height && player.y + player.height > npc.y) {
            alert(npc.message); // Interaction feedback
            return; // Exit after first interaction
        }
    });
}
