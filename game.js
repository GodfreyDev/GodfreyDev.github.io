// Initialize player position in the middle of the world
let player = {
    x: 400, // Center of the game world initially
    y: 300,
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

// Track the state of arrow keys
const keysPressed = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false
};

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let camera = {
        x: 0,
        y: 0,
        update: function() {
            // Update camera to center on the player
            this.x = player.x - canvas.width / 2 + player.width / 2;
            this.y = player.y - canvas.height / 2 + player.height / 2;
        }
    };

    function drawPlayer() {
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(canvas.width / 2 - player.width / 2, canvas.height / 2 - player.height / 2, player.width, player.height);
    }

    function drawNPCs() {
        ctx.fillStyle = '#0000FF';
        npcs.forEach(npc => {
            ctx.fillRect(npc.x - camera.x, npc.y - camera.y, npc.width, npc.height);
        });
    }

    function updatePlayerPosition() {
        let dx = 0;
        let dy = 0;
    
        if (keysPressed.ArrowLeft) {
            dx -= 1;
        }
        if (keysPressed.ArrowRight) {
            dx += 1;
        }
        if (keysPressed.ArrowUp) {
            dy -= 1;
        }
        if (keysPressed.ArrowDown) {
            dy += 1;
        }
    
        // Normalize diagonal speed
        if (dx !== 0 && dy !== 0) {
            dx /= Math.sqrt(2);
            dy /= Math.sqrt(2);
        }
    
        player.x = Math.max(0, Math.min(world.width - player.width, player.x + dx * player.speed));
        player.y = Math.max(0, Math.min(world.height - player.height, player.y + dy * player.speed));
    }    

    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        updatePlayerPosition();
        camera.update();
        drawPlayer();
        drawNPCs();
        requestAnimationFrame(gameLoop);
    }

    gameLoop();
});

// Modify event listeners for smooth and diagonal movement
document.addEventListener('keydown', function(event) {
    if (keysPressed.hasOwnProperty(event.key)) {
        keysPressed[event.key] = true;
        event.preventDefault(); // Prevent the default action (scroll / move page)
    }
});

document.addEventListener('keyup', function(event) {
    if (keysPressed.hasOwnProperty(event.key)) {
        keysPressed[event.key] = false;
    }
});

function checkNPCInteraction() {
    npcs.forEach(npc => {
        if (player.x < npc.x + npc.width && player.x + player.width > npc.x && player.y < npc.y + npc.height && player.y + player.height > npc.y) {
            alert(npc.message); // Show NPC message
            return;
        }
    });
}

// Adjust the interaction key to work with the new movement system
document.addEventListener('keydown', function(event) {
    if (event.key === ' ') {
        checkNPCInteraction();
        event.preventDefault(); // Prevent any default space bar actions
    }
});
