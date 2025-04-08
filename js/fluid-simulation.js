// Import lil-gui
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.18/dist/lil-gui.esm.min.js'; // Updated lil-gui

// --- Polyfill for EffectComposer dependencies if using modules and CDN ---
// This might be needed depending on how Three.js examples structure their exports via CDN
// If you get errors like "THREE.EffectComposer is not a constructor", you might need these.
// Alternatively, use a build setup (like Vite, Webpack) for cleaner imports.
const THREE = window.THREE;
if (!THREE.EffectComposer) THREE.EffectComposer = window.EffectComposer;
if (!THREE.RenderPass) THREE.RenderPass = window.RenderPass;
if (!THREE.UnrealBloomPass) THREE.UnrealBloomPass = window.UnrealBloomPass;
// --- End Polyfill ---


console.log("--- Advanced Fluid Simulation Script START ---");

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- DOMContentLoaded Fired ---");

    // --- Constants ---
    const FRUSTUM_SIZE = 120; // Slightly larger view
    const MAX_PARTICLES = 20000; // Maximum particles allowed by buffer size

    // --- State Variables ---
    let mouseX = 0, mouseY = 0;
    let isAttracting = false, isRepelling = false, isVortexing = false, isStirring = false;
    let interactionRing = null;
    const obstacleMeshes = [];
    let tempColor = new THREE.Color();
    let baseColor = new THREE.Color();
    let touchIdentifier = null;
    let particleSystem = null; // Will hold THREE.Points
    let geometry = null;       // Will hold THREE.BufferGeometry
    let material = null;       // Will hold THREE.PointsMaterial
    let positions = null, velocities = null, colors = null, initialPositions = null; // Buffers
    let composer = null, bloomPass = null; // For post-processing

    // --- Spatial Grid Variables ---
    let grid = {}; // Stores particle indices per cell { 'x_y': [index1, index2,...] }
    let gridCellSize = 0; // Calculated based on interaction radius
    let gridWidth = 0, gridHeight = 0; // Grid dimensions in cells
    let gridOriginX = 0, gridOriginY = 0; // World coords of grid cell (0,0)


    // --- Simulation Parameters ---
    const params = {
        // --- Performance & Core ---
        particlesCount: 5000,    // Default particle count
        paused: false,
        // --- Physics ---
        damping: 0.96,          // Slightly more damping for smoother flow
        edgeDamping: 0.6,       // Less bounce at edges
        maxVelocity: 2.5,
        containerRadius: 55,
        gravityStrength: 0.04,
        gravityEnabled: false,
        // --- Mouse Interaction ---
        interactionRadius: 10.0,
        attractionStrength: 0.15,
        repellingStrength: 0.30,
        vortexStrength: 0.15,
        stirStrength: 0.10,
        showInteractionRadius: true,
        // --- Particle Physics ---
        particleRepulsionRadius: 3.5, // Smaller default, relies more on grid proximity
        repulsionStrength: 0.25,
        cohesionRadius: 7.0,
        cohesionStrength: 0.01,
        // --- Visualization ---
        particleBaseColor: '#40E0D0', // Turquoise default
        particleVelocityColorScale: 3.0,
        particleSize: 1.8,
        bgColor: '#050510',       // Base background (matches CSS)
        // --- Post-Processing (Bloom) ---
        bloomEnabled: true,
        bloomStrength: 0.4,
        bloomRadius: 0.3,
        bloomThreshold: 0.65,
        // --- Obstacles ---
        obstacles: [
            { x: -25, y: 20, radius: 10 },
            { x: 30, y: -15, radius: 14 },
            { x: 0, y: -35, radius: 6 }
        ],
        enableObstacles: true,
    };
    baseColor.set(params.particleBaseColor);

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(
        FRUSTUM_SIZE * aspect / -2, FRUSTUM_SIZE * aspect / 2,
        FRUSTUM_SIZE / 2, FRUSTUM_SIZE / -2, 1, 1000
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(params.bgColor, 1); // Use param color
    // renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optional: Limit pixel ratio for performance
    document.body.appendChild(renderer.domElement);

    // --- Post-Processing Setup ---
    function setupEffectComposer() {
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));

        bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            params.bloomStrength,
            params.bloomRadius,
            params.bloomThreshold
        );
        composer.addPass(bloomPass);
        bloomPass.enabled = params.bloomEnabled; // Set initial state
        console.log("EffectComposer and BloomPass setup.");
    }
    setupEffectComposer();


    // --- Helper Functions ---
    function updateBackgroundColor() {
        // Only update renderer clear color now, CSS gradient is less important with bloom
        renderer.setClearColor(params.bgColor, 1);
        document.body.style.backgroundColor = params.bgColor; // Update body too
    }

    function getSimulationCoords(clientX, clientY) {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        const vec = new THREE.Vector3(x, y, 0.5);
        vec.unproject(camera);
        return { x: vec.x, y: vec.y };
    }

    function createInteractionRing() {
        if (interactionRing) scene.remove(interactionRing);
        const ringGeometry = new THREE.RingGeometry(params.interactionRadius - 0.15, params.interactionRadius + 0.15, 48); // Smoother ring
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.3, depthWrite: false });
        interactionRing = new THREE.Mesh(ringGeometry, ringMaterial);
        interactionRing.visible = params.showInteractionRadius;
        interactionRing.position.z = 1;
        scene.add(interactionRing);
    }

    function createObstacleMeshes() {
        obstacleMeshes.forEach(mesh => scene.remove(mesh));
        obstacleMeshes.length = 0;
        if (params.enableObstacles) {
            params.obstacles.forEach((obs) => {
                const geometry = new THREE.CircleGeometry(obs.radius, 32);
                // Slightly more visible obstacles
                const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(geometry, meshMaterial);
                mesh.position.set(obs.x, obs.y, -1);
                scene.add(mesh);
                obstacleMeshes.push(mesh);
            });
        }
    }

    // --- Spatial Grid Functions ---
    function setupSpatialGrid() {
        // Determine cell size based on the larger of repulsion/cohesion radius for efficiency
        gridCellSize = Math.max(params.particleRepulsionRadius, params.cohesionRadius, 1.0); // Ensure minimum size 1
        const worldSize = params.containerRadius * 2.5; // Extend grid slightly beyond container
        gridWidth = Math.ceil(worldSize / gridCellSize);
        gridHeight = Math.ceil(worldSize / gridCellSize);
        gridOriginX = -worldSize / 2;
        gridOriginY = -worldSize / 2;
        grid = {}; // Clear the grid data structure
        // console.log(`Grid setup: ${gridWidth}x${gridHeight} cells, size ${gridCellSize.toFixed(2)}`);
    }

    function getCellCoords(x, y) {
        const cellX = Math.floor((x - gridOriginX) / gridCellSize);
        const cellY = Math.floor((y - gridOriginY) / gridCellSize);
        return { cellX, cellY };
    }

    function getCellKey(cellX, cellY) {
        return `${cellX}_${cellY}`;
    }

    function updateGrid() {
        grid = {}; // Clear grid
        const posArray = geometry.attributes.position.array;
        for (let i = 0; i < params.particlesCount; i++) {
            const { cellX, cellY } = getCellCoords(posArray[i * 3], posArray[i * 3 + 1]);
            const key = getCellKey(cellX, cellY);
            if (!grid[key]) {
                grid[key] = [];
            }
            grid[key].push(i); // Store particle index in the cell
        }
    }

    function getNeighbors(particleIndex) {
        const neighbors = [];
        const posArray = geometry.attributes.position.array;
        const { cellX, cellY } = getCellCoords(posArray[particleIndex * 3], posArray[particleIndex * 3 + 1]);

        // Check current cell and 8 surrounding cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const checkX = cellX + dx;
                const checkY = cellY + dy;
                const key = getCellKey(checkX, checkY);
                if (grid[key]) {
                    // Add all particles from this neighboring cell
                    neighbors.push(...grid[key]);
                }
            }
        }
        return neighbors;
    }


    // --- Particle Initialization & Management ---
    function initializeParticles(count, fullReset = true) {
        console.log(`Initializing ${count} particles...`);
        geometry = new THREE.BufferGeometry();

        // Allocate maximum size buffers initially if possible, or resize as needed
        // For simplicity here, we'll reallocate on count change.
        positions = new Float32Array(count * 3);
        velocities = new Float32Array(count * 3);
        colors = new Float32Array(count * 3);
        if(fullReset) {
             initialPositions = new Float32Array(count * 3);
        } else {
            // If not a full reset, try to preserve existing initial positions
            const oldInitial = initialPositions;
            initialPositions = new Float32Array(count * 3);
            if (oldInitial) {
                 initialPositions.set(oldInitial.slice(0, Math.min(oldInitial.length, initialPositions.length)));
            }
        }


        tempColor = new THREE.Color();
        baseColor.set(params.particleBaseColor);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            // Slightly more distributed start
            const radius = Math.pow(Math.random(), 0.7) * params.containerRadius * 0.9 + params.containerRadius * 0.05;
            const angle = Math.random() * Math.PI * 2;

            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = Math.sin(angle) * radius;
            positions[i3 + 2] = 0;

            if(fullReset || i >= (initialPositions.length / 3)) { // Only set new initial pos if full reset or new particle
                 initialPositions[i3] = positions[i3];
                 initialPositions[i3 + 1] = positions[i3 + 1];
                 initialPositions[i3 + 2] = positions[i3 + 2];
            }


            velocities[i3] = (Math.random() - 0.5) * 0.2;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
            velocities[i3 + 2] = 0;

            tempColor.set(baseColor); // Use base color initially
            colors[i3] = tempColor.r;
            colors[i3 + 1] = tempColor.g;
            colors[i3 + 2] = tempColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Dispose old material if it exists
        if (material) material.dispose();

        material = new THREE.PointsMaterial({
            size: params.particleSize,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true, // Needed for nice additive blending
            opacity: 0.85       // Slight transparency can look good with bloom
        });

        // Dispose old particle system if it exists
        if (particleSystem) scene.remove(particleSystem);

        particleSystem = new THREE.Points(geometry, material);
        scene.add(particleSystem);

        // Mark attributes for update
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        console.log("Particles Initialized.");
    }

    function updateParticleCount(newCount) {
        newCount = Math.max(10, Math.min(newCount, MAX_PARTICLES)); // Clamp count
        if (newCount === params.particlesCount) return;

        console.log(`Updating particle count to ${newCount}...`);
        const oldCount = params.particlesCount;
        params.particlesCount = newCount;

        // Re-initialize, preserving old initial positions if possible
        initializeParticles(newCount, false); // false = don't fully reset initial positions array

        // If reducing count, reset velocities/colors for removed particles (not strictly necessary but clean)
        if (newCount < oldCount) {
            // Not explicitly needed as loops now use params.particlesCount
        }

        // Update GUI display
        gui.controllersRecursive().forEach(c => {
            if (c.property === 'particlesCount') c.updateDisplay();
        });
        console.log("Particle count updated.");
    }


    function resetSimulation() {
        console.log("--- Resetting Simulation ---");
        if (!geometry || !initialPositions || !velocities || !colors) {
            console.error("Cannot reset, buffers not initialized.");
            initializeParticles(params.particlesCount, true); // Force full init
            return;
        }

        const currentCount = params.particlesCount;
        if (initialPositions.length / 3 !== currentCount) {
             console.warn("Initial positions length mismatch, performing full reinitialization.");
             initializeParticles(currentCount, true);
        } else {
             positions.set(initialPositions.slice(0, currentCount * 3)); // Use slice to ensure correct length
             velocities.fill(0); // Reset all velocities in buffer
             baseColor.set(params.particleBaseColor);
             tempColor.set(baseColor);
             for (let i = 0; i < currentCount; i++) {
                const i3 = i * 3;
                colors[i3] = tempColor.r;
                colors[i3 + 1] = tempColor.g;
                colors[i3 + 2] = tempColor.b;
             }
             geometry.attributes.position.needsUpdate = true;
             geometry.attributes.color.needsUpdate = true;
        }


        params.paused = false;
        // Force update all GUI controllers
        gui.controllersRecursive().forEach(controller => controller.updateDisplay());
        console.log("Simulation Reset Complete.");
    }

    // --- GUI Setup ---
    console.log("Setting up GUI...");
    const gui = new GUI();
    gui.title("Fluid Controls");

    const perfFolder = gui.addFolder('Performance & Core');
    perfFolder.add(params, 'particlesCount', 100, MAX_PARTICLES, 100) // Step by 100
        .name('Particle Count')
        .onFinishChange(updateParticleCount); // Update count when slider released
    perfFolder.add(params, 'paused').name('Pause (P)').listen();
    perfFolder.add({ reset: resetSimulation }, 'reset').name('Reset (R)');
    perfFolder.open();

    const physicsFolder = gui.addFolder('Physics');
    physicsFolder.add(params, 'damping', 0.85, 1.0, 0.005).name('Damping');
    physicsFolder.add(params, 'edgeDamping', 0.0, 1.5, 0.05).name('Edge Damping');
    physicsFolder.add(params, 'maxVelocity', 0.5, 10.0, 0.1).name('Max Velocity');
    physicsFolder.add(params, 'gravityEnabled').name('Enable Gravity (G)').listen();
    physicsFolder.add(params, 'gravityStrength', 0.0, 0.2, 0.005).name('Gravity Strength');
    physicsFolder.add(params, 'containerRadius', 20, 100, 1).name('Container Radius')
        .onFinishChange(setupSpatialGrid); // Recalculate grid if container size changes
    physicsFolder.open();

    const mouseFolder = gui.addFolder('Mouse Interaction');
    mouseFolder.add(params, 'interactionRadius', 1, 40, 0.5).name('Mouse Radius').onChange(createInteractionRing);
    mouseFolder.add(params, 'attractionStrength', 0.0, 0.8, 0.01).name('Attraction Str.');
    mouseFolder.add(params, 'repellingStrength', 0.0, 1.2, 0.01).name('Repulsion Str.');
    mouseFolder.add(params, 'vortexStrength', 0.0, 0.6, 0.01).name('Vortex Str.');
    mouseFolder.add(params, 'stirStrength', 0.0, 0.6, 0.01).name('Stir Str.');
    mouseFolder.add(params, 'showInteractionRadius').name('Show Mouse Radius').onChange(v => interactionRing.visible = v);
    mouseFolder.open();

    const particlePhysicsFolder = gui.addFolder('Particle Physics');
    particlePhysicsFolder.add(params, 'particleRepulsionRadius', 0.5, 20.0, 0.1).name('Repulsion Radius')
        .onFinishChange(setupSpatialGrid); // Grid depends on this
    particlePhysicsFolder.add(params, 'repulsionStrength', 0.0, 1.0, 0.01).name('Repulsion Str.');
    particlePhysicsFolder.add(params, 'cohesionRadius', 1.0, 30.0, 0.1).name('Cohesion Radius')
         .onFinishChange(setupSpatialGrid); // Grid depends on this
    particlePhysicsFolder.add(params, 'cohesionStrength', 0.0, 0.1, 0.001).name('Cohesion Str.');
    particlePhysicsFolder.open();

    const vizFolder = gui.addFolder('Visualization');
    vizFolder.addColor(params, 'particleBaseColor').name('Base Color').onChange(value => baseColor.set(value));
    vizFolder.add(params, 'particleVelocityColorScale', 0, 15, 0.1).name('Velocity Color Scale');
    vizFolder.add(params, 'particleSize', 0.1, 10.0, 0.1).name('Particle Size').onChange(value => {
        if (material) material.size = value;
    });
    vizFolder.addColor(params, 'bgColor').name('Background Color').onChange(updateBackgroundColor);
    vizFolder.open();

    const bloomFolder = gui.addFolder('Bloom Effect');
    bloomFolder.add(params, 'bloomEnabled').name('Enable Bloom').onChange(v => bloomPass.enabled = v);
    bloomFolder.add(params, 'bloomStrength', 0.0, 2.0, 0.05).name('Strength').onChange(v => bloomPass.strength = v);
    bloomFolder.add(params, 'bloomRadius', 0.0, 2.0, 0.05).name('Radius').onChange(v => bloomPass.radius = v);
    bloomFolder.add(params, 'bloomThreshold', 0.0, 1.0, 0.01).name('Threshold').onChange(v => bloomPass.threshold = v);
    bloomFolder.open();


    const obstacleFolder = gui.addFolder('Obstacles');
    obstacleFolder.add(params, 'enableObstacles').name('Enable Obstacles').onChange(createObstacleMeshes);
    obstacleFolder.open();

    console.log("GUI Setup Complete.");

    // --- Initial Setup Calls ---
    updateBackgroundColor();
    createInteractionRing();
    createObstacleMeshes();
    setupSpatialGrid(); // Setup grid before initializing particles
    initializeParticles(params.particlesCount, true); // Initial particle creation

    // --- Event Listeners ---
    console.log("Adding event listeners...");
    // --- Mouse Movement ---
    window.addEventListener('mousemove', (event) => {
        const coords = getSimulationCoords(event.clientX, event.clientY);
        mouseX = coords.x;
        mouseY = coords.y;
        if (interactionRing) interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);
    });
    // --- Mouse Buttons ---
    window.addEventListener('mousedown', (event) => {
        if (event.target !== renderer.domElement) return; // Ignore GUI clicks
        if (event.button === 0) { // Left
            if (event.shiftKey) { isVortexing = true; isAttracting = false; isRepelling = false; isStirring = false; }
            else if (event.ctrlKey || event.metaKey) { isStirring = true; isAttracting = false; isRepelling = false; isVortexing = false; }
            else { isAttracting = true; isRepelling = false; isVortexing = false; isStirring = false; }
        } else if (event.button === 1) { // Middle
            isVortexing = true; isAttracting = false; isRepelling = false; isStirring = false; event.preventDefault();
        } else if (event.button === 2) { // Right
            isRepelling = true; isAttracting = false; isVortexing = false; isStirring = false;
        }
    });
    window.addEventListener('mouseup', () => { isAttracting = false; isRepelling = false; isVortexing = false; isStirring = false; });
    renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault()); // Prevent menu on canvas

    // --- Keyboard ---
    window.addEventListener('keydown', (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return; // Ignore GUI typing
        switch (event.key.toUpperCase()) {
            case 'G': params.gravityEnabled = !params.gravityEnabled; break;
            case 'P': params.paused = !params.paused; break;
            case 'R': resetSimulation(); break;
        }
    });
    // --- Touch --- (Simplified - Attract only)
    renderer.domElement.addEventListener('touchstart', (event) => {
        if (event.touches.length > 0) {
             const touch = event.touches[0]; touchIdentifier = touch.identifier;
             const coords = getSimulationCoords(touch.clientX, touch.clientY);
             mouseX = coords.x; mouseY = coords.y;
             if(interactionRing) interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);
             isAttracting = true; isRepelling = false; isVortexing = false; isStirring = false;
             event.preventDefault();
         }
    }, { passive: false });
    renderer.domElement.addEventListener('touchmove', (event) => {
        if (touchIdentifier !== null) {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 if (touch.identifier === touchIdentifier) {
                     const coords = getSimulationCoords(touch.clientX, touch.clientY);
                     mouseX = coords.x; mouseY = coords.y;
                     if(interactionRing) interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);
                     event.preventDefault(); break;
                 }
             }
         }
     }, { passive: false });
    const touchEndCancel = (event) => {
         if (touchIdentifier !== null) {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 if (event.changedTouches[i].identifier === touchIdentifier) {
                     isAttracting = false; isRepelling = false; isVortexing = false; isStirring = false;
                     touchIdentifier = null; break;
                 }
             }
         }
    };
    window.addEventListener('touchend', touchEndCancel);
    window.addEventListener('touchcancel', touchEndCancel);

    // --- Window Resize ---
    window.addEventListener('resize', () => {
        const newAspect = window.innerWidth / window.innerHeight;
        camera.left = FRUSTUM_SIZE * newAspect / -2; camera.right = FRUSTUM_SIZE * newAspect / 2;
        camera.top = FRUSTUM_SIZE / 2; camera.bottom = FRUSTUM_SIZE / -2;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight); // Resize composer too!
        // renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Re-apply pixel ratio limit if used
    });
    console.log("Event listeners added.");


    // --- FPS Counter ---
    const fpsCounter = document.getElementById('fpsCounter');
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsUpdateTimer = 0;

    // --- Animation Loop ---
    console.log("Starting animation loop...");
    function animate() {
        requestAnimationFrame(animate);

        const currentTime = performance.now();
        const deltaTime = Math.min(0.05, (currentTime - lastTime) / 1000); // Delta time in seconds, capped
        lastTime = currentTime;
        fpsUpdateTimer += deltaTime;

        // --- FPS Calculation ---
        frameCount++;
        if (fpsUpdateTimer >= 1.0) {
            const fps = frameCount; frameCount = 0; fpsUpdateTimer -= 1.0;
            if (fpsCounter) fpsCounter.textContent = `FPS: ${fps}`;
        }

        // --- Simulation Update ---
        if (!params.paused && particleSystem && geometry && geometry.attributes.position) {

             // 1. Update Spatial Grid
             updateGrid();

            const posArray = geometry.attributes.position.array;
            const velArray = velocities; // Direct reference
            const colArray = geometry.attributes.color.array;

            // Pre-calculate squared radii for efficiency
            const mouseInteractionRadiusSq = params.interactionRadius * params.interactionRadius;
            const particleRepulsionRadiusSq = params.particleRepulsionRadius * params.particleRepulsionRadius;
            const cohesionRadiusSq = params.cohesionRadius * params.cohesionRadius;

            // Base Color HSL (fetch once per frame)
            let baseHSL = { h: 0, s: 1, l: 0.5 };
            if (baseColor && typeof baseColor.getHSL === 'function') {
                baseColor.getHSL(baseHSL);
            } else { /* Error handling/recovery */
                baseColor = new THREE.Color(params.particleBaseColor); baseColor.getHSL(baseHSL);
            }

            // --- Particle Update Loop ---
            for (let i = 0; i < params.particlesCount; i++) {
                const i3 = i * 3;
                const px = posArray[i3];
                const py = posArray[i3 + 1];
                let vx = velArray[i3];
                let vy = velArray[i3 + 1];

                // --- Apply Forces ---
                // Gravity
                if (params.gravityEnabled) vy -= params.gravityStrength;

                // Mouse Interaction
                const dxMouse = mouseX - px; const dyMouse = mouseY - py;
                const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;
                if (distMouseSq < mouseInteractionRadiusSq * 1.1) { // Slightly wider check
                    const distMouse = Math.sqrt(distMouseSq);
                    if (distMouse > 0.01 && distMouse < params.interactionRadius) {
                        const invDist = 1.0 / distMouse; const normX = dxMouse * invDist; const normY = dyMouse * invDist;
                        if (isAttracting) { vx += normX * params.attractionStrength; vy += normY * params.attractionStrength; }
                        if (isRepelling) { vx -= normX * params.repellingStrength; vy -= normY * params.repellingStrength; }
                        if (isVortexing) { vx += -normY * params.vortexStrength; vy += normX * params.vortexStrength; }
                        if (isStirring) {
                            const stirFactor = params.stirStrength * Math.max(0, (1.0 - distMouse / params.interactionRadius));
                            vx += -normY * stirFactor; vy += normX * stirFactor;
                        }
                    }
                }

                 // Particle-Particle Interaction (Using Spatial Grid)
                 const neighbors = getNeighbors(i);
                 for (const j of neighbors) {
                     if (i === j) continue; // Don't interact with self

                     const j3 = j * 3;
                     const dx = posArray[j3] - px;
                     const dy = posArray[j3 + 1] - py;
                     const distSq = dx * dx + dy * dy;

                     // Repulsion (only check radius if strength > 0)
                     if (params.repulsionStrength > 0 && distSq < particleRepulsionRadiusSq && distSq > 0.0001) {
                         const distance = Math.sqrt(distSq);
                         const invDist = 1.0 / distance;
                         const forceMagnitude = (1.0 - distance / params.particleRepulsionRadius) * params.repulsionStrength * invDist;
                         const forceX = dx * forceMagnitude; const forceY = dy * forceMagnitude;
                         vx -= forceX; vy -= forceY;
                         // Note: No need to apply opposite force here, particle 'j' will calculate it when its turn comes.
                     }
                     // Cohesion (check radii if strength > 0)
                     else if (params.cohesionStrength > 0 && distSq < cohesionRadiusSq && distSq > particleRepulsionRadiusSq * 0.9) { // Apply outside repulsion range
                         const distance = Math.sqrt(distSq);
                         const forceMagnitude = params.cohesionStrength * (1 - cohesionRadiusSq / (distSq + 0.01));
                         const invDist = 1.0 / (distance + 0.001);
                         const forceX = dx * forceMagnitude * invDist; const forceY = dy * forceMagnitude * invDist;
                         vx += forceX; vy += forceY;
                     }
                 } // End neighbor loop


                // --- Velocity Limiting & Damping ---
                const velMagSq = vx * vx + vy * vy;
                if (velMagSq > params.maxVelocity * params.maxVelocity) {
                    const scale = params.maxVelocity / Math.sqrt(velMagSq); vx *= scale; vy *= scale;
                }
                vx *= params.damping; vy *= params.damping;

                // --- Update Position (Candidate) ---
                let nextX = px + vx; // Simplified: assumes deltaTime=1 for velocity integration
                let nextY = py + vy; // For more accuracy: nextX = px + vx * deltaTime; etc. (might need force adjustments)

                // --- Collision Detection ---
                // Boundary
                const distFromCenterSq = nextX * nextX + nextY * nextY;
                if (distFromCenterSq > params.containerRadius * params.containerRadius) {
                    const distFromCenter = Math.sqrt(distFromCenterSq); const normX = nextX / distFromCenter; const normY = nextY / distFromCenter;
                    const dot = vx * normX + vy * normY;
                    vx -= (1 + params.edgeDamping) * dot * normX; vy -= (1 + params.edgeDamping) * dot * normY;
                    nextX = normX * params.containerRadius; nextY = normY * params.containerRadius;
                }
                // Obstacles
                if (params.enableObstacles) {
                    for (const obs of params.obstacles) {
                        const dxObs = nextX - obs.x; const dyObs = nextY - obs.y; const distObsSq = dxObs * dxObs + dyObs * dyObs;
                        if (distObsSq < obs.radius * obs.radius && distObsSq > 0.0001) {
                            const distObs = Math.sqrt(distObsSq); const normX = dxObs / distObs; const normY = dyObs / distObs;
                            const dot = vx * normX + vy * normY;
                            if (dot < 0) { vx -= (1 + params.edgeDamping) * dot * normX; vy -= (1 + params.edgeDamping) * dot * normY; }
                            nextX = obs.x + normX * (obs.radius + 0.01); nextY = obs.y + normY * (obs.radius + 0.01);
                        }
                    }
                }

                // --- Finalize Position & Velocity Update ---
                posArray[i3] = nextX; posArray[i3 + 1] = nextY;
                velArray[i3] = vx; velArray[i3 + 1] = vy;

                // --- Update Color ---
                const speed = Math.sqrt(vx * vx + vy * vy);
                const hueShift = Math.min(speed * params.particleVelocityColorScale * 0.1, 0.7);
                const finalHue = (baseHSL.h + hueShift) % 1.0;
                const finalSaturation = Math.max(0.3, Math.min(1.0, baseHSL.s * 1.1)); // Slightly boost saturation
                const finalLightness = Math.max(0.4, Math.min(0.85, baseHSL.l)); // Clamp lightness
                tempColor.setHSL(finalHue, finalSaturation, finalLightness);
                colArray[i3] = tempColor.r; colArray[i3 + 1] = tempColor.g; colArray[i3 + 2] = tempColor.b;

            } // --- End Particle Loop ---

            // --- Mark Buffers for Update on GPU ---
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.color.needsUpdate = true;
        } // --- End if(!paused) ---

        // --- Render Scene (using EffectComposer) ---
        // renderer.render(scene, camera); // <<< Replace this line
        if(composer) composer.render(deltaTime); // <<< With this line

    } // --- End animate() ---

    // --- Start Animation ---
    animate();
    console.log("--- Advanced Fluid Simulation Initialized Successfully ---");

}); // --- End DOMContentLoaded listener ---

console.log("--- Advanced Fluid Simulation Script END ---");