// # game.js (Client-Side Logic - Updated)
//
// Major Changes:
// - World Generation Removed: Receives world data from the server.
// - Trading Logic Overhaul: Uses the single modal, handles socket events for UI updates.
// - Combat Feedback: Displays damage numbers, basic attack animation state.
// - UI Updates: HUD elements updated directly. Dialogue box used for messages/errors.
// - Code Organization: Event listeners grouped, functions refined.
// - Basic Movement Smoothing (Interpolation) added.

const serverUrl = window.location.hostname === 'godfreydev.github.io'
    ? 'https://cool-accessible-pint.glitch.me' // Replace with your Glitch URL if deployed
    : 'http://localhost:3000'; // For local testing

const socket = io(serverUrl); // Use io() directly

// --- Constants ---
const DIRECTIONS = { DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3, DOWN_LEFT: 4, DOWN_RIGHT: 5, UP_LEFT: 6, UP_RIGHT: 7 };
const TILE_SIZE = 64;
const MOVEMENT_SPEED = 200; // Pixels per second
const ANIMATION_SPEED = 0.1; // Seconds per frame
const ATTACK_COOLDOWN = 500; // Milliseconds
const PROJECTILE_SPEED = 400; // Pixels per second

// Tile types (used for checking received world data)
const TILE_WALL = 1;
const TILE_DOOR = 2;
const TILE_FLOOR = 3;
const TILE_WATER = 4;
const TILE_GRASS = 5;
const TILE_SAND = 6;
const TILE_BRIDGE = 7;
const IMPASSABLE_TILES = [TILE_WALL, TILE_WATER]; // Tiles player cannot normally enter

// --- Game State ---
let player = {
    id: null,
    name: 'Connecting...',
    x: 100 * TILE_SIZE, // Default, will be overwritten by server
    y: 100 * TILE_SIZE,
    width: 64,
    height: 64,
    direction: DIRECTIONS.DOWN,
    moving: false,
    sprite: null,
    frameIndex: 0,
    frameCount: 8, // Assuming 8 frames per direction in sprite sheet
    health: 100,
    maxHealth: 100,
    inventory: [],
    equippedItem: null,
    copper: 0,
    isAttacking: false,
    attackFrameIndex: 0,
    attackAnimTimer: 0,
    lastAttackTime: 0,
    // For interpolation
    targetX: 100 * TILE_SIZE,
    targetY: 100 * TILE_SIZE,
    lastUpdateTime: 0,
};

let players = {}; // Other players { id: playerData }
let playerMessages = {}; // { playerId: messageText } for display above head
let items = {}; // World items { id: itemData }
let enemies = {}; // World enemies { id: enemyData }
let projectiles = []; // { x, y, direction, speed, ownerId, damage, id }
let damageNumbers = []; // { text, x, y, life, id }
let gameWorld = []; // Received from server
let tileImages = {};
let spriteImages = {};
let keysPressed = {};
let lastRenderTime = 0;
let animationTimer = 0;
let cameraX = 0;
let cameraY = 0;
const cameraEasing = 0.1; // Smoother camera follow

let currentTrade = { // State for the trading modal
    active: false,
    isRecipient: false, // Are we receiving an offer?
    partnerId: null,
    partnerName: null,
    mySelectedItemIndex: null, // Index in player.inventory
    myOfferedCopper: 0,
    theirOffer: { // What the partner offered (if isRecipient)
        item: null,
        copper: 0
    }
};


// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const chatLog = document.getElementById('chatLog');
const chatInput = document.getElementById('chatInput');
const dialogueBox = document.getElementById('dialogueBox');
const inventoryList = document.getElementById('inventoryList');
const tradeButton = document.getElementById('tradeButton');
const tradeModal = document.getElementById('tradeModal');
const tradeModalTitle = document.getElementById('tradeModalTitle');
const playerSelect = document.getElementById('playerSelect');
const yourItemsList = document.getElementById('yourItems');
const offerCopperInput = document.getElementById('offerCopper');
const sendTradeRequestButton = document.getElementById('sendTradeRequest');
const closeTradeModalButton = document.getElementById('closeTradeModal');
const acceptTradeButton = document.getElementById('acceptTradeButton');
const declineTradeButton = document.getElementById('declineTradeButton');
const theirOfferSection = document.getElementById('theirOfferSection');
const theirOfferDetails = document.getElementById('theirOfferDetails');
const tradePartnerNameSpan = document.getElementById('tradePartnerName');
const initiateTradeSection = document.getElementById('initiateTradeSection');
const damageNumbersContainer = document.getElementById('damageNumbersContainer'); // Optional container, can draw directly on canvas too
const hudHealth = document.getElementById('hudHealth');
const hudEquipped = document.getElementById('hudEquipped');
const hudCopper = document.getElementById('hudCopper');

// --- Initialization ---
function adjustCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Recalculate camera if needed immediately
    updateCameraPosition(true); // Force immediate update
}

function loadTileImages(callback) {
    const tileSources = {
        [TILE_WALL]: 'Images/tile_1.png',
        [TILE_DOOR]: 'Images/tile_2.png',
        [TILE_FLOOR]: 'Images/tile_3.png',
        [TILE_WATER]: 'Images/tile_4.png',
        [TILE_GRASS]: 'Images/tile_5.png',
        [TILE_SAND]: 'Images/tile_6.png',
        [TILE_BRIDGE]: 'Images/tile_7.png',
    };
    let loadedCount = 0;
    const totalCount = Object.keys(tileSources).length;
    if (totalCount === 0) {
        callback();
        return;
    }

    for (const type in tileSources) {
        tileImages[type] = new Image();
        tileImages[type].onload = () => {
            loadedCount++;
            if (loadedCount === totalCount) {
                console.log("Tile images loaded.");
                callback();
            }
        };
        tileImages[type].onerror = () => {
            console.error(`Failed to load tile image: ${tileSources[type]}`);
            loadedCount++; // Still count it to avoid getting stuck
             if (loadedCount === totalCount) {
                callback();
            }
        };
        tileImages[type].src = tileSources[type];
    }
}

function loadSpriteImages(callback) {
    const spritesToLoad = [
        { key: 'player', src: 'Images/player_sprite_frames.png', frames: 8 },
        // Add other sprites here if needed (e.g., specific enemies)
         { key: 'enemy_basic', src: 'Images/player_sprite_frames.png', frames: 8 }, // Placeholder
         { key: 'enemy_strong', src: 'Images/player_sprite_frames.png', frames: 8 } // Placeholder
    ];
    let loadedCount = 0;
    const totalCount = spritesToLoad.length;
     if (totalCount === 0) {
        callback();
        return;
    }

    spritesToLoad.forEach(spriteInfo => {
        spriteImages[spriteInfo.key] = new Image();
        spriteImages[spriteInfo.key].onload = () => {
            loadedCount++;
            // Store frame count for animation reference
            spriteInfo.image = spriteImages[spriteInfo.key]; // Reference loaded image
            spriteImages[spriteInfo.key].frameCount = spriteInfo.frames; // Attach frame count to image object
            if (loadedCount === totalCount) {
                console.log("Sprite images loaded.");
                callback();
            }
        };
        spriteImages[spriteInfo.key].onerror = () => {
            console.error(`Failed to load sprite image: ${spriteInfo.src}`);
             loadedCount++; // Still count it
            if (loadedCount === totalCount) {
                callback();
            }
        };
        spriteImages[spriteInfo.key].src = spriteInfo.src;
    });
}

// --- Game Loop ---
function gameLoop(timeStamp) {
    if (!player.id || gameWorld.length === 0) { // Don't run loop until connected and world received
        requestAnimationFrame(gameLoop);
        return;
    }

    const deltaTime = Math.min((timeStamp - lastRenderTime) / 1000, 0.1); // Cap delta time
    lastRenderTime = timeStamp;

    // Updates
    updatePlayerState(deltaTime); // Handle input and local movement intention
    interpolateEntities(deltaTime); // Smooth movement of self and others
    handleAnimation(deltaTime);
    updateProjectiles(deltaTime);
    updateEnemyAnimations(deltaTime); // Update enemy animations locally
    updateCameraPosition();
    updateDamageNumbers(deltaTime);

    // Drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    drawBackground();
    drawItems();
    drawEnemies();
    drawPlayers();
    drawProjectiles();
    // Damage numbers are now drawn via DOM elements in damageNumbersContainer

    requestAnimationFrame(gameLoop);
}

// --- Update Functions ---

function updatePlayerState(deltaTime) {
    let dx = 0;
    let dy = 0;
    let intendedMoving = false;

    if (keysPressed['a'] || keysPressed['ArrowLeft']) { dx -= 1; intendedMoving = true; }
    if (keysPressed['d'] || keysPressed['ArrowRight']) { dx += 1; intendedMoving = true; }
    if (keysPressed['w'] || keysPressed['ArrowUp']) { dy -= 1; intendedMoving = true; }
    if (keysPressed['s'] || keysPressed['ArrowDown']) { dy += 1; intendedMoving = true; }

    // Determine direction (even if not moving for attack direction)
    let newDirection = player.direction;
     if (dy < 0 && dx < 0) newDirection = DIRECTIONS.UP_LEFT;
    else if (dy < 0 && dx > 0) newDirection = DIRECTIONS.UP_RIGHT;
    else if (dy > 0 && dx < 0) newDirection = DIRECTIONS.DOWN_LEFT;
    else if (dy > 0 && dx > 0) newDirection = DIRECTIONS.DOWN_RIGHT;
    else if (dy < 0) newDirection = DIRECTIONS.UP;
    else if (dy > 0) newDirection = DIRECTIONS.DOWN;
    else if (dx < 0) newDirection = DIRECTIONS.LEFT;
    else if (dx > 0) newDirection = DIRECTIONS.RIGHT;

    player.moving = intendedMoving; // Update moving state based on input

    // Calculate intended position change
    let moveX = 0;
    let moveY = 0;
    if (player.moving) {
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        if (magnitude > 0) {
             // Normalize and apply speed
             moveX = (dx / magnitude) * MOVEMENT_SPEED * deltaTime;
             moveY = (dy / magnitude) * MOVEMENT_SPEED * deltaTime;
        }
    }

     // Client-side prediction (optional, can make movement feel smoother)
     // Predict next position based on input
     const predictedX = player.x + moveX;
     const predictedY = player.y + moveY;

     // Basic client-side collision check (prevents getting stuck visually before server corrects)
     if (!checkCollision(predictedX, predictedY)) {
        // If no collision predicted, tentatively update local position for smoother rendering
        // player.x = predictedX;
        // player.y = predictedY;
        // NOTE: Server position (player.targetX/Y) is the authority.
        // We mainly use this prediction for sending the *intended* move.
     } else {
        player.moving = false; // Stop moving if predicted collision
        moveX = 0;
        moveY = 0;
     }


    // Only send update if moving or direction changed
    if (player.moving || newDirection !== player.direction) {
        player.direction = newDirection; // Update direction regardless of movement
        socket.emit('playerMovement', {
            // Send the *intended* move based on input, not the predicted/collided state
            // Let the server validate and determine the actual resulting position
            dx: moveX / deltaTime, // Send velocity intent
            dy: moveY / deltaTime,
            direction: player.direction,
            // frameIndex: player.frameIndex, // Server shouldn't trust frameIndex
            moving: player.moving
        });
    }

    handleAttackInput();
    checkItemPickup();
}


function checkCollision(x, y) {
    // Check collision based on player's bounding box corners
    const halfWidth = player.width / 3; // Use a smaller collision box than sprite?
    const halfHeight = player.height / 3;

    const checkPoints = [
        { cx: x - halfWidth, cy: y - halfHeight }, // Top-left
        { cx: x + halfWidth, cy: y - halfHeight }, // Top-right
        { cx: x - halfWidth, cy: y + halfHeight }, // Bottom-left
        { cx: x + halfWidth, cy: y + halfHeight }  // Bottom-right
    ];

    for (const point of checkPoints) {
        const tileType = getTileAt(point.cx, point.cy);
        if (IMPASSABLE_TILES.includes(tileType)) {
            return true; // Collision detected
        }
    }
    return false; // No collision
}

function getTileAt(worldX, worldY) {
    if (!gameWorld || gameWorld.length === 0) return TILE_WALL; // Default if world not loaded

    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);

    if (tileY < 0 || tileY >= gameWorld.length || tileX < 0 || !gameWorld[tileY] || tileX >= gameWorld[tileY].length) {
        return TILE_WALL; // Out of bounds
    }

    return gameWorld[tileY][tileX];
}


function interpolateEntities(deltaTime) {
    const lerpFactor = Math.min(deltaTime * 15, 1); // Adjust multiplier for faster/slower interpolation

    // Interpolate local player towards server position (targetX/Y)
    player.x += (player.targetX - player.x) * lerpFactor;
    player.y += (player.targetY - player.y) * lerpFactor;

    // Interpolate other players
    for (const id in players) {
        const p = players[id];
        if (p.targetX !== undefined && p.targetY !== undefined) {
            p.x += (p.targetX - p.x) * lerpFactor;
            p.y += (p.targetY - p.y) * lerpFactor;
        } else {
            // If no target set yet, snap to initial position
            p.x = p.x || 0;
            p.y = p.y || 0;
        }
    }

     // Interpolate enemies (optional, if server sends frequent updates)
     for (const id in enemies) {
        const e = enemies[id];
         if (e.targetX !== undefined && e.targetY !== undefined) {
            e.x += (e.targetX - e.x) * lerpFactor;
            e.y += (e.targetY - e.y) * lerpFactor;
         }
    }
}


function handleAnimation(deltaTime) {
    // Player Animation
    if (player.isAttacking) {
        player.attackAnimTimer += deltaTime;
        if (player.attackAnimTimer >= ANIMATION_SPEED / 1.5) { // Faster attack animation
            player.attackFrameIndex++;
            player.attackAnimTimer = 0;
            const attackFrames = player.sprite?.frameCount || 4; // Use sprite frame count or a default
            if (player.attackFrameIndex >= attackFrames) { // Assuming attack uses same number of frames as walk
                player.attackFrameIndex = 0;
                player.isAttacking = false; // End attack animation
            }
        }
         // Use attack frame index for drawing if attacking
         player.currentFrame = player.attackFrameIndex;
    } else if (player.moving) {
        animationTimer += deltaTime;
        if (animationTimer >= ANIMATION_SPEED) {
            player.frameIndex = (player.frameIndex + 1) % (player.sprite?.frameCount || 1);
            animationTimer = 0;
        }
         player.currentFrame = player.frameIndex; // Use walk frame index
    } else {
        player.frameIndex = 0; // Idle frame
        player.attackFrameIndex = 0;
        player.attackAnimTimer = 0;
         player.currentFrame = 0; // Use idle frame index
    }
}

function updateEnemyAnimations(deltaTime) {
    Object.values(enemies).forEach(enemy => {
        // Enemies also interpolate, so their animation should depend on their 'moving' state from server
        if (enemy.moving) {
            enemy.animationTimer = (enemy.animationTimer || 0) + deltaTime;
            if (enemy.animationTimer >= ANIMATION_SPEED) {
                 const frameCount = spriteImages[enemy.type]?.frameCount || spriteImages['enemy_basic']?.frameCount || 1;
                 enemy.frameIndex = (enemy.frameIndex + 1) % frameCount;
                 enemy.animationTimer = 0;
            }
        } else {
             enemy.frameIndex = 0; // Idle frame
        }
    });
}


function updateCameraPosition(forceImmediate = false) {
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;

    if (forceImmediate) {
         cameraX = targetX;
         cameraY = targetY;
    } else {
         cameraX += (targetX - cameraX) * cameraEasing;
         cameraY += (targetY - cameraY) * cameraEasing;
    }

    // Clamp camera to world boundaries (optional)
    // const maxCameraX = WORLD_WIDTH * TILE_SIZE - canvas.width;
    // const maxCameraY = WORLD_HEIGHT * TILE_SIZE - canvas.height;
    // cameraX = Math.max(0, Math.min(cameraX, maxCameraX));
    // cameraY = Math.max(0, Math.min(cameraY, maxCameraY));
}

function checkItemPickup() {
    Object.values(items).forEach(item => {
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < TILE_SIZE * 0.75) { // Pickup radius
            socket.emit('pickupItem', item.id);
            // Optional: Add a small delay or visual indication before removing locally
        }
    });
}

function handleAttackInput() {
    if (keysPressed[' '] && player.health > 0) { // Spacebar for attack, ensure player is alive
        const now = Date.now();
        if (now - player.lastAttackTime > ATTACK_COOLDOWN) {
            player.lastAttackTime = now;
            player.isAttacking = true; // Start animation state
            player.attackFrameIndex = 0;
            player.attackAnimTimer = 0;

            // Determine target (simple proximity check)
            let targetId = null;
            let targetType = null; // 'player' or 'enemy'
            let minDistance = 80; // Attack range

            // Check enemies first
            for (const id in enemies) {
                 if (enemies[id].health > 0) { // Only target alive enemies
                    const dist = Math.hypot(player.x - enemies[id].x, player.y - enemies[id].y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        targetId = id;
                        targetType = 'enemy';
                    }
                 }
            }

            // Check players if no enemy is closer
            if (targetType !== 'enemy') {
                for (const id in players) {
                    if (id !== player.id && players[id].health > 0) { // Don't target self, only alive players
                        const dist = Math.hypot(player.x - players[id].x, player.y - players[id].y);
                        if (dist < minDistance) {
                            minDistance = dist;
                            targetId = id;
                            targetType = 'player';
                        }
                    }
                }
            }

            // Emit attack event to server
            socket.emit('attack', { targetId, targetType }); // Send target ID and type

            // Handle local projectile creation if staff equipped
            if (player.equippedItem && player.equippedItem.type === 'staff') {
                createProjectile(player.x, player.y, player.direction, player.id, player.equippedItem.damage || 5);
                // Note: Server should ideally validate and create projectiles too for authority
            }
        }
    }
}

function createProjectile(x, y, direction, ownerId, damage) {
     const projectile = {
        id: `proj_${ownerId}_${Date.now()}`, // Simple unique ID
        x: x,
        y: y,
        startX: x, // Remember start position for range check
        startY: y,
        direction: direction,
        speed: PROJECTILE_SPEED,
        ownerId: ownerId,
        damage: damage,
        width: 10, // For drawing/collision
        height: 10
    };
    projectiles.push(projectile);
    // Optionally, emit this projectile to the server for broadcasting to others
    // socket.emit('projectileFired', projectile);
}


function updateProjectiles(deltaTime) {
    projectiles = projectiles.filter(p => {
        let dx = 0, dy = 0;
        const moveDistance = p.speed * deltaTime;

        // Calculate movement vector based on direction
        switch (p.direction) {
            case DIRECTIONS.UP: dy = -moveDistance; break;
            case DIRECTIONS.DOWN: dy = moveDistance; break;
            case DIRECTIONS.LEFT: dx = -moveDistance; break;
            case DIRECTIONS.RIGHT: dx = moveDistance; break;
            case DIRECTIONS.UP_LEFT: dx = -moveDistance / Math.SQRT2; dy = -moveDistance / Math.SQRT2; break;
            case DIRECTIONS.UP_RIGHT: dx = moveDistance / Math.SQRT2; dy = -moveDistance / Math.SQRT2; break;
            case DIRECTIONS.DOWN_LEFT: dx = -moveDistance / Math.SQRT2; dy = moveDistance / Math.SQRT2; break;
            case DIRECTIONS.DOWN_RIGHT: dx = moveDistance / Math.SQRT2; dy = moveDistance / Math.SQRT2; break;
        }
        p.x += dx;
        p.y += dy;

        // Check range limit
        const distTraveled = Math.hypot(p.x - p.startX, p.y - p.startY);
        if (distTraveled > 500) { // Max range of 500 pixels
            return false; // Remove projectile
        }

        // Check collision with walls
        if (getTileAt(p.x, p.y) === TILE_WALL) {
            return false; // Remove projectile
        }

        // Check collision with enemies (ONLY if projectile is from a player)
        if (players[p.ownerId]) { // Check if owner is a player
            for (const id in enemies) {
                const e = enemies[id];
                 if (e.health > 0 && Math.hypot(p.x - e.x, p.y - e.y) < (e.width / 2 + p.width / 2)) {
                    // Client doesn't apply damage, server does.
                    // We *could* emit a hit event here, but server attack handles it.
                     displayDamageNumber(p.damage, e.x, e.y); // Show damage locally immediately
                    return false; // Remove projectile on hit
                }
            }
        }

        // Check collision with players (ONLY if projectile is from a player and not the owner)
         if (players[p.ownerId]) {
            for (const id in players) {
                if (id !== p.ownerId) { // Don't hit self
                    const targetP = players[id];
                     if (targetP.health > 0 && Math.hypot(p.x - targetP.x, p.y - targetP.y) < (targetP.width / 2 + p.width / 2)) {
                        // Client doesn't apply damage.
                        displayDamageNumber(p.damage, targetP.x, targetP.y); // Show damage locally immediately
                        return false; // Remove projectile
                    }
                }
            }
         }
        // TODO: Add collision check if projectile is from an ENEMY hitting a PLAYER

        return true; // Keep projectile
    });
}

function updateDamageNumbers(deltaTime) {
    const container = damageNumbersContainer; // Use the DOM container
    container.innerHTML = ''; // Clear previous numbers

    damageNumbers = damageNumbers.filter(dn => {
        dn.life -= deltaTime * 1.5; // Faster fade

        if (dn.life <= 0) return false; // Remove faded numbers

        // Create/Update DOM Element
        const dnElement = document.createElement('div');
        dnElement.className = 'damage-number';
        dnElement.textContent = dn.text;

        // Calculate screen position based on world coords and camera
        const screenX = dn.x - cameraX;
        const screenY = dn.y - cameraY - (1.0 - dn.life) * 40; // Float up effect

        // Check if on screen before adding to DOM (optimization)
        if (screenX > -50 && screenX < canvas.width + 50 && screenY > -50 && screenY < canvas.height + 50) {
             dnElement.style.left = `${screenX}px`;
             dnElement.style.top = `${screenY}px`;
             dnElement.style.opacity = dn.life > 0.2 ? '1' : (dn.life / 0.2).toString(); // Fade out quickly at the end
             container.appendChild(dnElement);
        }


        return true;
    });
}

function displayDamageNumber(amount, x, y) {
    if (amount <= 0) return; // Don't show 0 damage
    damageNumbers.push({
        id: `dmg_${Date.now()}_${Math.random()}`, // Unique ID
        text: String(amount),
        x: x + (Math.random() - 0.5) * 20, // Slight random offset
        y: y - player.height / 2, // Start above head
        life: 1.0 // Lifetime (1 second)
    });
}

// --- Drawing Functions ---

function drawBackground() {
    const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endCol = Math.min(gameWorld[0]?.length || 0, Math.ceil((cameraX + canvas.width) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE));
    const endRow = Math.min(gameWorld.length, Math.ceil((cameraY + canvas.height) / TILE_SIZE));

    ctx.save();
    ctx.translate(-cameraX, -cameraY); // Apply camera offset

    // Optional: Fill background if tiles don't cover everything
    ctx.fillStyle = 'black';
    ctx.fillRect(cameraX, cameraY, canvas.width, canvas.height);

    for (let y = startRow; y < endRow; y++) {
        for (let x = startCol; x < endCol; x++) {
            const tileType = gameWorld[y]?.[x];
            if (tileType && tileImages[tileType]) {
                ctx.drawImage(tileImages[tileType], x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            } else if (tileType) {
                // Draw placeholder if image missing
                ctx.fillStyle = '#555';
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }

     // Draw safe zones (get data from server or define statically if matching server)
     // drawSafeZones(); // Assuming safeZones array is defined globally/received

    ctx.restore(); // Remove camera offset
}


function drawItems() {
    ctx.save();
    ctx.translate(-cameraX, -cameraY);
    Object.values(items).forEach(item => {
        // Use placeholder colors/shapes for now
        ctx.fillStyle = item.type === 'potion' ? 'red'
                       : item.type === 'sword' ? 'silver'
                       : item.type === 'staff' ? 'purple'
                       : item.type === 'shield' ? 'brown'
                       : 'blue'; // Default
        const itemSize = TILE_SIZE * 0.4;
        ctx.fillRect(item.x - itemSize / 2, item.y - itemSize / 2, itemSize, itemSize);
        // TODO: Draw item sprites when available
    });
    ctx.restore();
}

function drawPlayers() {
    // Draw other players first
    Object.values(players).forEach(p => {
        if (p.id !== player.id && p.health > 0) { // Only draw others if alive
             drawCharacter(p);
        }
    });
    // Draw local player last (on top)
    if (player.health > 0) {
         drawCharacter(player);
    }
}

function drawEnemies() {
     ctx.save();
     ctx.translate(-cameraX, -cameraY);
    Object.values(enemies).forEach(enemy => {
        if (enemy.health > 0) {
            const enemySprite = spriteImages[enemy.type] || spriteImages['enemy_basic'] || player.sprite; // Fallback sprite
            if (!enemySprite || !enemySprite.complete) {
                // Draw placeholder if sprite missing/loading
                ctx.fillStyle = 'darkred';
                ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height);
            } else {
                const frameCount = enemySprite.frameCount || 1;
                const srcX = (enemy.frameIndex % frameCount) * enemy.width;
                const srcY = enemy.direction * enemy.height; // Assuming same sprite sheet layout
                 const drawWidth = enemy.width;
                 const drawHeight = enemy.height;

                ctx.drawImage(enemySprite,
                    srcX, srcY, drawWidth, drawHeight, // Source rect
                    enemy.x - drawWidth / 2, enemy.y - drawHeight / 2, // Destination pos (center)
                    drawWidth, drawHeight // Destination size
                );
            }
            // Draw health bar for enemy
            drawHealthBar(enemy.x, enemy.y, enemy.width, enemy.health, enemy.maxHealth, 'Enemy'); // Pass name/type later
        }
    });
     ctx.restore();
}

function drawCharacter(p) {
     ctx.save();
     ctx.translate(-cameraX, -cameraY);

    const charSprite = p.sprite || spriteImages.player; // Use assigned sprite or default player sprite
    if (charSprite && charSprite.complete && p.frameIndex !== undefined) {
        const frameCount = charSprite.frameCount || 1;
        // Use currentFrame which considers attack animation state
        const frameToDraw = p.currentFrame !== undefined ? p.currentFrame : p.frameIndex;
        const srcX = (frameToDraw % frameCount) * p.width;
        const srcY = p.direction * p.height;

        // Flashing effect when damaged (optional)
         // if (p.lastDamageTime && Date.now() - p.lastDamageTime < 150) { // Flash for 150ms
         //    ctx.globalAlpha = 0.6;
         // }

        ctx.drawImage(charSprite,
            srcX, srcY, p.width, p.height,
            p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);

         ctx.globalAlpha = 1.0; // Reset alpha

    } else {
        // Draw placeholder if sprite missing
        ctx.fillStyle = p.id === player.id ? 'cyan' : 'orange';
        ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
    }

     // Draw Name
     ctx.fillStyle = 'white';
     ctx.textAlign = 'center';
     ctx.font = '14px Arial';
     ctx.fillText(p.name || 'Unknown', p.x, p.y - p.height / 2 - 15);

    // Draw Health Bar
    drawHealthBar(p.x, p.y, p.width, p.health, p.maxHealth);

    // Draw chat message above head
    if (playerMessages[p.id]) {
        ctx.fillStyle = '#FFF'; // White text for chat bubbles
        ctx.font = '12px Arial';
        ctx.fillText(playerMessages[p.id], p.x, p.y - p.height / 2 - 35);
    }

    ctx.restore();
}

function drawHealthBar(x, y, width, health, maxHealth) {
    const barWidth = Math.max(50, width * 0.8);
    const barHeight = 6;
    const barX = x - barWidth / 2;
    const barY = y - width / 2 - 10; // Position above the character's head space

    const healthPercentage = Math.max(0, health) / maxHealth;

    ctx.fillStyle = '#550000'; // Dark red background
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#00CC00'; // Green health fill
    ctx.fillRect(barX, barY, barWidth * healthPercentage, barHeight);

    // Optional: Add border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
}


function drawProjectiles() {
    ctx.save();
    ctx.translate(-cameraX, -cameraY);
    ctx.fillStyle = 'yellow';
    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width / 2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

// --- UI Update Functions ---

function updateHUD() {
    hudHealth.textContent = `Health: ${player.health}/${player.maxHealth}`;
    hudEquipped.textContent = `Equipped: ${player.equippedItem ? formatItemName(player.equippedItem) : 'None'}`;
    hudCopper.textContent = `Copper: ${player.copper}`;
}

function formatItemName(item) {
     if (!item || !item.type) return 'Unknown Item';
     let name = item.type.charAt(0).toUpperCase() + item.type.slice(1);
     if (item.damage) name += ` (Dmg: ${item.damage})`;
     if (item.healing) name += ` (Heal: ${item.healing})`;
     if (item.defense) name += ` (Def: ${item.defense})`;
     return name;
}

function updateInventoryDisplay() {
    inventoryList.innerHTML = ''; // Clear previous list
    player.inventory.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = formatItemName(item);
        li.dataset.index = index; // Store index for equipping/trading

        // Highlight equipped item
        if (player.equippedItem && player.equippedItem.id === item.id) { // Compare by unique ID if available, else by object ref
            li.classList.add('equipped');
        }
         // Highlight item selected for trade
         if (currentTrade.active && currentTrade.mySelectedItemIndex === index) {
             li.classList.add('selected-for-trade');
         }

        inventoryList.appendChild(li);
    });
     // Also update HUD in case copper changed via inventory actions (like selling)
     updateHUD();
}


function addChatMessage(data, type = 'normal') {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');

    const textSpan = document.createElement('span');
    textSpan.classList.add('text');

    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    timestampSpan.textContent = `[${new Date().toLocaleTimeString()}]`;

    let senderName = 'System';
    if (data.playerId) {
        senderName = (players[data.playerId]?.name || (player.id === data.playerId ? player.name : 'Unknown'));
    } else if (data.senderName) {
        senderName = data.senderName; // Use if provided directly (e.g., system messages)
    }


    if (type === 'system' || !data.playerId) {
        messageDiv.classList.add('system');
        textSpan.innerHTML = data.message; // System messages might have formatting
    } else if (type === 'private') {
        messageDiv.classList.add('private');
        textSpan.innerHTML = `<em>${data.direction === 'to' ? 'To' : 'From'} ${senderName}:</em> ${data.message}`;
    }
    else {
         // Normal user message
         if (data.playerId === player.id) {
            messageDiv.classList.add('user'); // Optional: Style own messages differently
            textSpan.innerHTML = `<strong>You:</strong> ${data.message}`;
         } else {
            textSpan.innerHTML = `<strong>${senderName}:</strong> ${data.message}`;
         }
    }

    messageDiv.appendChild(textSpan);
    messageDiv.appendChild(timestampSpan);
    chatLog.appendChild(messageDiv);

    // Auto-scroll to bottom
    chatLog.scrollTop = chatLog.scrollHeight;

    // Display message above player head (only for non-system, non-private messages)
    if (data.playerId && type === 'normal') {
        playerMessages[data.playerId] = data.message;
        setTimeout(() => {
            if (playerMessages[data.playerId] === data.message) { // Avoid deleting newer message
                 delete playerMessages[data.playerId];
            }
        }, 5000); // Message disappears after 5 seconds
    }
}

function showDialogue(message, duration = 4000) {
    dialogueBox.textContent = message;
    dialogueBox.style.display = 'block';
    setTimeout(() => {
        dialogueBox.style.display = 'none';
    }, duration);
}

// --- Trading Logic (Client-Side) ---

function resetTradeState() {
     currentTrade = {
        active: false,
        isRecipient: false,
        partnerId: null,
        partnerName: null,
        mySelectedItemIndex: null,
        myOfferedCopper: 0,
        theirOffer: { item: null, copper: 0 }
    };
     // Reset UI elements
     tradeModalTitle.textContent = 'Initiate Trade';
     playerSelect.disabled = false;
     initiateTradeSection.style.display = 'block';
     theirOfferSection.style.display = 'none';
     theirOfferDetails.innerHTML = '';
     acceptTradeButton.style.display = 'none';
     declineTradeButton.style.display = 'none';
     sendTradeRequestButton.style.display = 'inline-block';
     offerCopperInput.value = '0';
     offerCopperInput.disabled = false;
     // Clear selection styles
     document.querySelectorAll('#yourItems li.selected').forEach(li => li.classList.remove('selected'));
     updateInventoryDisplay(); // Refresh inventory display to remove trade selection highlight
}

function openTradeModal() {
    resetTradeState(); // Start fresh
    currentTrade.active = true;

    // Populate player list for initiating trade
    playerSelect.innerHTML = '<option value="" disabled selected>-- Select Player --</option>'; // Reset
    Object.values(players).forEach(p => {
        if (p.id !== player.id && p.health > 0) { // Can only trade with alive players
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            playerSelect.appendChild(option);
        }
    });

    // Populate your items list
    populateTradeItemsList();

    tradeModal.style.display = 'flex'; // Show the modal
}

function populateTradeItemsList() {
     yourItemsList.innerHTML = '';
     player.inventory.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = formatItemName(item);
        li.dataset.index = index;
        // Add click listener for selection within the trade modal
        li.addEventListener('click', handleTradeItemSelect);
        yourItemsList.appendChild(li);
    });
}

function handleTradeItemSelect(event) {
     if (!currentTrade.active || currentTrade.isRecipient) return; // Don't allow selection if receiving offer

     const selectedLi = event.target;
     const selectedIndex = parseInt(selectedLi.dataset.index);

     // Toggle selection
     if (currentTrade.mySelectedItemIndex === selectedIndex) {
         currentTrade.mySelectedItemIndex = null; // Deselect
         selectedLi.classList.remove('selected');
     } else {
         // Deselect previous, select new
         const previouslySelected = yourItemsList.querySelector('li.selected');
         if (previouslySelected) {
             previouslySelected.classList.remove('selected');
         }
         currentTrade.mySelectedItemIndex = selectedIndex;
         selectedLi.classList.add('selected');
     }
}


function closeTradeModal() {
    if (!currentTrade.active) return;

    // If we are the recipient of an active offer, closing means declining
    if (currentTrade.isRecipient && currentTrade.partnerId) {
         socket.emit('declineTrade', { senderId: currentTrade.partnerId }); // Notify the original sender
         showDialogue(`Declined trade with ${currentTrade.partnerName}.`);
    }
    // If we initiated a trade that hasn't been responded to, closing means cancelling
    else if (!currentTrade.isRecipient && currentTrade.partnerId) {
         socket.emit('cancelTrade', { recipientId: currentTrade.partnerId }); // Notify the potential recipient
         showDialogue(`Cancelled trade offer to ${currentTrade.partnerName}.`);
    }

    resetTradeState();
    tradeModal.style.display = 'none';
}

function setupTradeUIForReceiving(data) {
     currentTrade.isRecipient = true;
     currentTrade.partnerId = data.senderId;
     currentTrade.partnerName = data.senderName || 'Another Player';
     currentTrade.theirOffer.item = data.offeredItem;
     currentTrade.theirOffer.copper = data.offeredCopper || 0;

     tradeModalTitle.textContent = `Trade Offer From ${currentTrade.partnerName}`;
     initiateTradeSection.style.display = 'none'; // Hide player selection
     theirOfferSection.style.display = 'block';

     let offerText = 'Nothing';
     if (currentTrade.theirOffer.item && currentTrade.theirOffer.copper > 0) {
         offerText = `${formatItemName(currentTrade.theirOffer.item)} and ${currentTrade.theirOffer.copper} Copper`;
     } else if (currentTrade.theirOffer.item) {
         offerText = formatItemName(currentTrade.theirOffer.item);
     } else if (currentTrade.theirOffer.copper > 0) {
         offerText = `${currentTrade.theirOffer.copper} Copper`;
     }
     theirOfferDetails.textContent = `Offering: ${offerText}`;
     tradePartnerNameSpan.textContent = currentTrade.partnerName;


     // Update buttons
     sendTradeRequestButton.style.display = 'none';
     acceptTradeButton.style.display = 'inline-block';
     declineTradeButton.style.display = 'inline-block';

     // Allow player to select items/copper to offer back
     populateTradeItemsList(); // Repopulate items, now they are for *your* counter-offer
     offerCopperInput.disabled = false; // Enable copper input for counter-offer

     // Show the modal if it wasn't already open
     tradeModal.style.display = 'flex';
}

// --- Event Listeners ---
function setupEventListeners() {
    window.addEventListener('resize', adjustCanvasSize);

    document.addEventListener('keydown', (e) => {
        keysPressed[e.key.toLowerCase()] = true; // Use lower case for consistency

        // Prevent browser search on spacebar, etc. if canvas focused
        if (document.activeElement === canvas || document.activeElement === document.body) {
             if (e.key === ' ' || e.key.startsWith('Arrow')) {
                 e.preventDefault();
             }
        }

        // Use item (e.g., potion) when pressing 'e' - only if not typing in chat
        if (e.key.toLowerCase() === 'e' && document.activeElement !== chatInput) {
            useItem('potion'); // Example: use first available potion
        }
    });

    document.addEventListener('keyup', (e) => {
        delete keysPressed[e.key.toLowerCase()];
    });

    // Chat Input
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

     // Prevent keydown events from triggering game actions when chat is focused
    chatInput.addEventListener('focus', () => {
        keysPressed = {}; // Clear pressed keys when chat gains focus
    });


    // Inventory Click (Equip)
    inventoryList.addEventListener('click', (e) => {
        if (e.target && e.target.nodeName === 'LI') {
            const itemIndex = parseInt(e.target.dataset.index);
            const item = player.inventory[itemIndex];
            if (item) {
                // Simple equip logic: Unequip current, equip new if different
                // Only equip 'sword', 'shield', 'staff' types for now
                if (['sword', 'shield', 'staff'].includes(item.type)) {
                    if (player.equippedItem && player.equippedItem.id === item.id) {
                        player.equippedItem = null; // Unequip if clicking the same equipped item
                    } else {
                         // Check if equipping a shield while sword/staff is equipped, or vice-versa (allow both)
                         // Simple approach: just equip the new one. Improve later if needed (e.g., weapon/offhand slots)
                        player.equippedItem = item;
                         // TODO: Maybe emit 'equipItem' to server if needed for stats/effects?
                    }
                    updateInventoryDisplay(); // Update highlight
                    updateHUD(); // Update HUD equipped display
                } else if (item.type === 'potion') {
                    // Use potion immediately on click? Or keep 'e' key?
                    // showDialogue(`Selected potion. Press 'E' to use.`);
                }
            }
        }
    });

    // Trade Button
    tradeButton.addEventListener('click', openTradeModal);

    // Trade Modal Buttons
    sendTradeRequestButton.addEventListener('click', () => {
        const selectedPlayerId = playerSelect.value;
        const offeredCopper = parseInt(offerCopperInput.value) || 0;
        // Find the index of the selected item LI element
        const selectedLi = yourItemsList.querySelector('li.selected');
        const offeredItemIndex = selectedLi ? parseInt(selectedLi.dataset.index) : null;


        if (!selectedPlayerId) {
            return showDialogue('Please select a player to trade with.');
        }
        if (offeredItemIndex === null && offeredCopper <= 0) {
            return showDialogue('You must offer an item or copper.');
        }
         if (!players[selectedPlayerId]) {
             return showDialogue('Selected player is no longer available.');
         }

         currentTrade.partnerId = selectedPlayerId; // Store who we sent it to
         currentTrade.partnerName = players[selectedPlayerId].name;


        socket.emit('tradeRequest', {
            recipientId: selectedPlayerId,
            offeredItemIndex: offeredItemIndex, // Send index
            offeredCopper: offeredCopper
        });

        showDialogue(`Sending trade request to ${players[selectedPlayerId]?.name || 'player'}...`);
        // Keep modal open but maybe disable inputs until response? Or close and wait?
        // Let's close it for simplicity now.
        resetTradeState();
        tradeModal.style.display = 'none';
    });

    acceptTradeButton.addEventListener('click', () => {
        if (!currentTrade.isRecipient || !currentTrade.partnerId) return;

        const selectedLi = yourItemsList.querySelector('li.selected');
        const requestedItemIndex = selectedLi ? parseInt(selectedLi.dataset.index) : null;
        const requestedCopper = parseInt(offerCopperInput.value) || 0;

         // Basic validation before sending acceptance
         if (requestedCopper < 0 || (requestedCopper > 0 && player.copper < requestedCopper)) {
            return showDialogue("You don't have enough copper to offer.");
        }
         if (requestedItemIndex !== null && !player.inventory[requestedItemIndex]) {
             return showDialogue("The item you selected to offer is no longer in your inventory.");
         }


        socket.emit('acceptTrade', {
            senderId: currentTrade.partnerId, // The ID of the person who INITIATED the trade
            requestedItemIndex: requestedItemIndex, // What YOU are giving (index)
            requestedCopper: requestedCopper     // What YOU are giving (copper)
        });

        // UI will update on 'tradeSuccess' or 'tradeError'
        // Temporarily disable buttons?
        acceptTradeButton.disabled = true;
        declineTradeButton.disabled = true;
    });

    declineTradeButton.addEventListener('click', () => {
        if (!currentTrade.isRecipient || !currentTrade.partnerId) return;

        socket.emit('declineTrade', { senderId: currentTrade.partnerId });
        showDialogue(`Declined trade with ${currentTrade.partnerName}.`);
        closeTradeModal(); // Also resets state
    });

    closeTradeModalButton.addEventListener('click', closeTradeModal);
}

// Function to handle chat input (messages and commands)
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    if (message.startsWith('/')) {
        handleCommand(message);
    } else {
        socket.emit('chatMessage', { message });
    }
    chatInput.value = ''; // Clear input field
}

// Handle slash commands
function handleCommand(message) {
    const parts = message.split(' ');
    const command = parts[0].substring(1).toLowerCase();
    const args = parts.slice(1);

    switch (command) {
        case 'w':
        case 'msg':
        case 'tell':
            const recipientName = args[0];
            const privateMessage = args.slice(1).join(' ');
            if (recipientName && privateMessage) {
                 // Find recipient ID (case-insensitive search)
                 const recipient = Object.values(players).find(p => p.name.toLowerCase() === recipientName.toLowerCase());
                if (recipient && recipient.id !== player.id) {
                    socket.emit('privateMessage', { recipientId: recipient.id, message: privateMessage });
                } else if (recipient && recipient.id === player.id) {
                     addChatMessage({ message: "You can't whisper to yourself." }, 'system');
                }
                 else {
                    addChatMessage({ message: `Player '${recipientName}' not found or is offline.` }, 'system');
                }
            } else {
                addChatMessage({ message: 'Usage: /msg <PlayerName> <Your Message>' }, 'system');
            }
            break;

        case 'players':
        case 'who':
            const playerNames = Object.values(players).map(p => p.name).join(', ');
            addChatMessage({ message: `Online (${Object.keys(players).length}): ${playerNames || 'Just you!'}` }, 'system');
            break;

         case 'help':
             addChatMessage({ message: 'Available commands: /msg [name] [message], /players, /help' }, 'system');
             break;

        default:
            addChatMessage({ message: `Unknown command: '${command}'. Type /help for options.` }, 'system');
            break;
    }
}

// Function to use an item from inventory
function useItem(itemType) {
    const itemIndex = player.inventory.findIndex(item => item.type === itemType);
    if (itemIndex !== -1) {
        const item = player.inventory[itemIndex]; // Get item ref before potential splice

        if (item.type === 'potion') {
            if (player.health >= player.maxHealth) {
                showDialogue("Your health is already full!");
                return;
            }
            // Send request to server to use item
            socket.emit('useItem', { itemIndex: itemIndex });
            // Optimistic UI update (server will confirm)
            player.health = Math.min(player.maxHealth, player.health + (item.healing || 0));
            player.inventory.splice(itemIndex, 1); // Remove locally for responsiveness
            showDialogue(`Used ${formatItemName(item)}.`);
            updateInventoryDisplay();
            updateHUD();
        }
        // Add logic for other usable items here
    } else {
        showDialogue(`You don't have any ${itemType}s.`);
    }
}


// --- Socket Event Handlers ---
function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        // Player ID is set upon receiving 'assignId' or 'currentPlayers'
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server.');
        showDialogue('Disconnected from server!', 10000);
        // Reset game state? Grey out screen?
         player.id = null;
         players = {};
         enemies = {};
         items = {};
         gameWorld = [];
    });

    socket.on('connect_error', (err) => {
        console.error('Connection Error:', err.message);
        showDialogue(`Connection failed: ${err.message}. Trying to reconnect...`, 10000);
    });

    // 1. Receive World Data
    socket.on('worldData', (data) => {
        console.log("Received world data.");
        gameWorld = data.map;
        // If player ID already known, we can start the game loop
        if (player.id) {
             lastRenderTime = performance.now(); // Reset timer
             requestAnimationFrame(gameLoop);
        }
    });

     // 2. Receive Player ID and Initial State
    socket.on('assignId', (assignedData) => {
        console.log(`Assigned ID: ${assignedData.id}, Name: ${assignedData.name}`);
        player.id = assignedData.id;
        player.name = assignedData.name;
        player.x = assignedData.x;
        player.y = assignedData.y;
        player.targetX = assignedData.x; // Init interpolation target
        player.targetY = assignedData.y;
        player.health = assignedData.health;
        player.maxHealth = assignedData.maxHealth;
        player.copper = assignedData.copper;
        player.inventory = assignedData.inventory || [];
        player.sprite = spriteImages.player; // Assign loaded sprite

        updateInventoryDisplay();
        updateHUD();

        // If world already received, start game loop
        if (gameWorld.length > 0) {
            lastRenderTime = performance.now(); // Reset timer
            requestAnimationFrame(gameLoop);
        }
    });


    // 3. Receive Full Game State (Players, Items, Enemies) - Can replace assignId + currentPlayers/Items/Enemies
    // socket.on('gameState', (state) => {
    //    // Process players
    //    const serverPlayers = state.players || {};
    //    players = {}; // Reset local players map
    //    for(const id in serverPlayers) {
    //        if (id === socket.id) { // Found self
    //            Object.assign(player, serverPlayers[id]); // Update local player data
    //            player.id = socket.id; // Ensure ID is set
    //            player.targetX = player.x;
    //            player.targetY = player.y;
    //            player.sprite = spriteImages.player;
    //        } else { // Other player
    //            players[id] = serverPlayers[id];
    //            players[id].sprite = spriteImages.player; // Assign sprite
    //            players[id].targetX = players[id].x; // Init interpolation target
    //            players[id].targetY = players[id].y;
    //        }
    //    }
    //
    //    // Process items
    //    items = state.items || {};
    //
    //    // Process enemies
    //    enemies = {}; // Reset
    //    const serverEnemies = state.enemies || {};
    //    for (const id in serverEnemies) {
    //         enemies[id] = serverEnemies[id];
    //         const enemySpriteKey = enemies[id].type || 'enemy_basic';
    //         enemies[id].sprite = spriteImages[enemySpriteKey];
    //         enemies[id].targetX = enemies[id].x; // Init interpolation target
    //         enemies[id].targetY = enemies[id].y;
    //         enemies[id].animationTimer = 0; // Reset animation timer
    //    }
    //
    //    gameWorld = state.world || []; // Get world map
    //
    //    console.log("Received initial game state.");
    //    updateInventoryDisplay();
    //    updateHUD();
    //
    //    // Start game loop if not already started
    //    if (player.id && gameWorld.length > 0 && lastRenderTime === 0) {
    //         lastRenderTime = performance.now();
    //         requestAnimationFrame(gameLoop);
    //    }
    // });


    // Player Updates
    socket.on('playerJoined', (playerData) => {
        if (playerData.id === player.id) return; // Ignore self
        console.log('Player joined:', playerData.name);
        players[playerData.id] = playerData;
        players[playerData.id].sprite = spriteImages.player; // Assign default sprite
        // Initialize interpolation targets
        players[playerData.id].targetX = playerData.x;
        players[playerData.id].targetY = playerData.y;
        players[playerData.id].currentFrame = 0; // Initialize animation frame
        addChatMessage({ senderName: playerData.name, message: 'has joined the game.' }, 'system');
    });

    socket.on('playerLeft', (playerId) => {
         if (players[playerId]) {
             console.log('Player left:', players[playerId].name);
             addChatMessage({ senderName: players[playerId].name, message: 'has left the game.' }, 'system');
             delete players[playerId];
         }
         // If this player was involved in a trade, cancel it
         if (currentTrade.active && currentTrade.partnerId === playerId) {
             showDialogue(`${currentTrade.partnerName} disconnected. Trade cancelled.`);
             closeTradeModal(); // Resets state and closes
         }
    });

    socket.on('playerMoved', (data) => {
        // Update the target position for interpolation
        if (player.id === data.playerId) { // Update local player's target to server position
             player.targetX = data.x;
             player.targetY = data.y;
             player.direction = data.direction; // Update direction immediately
             player.moving = data.moving; // Update moving state based on server
             // Optional: Server could send validated frameIndex, but client anim usually handles it
        } else if (players[data.playerId]) { // Update other players
            players[data.playerId].targetX = data.x;
            players[data.playerId].targetY = data.y;
            players[data.playerId].direction = data.direction;
            players[data.playerId].moving = data.moving; // Use for their animation state
            // players[data.playerId].frameIndex = data.frameIndex; // If server sends frame index
        }
    });

     // Force position correction from server (e.g., due to failed validation)
     socket.on('forcePosition', (data) => {
        if (player.id) {
            console.log("Server corrected position.");
            player.x = data.x;
            player.y = data.y;
            player.targetX = data.x; // Snap target as well
            player.targetY = data.y;
        }
    });

    // Combat & Health Updates
    socket.on('playerDamaged', (data) => {
        // Find the character (player or other player)
        let target = null;
        if (data.playerId === player.id) {
            target = player;
            showDialogue(`Ouch! Took ${data.damage} damage!`, 2000); // Show message to self
        } else if (players[data.playerId]) {
            target = players[data.playerId];
        }

        if (target) {
            target.health = data.newHealth; // Update health based on server message
             displayDamageNumber(data.damage, target.x, target.y); // Show visual feedback
            // target.lastDamageTime = Date.now(); // For flashing effect

            if (target === player) updateHUD(); // Update local player HUD
        }
    });

     socket.on('enemyDamaged', (data) => {
        if (enemies[data.enemyId]) {
            enemies[data.enemyId].health = data.newHealth;
             displayDamageNumber(data.damage, enemies[data.enemyId].x, enemies[data.enemyId].y);
        }
    });


    socket.on('playerKilled', (data) => {
        if (data.playerId === player.id) {
            showDialogue(`You were killed by ${data.killerName || 'something'}!`, 10000);
            // Handle player death - maybe show a respawn button or overlay
            player.health = 0;
             keysPressed = {}; // Stop movement
            updateHUD();
             // Optional: reload page after a delay
             // setTimeout(() => window.location.reload(), 5000);
        } else if (players[data.playerId]) {
            addChatMessage({ message: `${players[data.playerId].name} was killed by ${data.killerName || 'something'}.` }, 'system');
             players[data.playerId].health = 0; // Mark as dead visually
             // Optionally remove from players map after a delay or fade out
        }
    });

    socket.on('enemyKilled', (data) => {
        if (enemies[data.enemyId]) {
            // Optional: Play death animation/effect
            delete enemies[data.enemyId];
            addChatMessage({ message: `You defeated the enemy!` + (data.copperReward ? ` (+${data.copperReward} Copper)` : '') }, 'system');
            // Copper/inventory updates handled by specific events below
        }
    });

     // Item/Inventory Updates
    socket.on('updateInventory', (newInventory) => {
        player.inventory = newInventory;
        updateInventoryDisplay();
    });

    socket.on('updateCopper', (newCopperAmount) => {
        player.copper = newCopperAmount;
        updateHUD();
    });


    socket.on('itemPickedUp', (data) => {
        // Server now sends 'updateInventory' and 'updateCopper' instead
        // Just remove the item visually from the world
        if (items[data.itemId]) {
             delete items[data.itemId];
             // Optional: confirmation message
             if (data.playerId === player.id) {
                showDialogue(`Picked up ${formatItemName(data.item)}.`, 2000);
             }
        }
    });

     socket.on('itemUsed', (data) => {
        if (data.playerId === player.id) {
            // Server confirmed item use, update health if needed (e.g., potion)
            if (data.effect === 'heal') {
                player.health = data.newHealth;
                updateHUD();
            }
            // Inventory is already updated via 'updateInventory' event from server
            // showDialogue(`Used ${formatItemName(data.item)}.`, 1500);
        }
        // We might need to remove item from inventory again if server sends index?
        // Best practice: Server sends full new inventory state via 'updateInventory'.
    });

    socket.on('currentItems', (serverItems) => {
        items = serverItems;
    });

     socket.on('updateEnemies', (serverEnemies) => {
        // Update existing enemies, add new ones, remove old ones
        const currentEnemyIds = Object.keys(enemies);
        const serverEnemyIds = Object.keys(serverEnemies);

        // Add/Update
        serverEnemyIds.forEach(id => {
            const data = serverEnemies[id];
            if (enemies[id]) {
                // Update existing enemy target position and state
                enemies[id].targetX = data.x;
                enemies[id].targetY = data.y;
                 enemies[id].health = data.health; // Keep health synced
                 enemies[id].direction = data.direction;
                 enemies[id].moving = data.moving; // Use for animation
                 // Don't snap x/y directly, let interpolation handle it
            } else {
                // Add new enemy
                 enemies[id] = data;
                 const enemySpriteKey = enemies[id].type || 'enemy_basic';
                 enemies[id].sprite = spriteImages[enemySpriteKey] || spriteImages['enemy_basic']; // Assign sprite
                 enemies[id].targetX = data.x; // Initialize target for interpolation
                 enemies[id].targetY = data.y;
                 enemies[id].x = data.x; // Initial position snap
                 enemies[id].y = data.y;
                 enemies[id].animationTimer = 0;
                 enemies[id].frameIndex = 0;
                 console.log(`Enemy spawned: ${id} (${enemies[id].type})`);
            }
        });

        // Remove
        currentEnemyIds.forEach(id => {
            if (!serverEnemies[id]) {
                 console.log(`Enemy removed: ${id}`);
                delete enemies[id];
            }
        });
    });

    // Chat Updates
    socket.on('chatMessage', (data) => {
        addChatMessage(data, 'normal');
    });

    socket.on('privateMessage', (data) => {
        addChatMessage(data, 'private');
    });

     socket.on('chatError', (message) => {
         addChatMessage({ message: `Error: ${message}` }, 'system');
     });

     // Trading Updates
     socket.on('tradeRequest', (data) => {
         // Only show if not already in a trade
         if (!currentTrade.active) {
             setupTradeUIForReceiving(data);
             showDialogue(`${data.senderName} wants to trade. Open the Trade window!`); // Prompt user
         } else {
             // Auto-decline if busy?
             socket.emit('declineTrade', { senderId: data.senderId, reason: "Busy" });
         }
     });

     socket.on('tradeSuccess', (data) => {
         showDialogue(`Trade with ${currentTrade.partnerName || 'player'} successful!`, 5000);
         // Server should send updated inventory/copper via separate events
         closeTradeModal(); // Reset state and close
     });

     socket.on('tradeError', (message) => {
         showDialogue(`Trade Error: ${message}`, 5000);
         // Re-enable buttons if they were disabled during accept attempt
          acceptTradeButton.disabled = false;
          declineTradeButton.disabled = false;
         // Don't automatically close modal on error, let user decide.
     });

     socket.on('tradeDeclined', (data) => {
         // data might contain { recipientName } or { senderName } depending on who declined
         showDialogue(data.message || `Trade was declined.`, 4000);
          if (currentTrade.active && (currentTrade.partnerId === data.senderId || currentTrade.partnerId === data.recipientId)) {
             closeTradeModal(); // Close if the declined trade was the one we were involved in
         }
     });

     socket.on('tradeCancelled', (data) => {
         showDialogue(data.message || `Trade was cancelled.`, 4000);
         if (currentTrade.active && currentTrade.isRecipient && currentTrade.partnerId === data.senderId) {
            closeTradeModal(); // Close if the offer we were looking at was cancelled
         }
     });

      socket.on('tradeExpired', (data) => {
          showDialogue(`Trade offer ${data.senderName ? 'from ' + data.senderName : (data.recipientName ? 'to ' + data.recipientName : '')} expired.`, 5000);
         if (currentTrade.active && (currentTrade.partnerId === data.senderId || currentTrade.partnerId === data.recipientId)) {
             closeTradeModal(); // Close if the expired trade was the one we were involved in
         }
     });


     // Misc
     socket.on('rewardCode', (code) => {
         showDialogue(`Reward Code Earned: ${code}`, 10000);
         addChatMessage({ message: `You received a reward code: ${code}`}, 'system');
     });

}

// --- Start ---
function initializeGame() {
    console.log("Initializing game...");
    adjustCanvasSize();
    setupEventListeners();
    setupSocketListeners();

    // Load assets, then connect or wait for connection
    loadTileImages(() => {
        loadSpriteImages(() => {
            console.log("Assets loaded. Waiting for server connection and data...");
            // Game loop will be started by socket event handlers once ready
        });
    });
}

initializeGame();