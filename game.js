// Ensure the 'player' object is initialized correctly at the top level
let player = {
    x: 400, // Initial player X position
    y: 300, // Initial player Y position
    width: 32,
    height: 32,
    speed: 2,
};

// World and NPCs remain the same
const world = {
    width: 800,
    height: 600,
};

let npcs = [
    { x: 210, y: 210, width: 32, height: 32, message: "Hello, I'm NPC 1!" },
    { x: 310, y: 310, width: 32, height: 32, message: "Hi there, I'm NPC 2!" }
];

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let camera = {
        x: 0,
        y: 0,
        update: function() {
            // Camera should center on the player, but it doesn't move the player itself
            this.x = player.x - canvas.width / 2;
            this.y = player.y - canvas.height / 2;
        }
    };

    function drawPlayer() {
        ctx.fillStyle = '#FF0000';
        // Always draw the player in the center of the canvas
        ctx.fillRect(canvas.width / 2 - player.width / 2, canvas.height / 2 - player.height / 2, player.width, player.height);
    }

    function drawNPCs() {
        ctx.fillStyle = '#0000FF';
        npcs.forEach(npc => {
            // NPCs are drawn relative to the camera's position
            ctx.fillRect(npc.x - camera.x, npc.y - camera.y, npc.width, npc.height);
        });
    }

    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        camera.update(); // Ensure the camera updates to follow the player
        drawPlayer();
        drawNPCs();
        requestAnimationFrame(gameLoop);
    }

    gameLoop();
});

// Key movement logic
document.addEventListener('keydown', function(event) {
    switch (event.key) {
        case 'ArrowLeft': player.x = Math.max(0, player.x - player.speed); break;
        case 'ArrowRight': player.x = Math.min(world.width - player.width, player.x + player.speed); break;
        case 'ArrowUp': player.y = Math.max(0, player.y - player.speed); break;
        case 'ArrowDown': player.y = Math.min(world.height - player.height, player.y + player.speed); break;
        case ' ': checkNPCInteraction(); break; // Space bar for interaction
    }
});

function checkNPCInteraction() {
    npcs.forEach(npc => {
        // Check collision with NPCs for interaction
        if (Math.abs(player.x - npc.x) < player.width && Math.abs(player.y - npc.y) < player.height) {
            alert(npc.message);
            return;
        }
    });
}
