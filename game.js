// Define game state variables
let player, world, npcs, keysPressed, canvas, ctx, dialogueBox;

function initializeGame() {
    // Initialize game elements
    player = {
        x: 400,
        y: 300,
        width: 32,
        height: 32,
        speed: 2,
    };

    world = {
        width: 800,
        height: 600,
    };

    npcs = [
        { x: 210, y: 210, width: 32, height: 32, message: "Hello, I'm NPC 1!" },
        { x: 310, y: 310, width: 32, height: 32, message: "Hi there, I'm NPC 2!" }
    ];

    keysPressed = {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false
    };

    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    dialogueBox = document.getElementById('dialogueBox');

    // Setup event listeners for input and resizing
    setupEventListeners();
    resizeCanvas(); // Initial canvas setup to fit the screen
    gameLoop(); // Start the game loop
}

function setupEventListeners() {
    window.addEventListener('resize', resizeCanvas);

    document.addEventListener('keydown', function(event) {
        if (keysPressed.hasOwnProperty(event.key)) {
            keysPressed[event.key] = true;
            event.preventDefault(); // Prevent default for arrow keys and space to avoid scrolling
        }
        if (event.key === ' ') {
            checkNPCInteraction();
            event.preventDefault();
        }
    });

    document.addEventListener('keyup', function(event) {
        if (keysPressed.hasOwnProperty(event.key)) {
            keysPressed[event.key] = false;
        }
    });
}

function resizeCanvas() {
    const gameAspectRatio = 4 / 3;
    let newWidth = window.innerWidth;
    let newHeight = window.innerHeight;
    let newWidthToHeight = newWidth / newHeight;
    
    if (newWidthToHeight > gameAspectRatio) {
        newWidth = newHeight * gameAspectRatio;
        canvas.style.height = `${newHeight}px`;
        canvas.style.width = `${newWidth}px`;
    } else {
        newHeight = newWidth / gameAspectRatio;
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;
    }

    canvas.width = newWidth;
    canvas.height = newHeight;
}

function updatePlayerPosition() {
    let dx = 0;
    let dy = 0;

    if (keysPressed.ArrowLeft) dx -= 1;
    if (keysPressed.ArrowRight) dx += 1;
    if (keysPressed.ArrowUp) dy -= 1;
    if (keysPressed.ArrowDown) dy += 1;

    if (dx !== 0 && dy !== 0) {
        dx /= Math.sqrt(2);
        dy /= Math.sqrt(2);
    }

    player.x = Math.max(0, Math.min(world.width - player.width, player.x + dx * player.speed));
    player.y = Math.max(0, Math.min(world.height - player.height, player.y + dy * player.speed));
}

function drawPlayer() {
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(canvas.width / 2 - player.width / 2, canvas.height / 2 - player.height / 2, player.width, player.height);
}

function drawNPCs() {
    ctx.fillStyle = '#0000FF';
    npcs.forEach(npc => {
        ctx.fillRect(npc.x - player.x + canvas.width / 2 - player.width / 2, npc.y - player.y + canvas.height / 2 - player.height / 2, npc.width, npc.height);
    });
}

function checkNPCInteraction() {
    npcs.forEach(npc => {
        if (Math.abs(player.x - npc.x) < player.width && Math.abs(player.y - npc.y) < player.height) {
            showNPCDialogue(npc.message);
            return;
        }
    });
}

function showNPCDialogue(message) {
    dialogueBox.textContent = message;
    dialogueBox.style.display = 'block';
    setTimeout(() => dialogueBox.style.display = 'none', 3000);
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updatePlayerPosition();
    drawPlayer();
    drawNPCs();
    requestAnimationFrame(gameLoop);
}

// Start the game once everything is loaded
window.onload = initializeGame;
