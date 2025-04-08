// Import lil-gui
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.18/dist/lil-gui.esm.min.js';

// --- Constants ---
const FRUSTUM_SIZE = 120;
const MAX_PARTICLES = 20000; // Max particles buffer can hold

// --- Presets Definition ---
const PRESETS = {
    'Low': {
        particlesCount: 2000,
        damping: 0.97,
        maxVelocity: 2.0,
        particleRepulsionRadius: 2.5,
        repulsionStrength: 0.15,
        cohesionRadius: 5.0,
        cohesionStrength: 0.005,
        particleSize: 1.5,
        bloomEnabled: false,
        enableObstacles: false,
    },
    'Medium': {
        particlesCount: 5000,
        damping: 0.96,
        maxVelocity: 2.5,
        particleRepulsionRadius: 3.5,
        repulsionStrength: 0.25,
        cohesionRadius: 7.0,
        cohesionStrength: 0.01,
        particleSize: 1.8,
        bloomEnabled: true,
        bloomStrength: 0.4,
        bloomRadius: 0.3,
        bloomThreshold: 0.65,
        enableObstacles: true,
    },
    'High': {
        particlesCount: 10000,
        damping: 0.95,
        maxVelocity: 3.0,
        particleRepulsionRadius: 4.0,
        repulsionStrength: 0.30,
        cohesionRadius: 8.0,
        cohesionStrength: 0.015,
        particleSize: 2.0,
        bloomEnabled: true,
        bloomStrength: 0.5,
        bloomRadius: 0.4,
        bloomThreshold: 0.6,
        enableObstacles: true,
    },
    'Extreme': {
        particlesCount: MAX_PARTICLES, // Use max allocated
        damping: 0.94,
        maxVelocity: 3.5,
        particleRepulsionRadius: 4.5,
        repulsionStrength: 0.35,
        cohesionRadius: 9.0,
        cohesionStrength: 0.02,
        particleSize: 2.2,
        bloomEnabled: true,
        bloomStrength: 0.6,
        bloomRadius: 0.5,
        bloomThreshold: 0.55,
        enableObstacles: true,
    }
};


class FluidSimulation {
    constructor(container) {
        this.container = container;

        // --- State Variables ---
        this.mouseX = 0;
        this.mouseY = 0;
        this.isAttracting = false;
        this.isRepelling = false;
        this.isVortexing = false;
        this.isStirring = false;
        this.touchIdentifier = null;
        this.baseColor = new THREE.Color();
        this.tempColor = new THREE.Color(); // Used in loop

        // --- Three.js Objects ---
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.bloomPass = null;
        this.particleSystem = null;
        this.geometry = null;
        this.material = null;
        this.interactionRing = null;
        this.obstacleMeshes = [];

        // --- Buffers (allocated once) ---
        this.positions = null;
        this.velocities = null;
        this.colors = null;
        this.initialPositions = null; // Stores start positions for reset

        // --- Spatial Grid ---
        this.grid = {};
        this.gridCellSize = 0;
        this.gridWidth = 0;
        this.gridHeight = 0;
        this.gridOriginX = 0;
        this.gridOriginY = 0;

        // --- Timing & Control ---
        this.lastTime = performance.now();
        this.fpsCounter = document.getElementById('fpsCounter');
        this.frameCount = 0;
        this.fpsUpdateTimer = 0;
        this.gui = null;

        // --- Simulation Parameters (will be populated) ---
        this.params = {
            // Will be populated by applyPreset or defaults
            currentPreset: 'Medium', // Default preset to load
             paused: false,
        };
    }

    init() {
        console.log("--- Fluid Simulation Initializing ---");
        this.setupScene();
        this.setupRenderer();
        this.setupCamera();
        this.setupComposer(); // Setup composer after renderer
        this.createInteractionRing();
        this.createObstacleMeshes(); // Initial creation based on default preset potential state
        this.allocateBuffers();      // Allocate buffers ONCE
        this.setupSpatialGrid();     // Setup grid based on initial potential state
        this.initializeParticles(true); // Populate buffers based on initial preset
        this.setupGUI();             // Setup GUI AFTER params are initialized by preset
        this.applyPreset(this.params.currentPreset, true); // Apply initial preset (updates GUI too)
        this.setupEventListeners();
        this.animate();
        console.log("--- Fluid Simulation Initialized Successfully ---");
    }

    setupScene() {
        this.scene = new THREE.Scene();
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        // this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Optional: Limit pixel ratio
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
        // Initial clear color, will be updated by applyPreset/GUI
        this.renderer.setClearColor(0x050510, 1);
    }

    setupCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(
            FRUSTUM_SIZE * aspect / -2, FRUSTUM_SIZE * aspect / 2,
            FRUSTUM_SIZE / 2, FRUSTUM_SIZE / -2, 1, 1000
        );
        this.camera.position.z = 10;
    }

    setupComposer() {
        // Ensure THREE objects needed by Composer are available
        // If using modules and newer Three.js, direct imports are preferred.
        // With CDN/older structure, they might be attached to the THREE namespace.
        if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.UnrealBloomPass) {
             console.error("EffectComposer or required passes not found! Ensure Three.js addons are loaded correctly.");
             // Fallback to basic rendering
             this.composer = null;
             this.bloomPass = null;
             return;
        }

        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));

        // Bloom pass setup uses defaults, applyPreset will configure it
        this.bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, 0.4, 0.85 // Default values, overwritten by params
        );
        this.composer.addPass(this.bloomPass);
        console.log("EffectComposer setup.");
    }

    allocateBuffers() {
         console.log(`Allocating buffers for ${MAX_PARTICLES} particles.`);
         this.positions = new Float32Array(MAX_PARTICLES * 3);
         this.velocities = new Float32Array(MAX_PARTICLES * 3);
         this.colors = new Float32Array(MAX_PARTICLES * 3);
         this.initialPositions = new Float32Array(MAX_PARTICLES * 3);

         this.geometry = new THREE.BufferGeometry();
         this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
         this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));

         // Material created here, properties updated later
         this.material = new THREE.PointsMaterial({
             size: 1.0, // Default, will be set by params
             vertexColors: true,
             blending: THREE.AdditiveBlending,
             depthWrite: false,
             transparent: true,
             opacity: 0.85
         });

         this.particleSystem = new THREE.Points(this.geometry, this.material);
         this.scene.add(this.particleSystem);
    }

    initializeParticles(fullReset = true) {
        const count = this.params.particlesCount || PRESETS['Medium'].particlesCount; // Use current or default count
        console.log(`Initializing ${count} particles...`);

        this.baseColor.set(this.params.particleBaseColor || '#40E0D0');

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            // Slightly more distributed start
            const radius = Math.pow(Math.random(), 0.7) * (this.params.containerRadius || 55) * 0.9 + (this.params.containerRadius || 55) * 0.05;
            const angle = Math.random() * Math.PI * 2;

            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;

            this.positions[i3] = px;
            this.positions[i3 + 1] = py;
            this.positions[i3 + 2] = 0;

            // Store initial position only if full reset or if it's a new particle beyond the previous initial count
             if (fullReset || i >= (this.initialPositions.length / 3)) { // Check against buffer length is safer here
                 this.initialPositions[i3] = px;
                 this.initialPositions[i3 + 1] = py;
                 this.initialPositions[i3 + 2] = 0;
            }

            this.velocities[i3] = (Math.random() - 0.5) * 0.2;
            this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
            this.velocities[i3 + 2] = 0;

            this.colors[i3] = this.baseColor.r;
            this.colors[i3 + 1] = this.baseColor.g;
            this.colors[i3 + 2] = this.baseColor.b;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.setDrawRange(0, count); // IMPORTANT: Only draw the initialized particles
        console.log(`Particles initialized. Draw range set to ${count}.`);
    }

    updateParticleCount(newCount) {
        newCount = Math.max(10, Math.min(newCount, MAX_PARTICLES)); // Clamp count
        if (newCount === this.params.particlesCount) return;

        console.log(`Updating particle count to ${newCount}...`);
        const oldCount = this.params.particlesCount;
        this.params.particlesCount = newCount;

        // If increasing count, initialize the *new* particles
        if (newCount > oldCount) {
            this.baseColor.set(this.params.particleBaseColor);
            const currentContainerRadius = this.params.containerRadius || 55; // Use current radius
            for (let i = oldCount; i < newCount; i++) {
                 const i3 = i * 3;
                 const radius = Math.pow(Math.random(), 0.7) * currentContainerRadius * 0.9 + currentContainerRadius * 0.05;
                 const angle = Math.random() * Math.PI * 2;

                 this.positions[i3] = Math.cos(angle) * radius;
                 this.positions[i3 + 1] = Math.sin(angle) * radius;
                 this.positions[i3 + 2] = 0;

                 // Always set initial position for newly added particles
                 this.initialPositions[i3] = this.positions[i3];
                 this.initialPositions[i3 + 1] = this.positions[i3+1];
                 this.initialPositions[i3 + 2] = 0;

                 this.velocities[i3] = (Math.random() - 0.5) * 0.2;
                 this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
                 this.velocities[i3 + 2] = 0;

                 this.colors[i3] = this.baseColor.r;
                 this.colors[i3 + 1] = this.baseColor.g;
                 this.colors[i3 + 2] = this.baseColor.b;
            }
             // Need to update the buffer range that's potentially modified
            this.geometry.attributes.position.updateRange.offset = oldCount * 3;
            this.geometry.attributes.position.updateRange.count = (newCount - oldCount) * 3;
            this.geometry.attributes.color.updateRange.offset = oldCount * 3;
            this.geometry.attributes.color.updateRange.count = (newCount - oldCount) * 3;

        } else { // Decreasing count
             // No buffer changes needed, just update draw range
        }

        this.geometry.setDrawRange(0, newCount);
        this.geometry.attributes.position.needsUpdate = true; // Mark for update
        this.geometry.attributes.color.needsUpdate = true;

        // Update GUI display if the controller exists
        if (this.gui) {
            this.gui.controllersRecursive().forEach(c => {
                if (c.property === 'particlesCount') c.updateDisplay();
            });
        }
        console.log(`Particle count updated. Draw range set to ${newCount}.`);
    }

    resetSimulation() {
        console.log("--- Resetting Simulation ---");
        if (!this.geometry || !this.initialPositions || !this.velocities || !this.colors) {
            console.error("Cannot reset, buffers not initialized.");
            this.allocateBuffers(); // Try to re-allocate if missing
            this.initializeParticles(true); // Force full init
            return;
        }

        const currentCount = this.params.particlesCount;
        // Reset only the active particles to their initial state
        for (let i = 0; i < currentCount; i++) {
            const i3 = i * 3;
            if (i * 3 < this.initialPositions.length) { // Safety check
                 this.positions[i3] = this.initialPositions[i3];
                 this.positions[i3 + 1] = this.initialPositions[i3 + 1];
                 this.positions[i3 + 2] = this.initialPositions[i3 + 2];
            } else {
                // Fallback if initial position is missing (shouldn't happen with pre-allocation)
                 this.positions[i3] = 0; this.positions[i3 + 1] = 0; this.positions[i3 + 2] = 0;
            }

            this.velocities[i3] = 0;
            this.velocities[i3 + 1] = 0;
            this.velocities[i3 + 2] = 0;

            this.baseColor.set(this.params.particleBaseColor);
            this.colors[i3] = this.baseColor.r;
            this.colors[i3 + 1] = this.baseColor.g;
            this.colors[i3 + 2] = this.baseColor.b;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        // Ensure draw range matches current count after reset
        this.geometry.setDrawRange(0, currentCount);

        this.params.paused = false;
        // Force update all GUI controllers if GUI exists
        if (this.gui) {
            this.gui.controllersRecursive().forEach(controller => controller.updateDisplay());
        }
        console.log("Simulation Reset Complete.");
    }

    // --- GUI ---
    setupGUI() {
        this.gui = new GUI();
        this.gui.title("Fluid Controls");

        // --- Presets ---
        const presetOptions = Object.keys(PRESETS);
        this.gui.add(this.params, 'currentPreset', presetOptions)
            .name('Preset')
            .onChange(value => this.applyPreset(value));

        // --- Performance & Core ---
        const perfFolder = this.gui.addFolder('Performance & Core');
        // Note: Particle count is now controlled primarily by presets for benchmarking
        // We can keep the slider for fine-tuning if desired, but ensure it calls updateParticleCount
         perfFolder.add(this.params, 'particlesCount', 100, MAX_PARTICLES, 100)
             .name('Particle Count')
             .listen() // Listen for changes from presets
             .onFinishChange(value => this.updateParticleCount(value)); // Manual change
        perfFolder.add(this.params, 'paused').name('Pause (P)').listen();
        perfFolder.add(this, 'resetSimulation').name('Reset (R)'); // Use class method directly
        perfFolder.open();

        // --- Physics ---
        const physicsFolder = this.gui.addFolder('Physics');
        physicsFolder.add(this.params, 'damping', 0.85, 1.0, 0.005).name('Damping');
        physicsFolder.add(this.params, 'edgeDamping', 0.0, 1.5, 0.05).name('Edge Damping');
        physicsFolder.add(this.params, 'maxVelocity', 0.5, 10.0, 0.1).name('Max Velocity');
        physicsFolder.add(this.params, 'gravityEnabled').name('Enable Gravity (G)').listen();
        physicsFolder.add(this.params, 'gravityStrength', 0.0, 0.2, 0.005).name('Gravity Strength');
        physicsFolder.add(this.params, 'containerRadius', 20, 100, 1).name('Container Radius')
            .onFinishChange(() => this.setupSpatialGrid()); // Recalculate grid
        physicsFolder.close(); // Close by default

        // --- Mouse Interaction ---
        const mouseFolder = this.gui.addFolder('Mouse Interaction');
        mouseFolder.add(this.params, 'interactionRadius', 1, 40, 0.5).name('Mouse Radius').onChange(() => this.createInteractionRing());
        mouseFolder.add(this.params, 'attractionStrength', 0.0, 0.8, 0.01).name('Attraction Str.');
        mouseFolder.add(this.params, 'repellingStrength', 0.0, 1.2, 0.01).name('Repulsion Str.');
        mouseFolder.add(this.params, 'vortexStrength', 0.0, 0.6, 0.01).name('Vortex Str.');
        mouseFolder.add(this.params, 'stirStrength', 0.0, 0.6, 0.01).name('Stir Str.');
        mouseFolder.add(this.params, 'showInteractionRadius').name('Show Mouse Radius').onChange(v => { if(this.interactionRing) this.interactionRing.visible = v; });
        mouseFolder.close(); // Close by default

        // --- Particle Physics ---
        const particlePhysicsFolder = this.gui.addFolder('Particle Physics');
        particlePhysicsFolder.add(this.params, 'particleRepulsionRadius', 0.5, 20.0, 0.1).name('Repulsion Radius')
            .onFinishChange(() => this.setupSpatialGrid()); // Grid depends on this
        particlePhysicsFolder.add(this.params, 'repulsionStrength', 0.0, 1.0, 0.01).name('Repulsion Str.');
        particlePhysicsFolder.add(this.params, 'cohesionRadius', 1.0, 30.0, 0.1).name('Cohesion Radius')
             .onFinishChange(() => this.setupSpatialGrid()); // Grid depends on this
        particlePhysicsFolder.add(this.params, 'cohesionStrength', 0.0, 0.1, 0.001).name('Cohesion Str.');
        particlePhysicsFolder.close(); // Close by default

        // --- Visualization ---
        const vizFolder = this.gui.addFolder('Visualization');
        vizFolder.addColor(this.params, 'particleBaseColor').name('Base Color').onChange(value => this.baseColor.set(value));
        vizFolder.add(this.params, 'particleVelocityColorScale', 0, 15, 0.1).name('Velocity Color Scale');
        vizFolder.add(this.params, 'particleSize', 0.1, 10.0, 0.1).name('Particle Size').onChange(value => { if (this.material) this.material.size = value; });
        vizFolder.addColor(this.params, 'bgColor').name('Background Color').onChange(() => this.updateBackgroundColor());
        vizFolder.close(); // Close by default

        // --- Bloom Effect ---
        const bloomFolder = this.gui.addFolder('Bloom Effect');
        bloomFolder.add(this.params, 'bloomEnabled').name('Enable Bloom').onChange(v => { if (this.bloomPass) this.bloomPass.enabled = v; });
        bloomFolder.add(this.params, 'bloomStrength', 0.0, 2.0, 0.05).name('Strength').onChange(v => { if (this.bloomPass) this.bloomPass.strength = v; });
        bloomFolder.add(this.params, 'bloomRadius', 0.0, 2.0, 0.05).name('Radius').onChange(v => { if (this.bloomPass) this.bloomPass.radius = v; });
        bloomFolder.add(this.params, 'bloomThreshold', 0.0, 1.0, 0.01).name('Threshold').onChange(v => { if (this.bloomPass) this.bloomPass.threshold = v; });
        bloomFolder.close(); // Close by default

        // --- Obstacles ---
        const obstacleFolder = this.gui.addFolder('Obstacles');
        obstacleFolder.add(this.params, 'enableObstacles').name('Enable Obstacles').onChange(() => this.createObstacleMeshes());
        obstacleFolder.close(); // Close by default
    }

    applyPreset(name, isInitial = false) {
        console.log(`Applying preset: ${name}`);
        const preset = PRESETS[name];
        if (!preset) {
            console.warn(`Preset "${name}" not found.`);
            return;
        }

        const oldParticleCount = this.params.particlesCount;

        // Merge preset into params
        // Define default structure here to ensure all keys exist
        const defaultParams = {
            particlesCount: 5000, paused: this.params.paused, // Preserve pause state
            damping: 0.96, edgeDamping: 0.6, maxVelocity: 2.5,
            containerRadius: 55, gravityStrength: 0.04, gravityEnabled: false,
            interactionRadius: 10.0, attractionStrength: 0.15, repellingStrength: 0.30,
            vortexStrength: 0.15, stirStrength: 0.10, showInteractionRadius: true,
            particleRepulsionRadius: 3.5, repulsionStrength: 0.25, cohesionRadius: 7.0, cohesionStrength: 0.01,
            particleBaseColor: '#40E0D0', particleVelocityColorScale: 3.0, particleSize: 1.8,
            bgColor: '#050510',
            bloomEnabled: true, bloomStrength: 0.4, bloomRadius: 0.3, bloomThreshold: 0.65,
            obstacles: [ { x: -25, y: 20, radius: 10 }, { x: 30, y: -15, radius: 14 }, { x: 0, y: -35, radius: 6 }],
            enableObstacles: true,
            currentPreset: name // Update the preset name itself
        };

        // Overwrite defaults with preset values
        this.params = { ...defaultParams, ...preset };


        // --- Apply changes ---
        if (!isInitial && this.params.particlesCount !== oldParticleCount) {
            this.updateParticleCount(this.params.particlesCount);
        } else if (isInitial) {
             this.initializeParticles(true); // Full init on first load
        }

        // Update simulation components based on new params
        this.baseColor.set(this.params.particleBaseColor);
        if (this.material) this.material.size = this.params.particleSize;
        if (this.bloomPass) {
            this.bloomPass.enabled = this.params.bloomEnabled;
            this.bloomPass.strength = this.params.bloomStrength;
            this.bloomPass.radius = this.params.bloomRadius;
            this.bloomPass.threshold = this.params.bloomThreshold;
        }
        this.updateBackgroundColor();
        this.createInteractionRing(); // Update ring size/visibility
        this.createObstacleMeshes(); // Update obstacles
        this.setupSpatialGrid();     // Update grid based on new radii/container size


        // Update GUI to reflect the new state
        if (this.gui) {
            this.gui.controllersRecursive().forEach(controller => controller.updateDisplay());
        }

        // Optional: Reset simulation state when switching presets for a clean comparison
         if (!isInitial) {
             this.resetSimulation();
         }
    }

    // --- Helpers ---
    updateBackgroundColor() {
        if (this.renderer) this.renderer.setClearColor(this.params.bgColor, 1);
        document.body.style.backgroundColor = this.params.bgColor;
    }

    getSimulationCoords(clientX, clientY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        const vec = new THREE.Vector3(x, y, 0.5);
        vec.unproject(this.camera);
        return { x: vec.x, y: vec.y };
    }

    createInteractionRing() {
        if (this.interactionRing) this.scene.remove(this.interactionRing);
        // Dispose old geometry/material if they exist
        if (this.interactionRing?.geometry) this.interactionRing.geometry.dispose();
        if (this.interactionRing?.material) this.interactionRing.material.dispose();

        const ringGeometry = new THREE.RingGeometry(this.params.interactionRadius - 0.15, this.params.interactionRadius + 0.15, 48);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.3, depthWrite: false });
        this.interactionRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.interactionRing.visible = this.params.showInteractionRadius;
        this.interactionRing.position.z = 1;
        this.scene.add(this.interactionRing);
    }

    createObstacleMeshes() {
        // Clear existing meshes and dispose resources
        this.obstacleMeshes.forEach(mesh => {
            if(mesh.geometry) mesh.geometry.dispose();
            if(mesh.material) mesh.material.dispose();
            this.scene.remove(mesh);
        });
        this.obstacleMeshes.length = 0;

        if (this.params.enableObstacles && this.params.obstacles) {
            this.params.obstacles.forEach((obs) => {
                const geometry = new THREE.CircleGeometry(obs.radius, 32);
                const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(geometry, meshMaterial);
                mesh.position.set(obs.x, obs.y, -1); // Behind particles
                this.scene.add(mesh);
                this.obstacleMeshes.push(mesh);
            });
        }
    }

    // --- Spatial Grid ---
    setupSpatialGrid() {
        // Ensure radii params exist before setup
        const repulsionRadius = this.params.particleRepulsionRadius || 3.5;
        const cohesionRadius = this.params.cohesionRadius || 7.0;
        const containerRadius = this.params.containerRadius || 55;

        this.gridCellSize = Math.max(repulsionRadius, cohesionRadius, 1.0);
        const worldSize = containerRadius * 2.5; // Grid slightly larger than container
        this.gridWidth = Math.ceil(worldSize / this.gridCellSize);
        this.gridHeight = Math.ceil(worldSize / this.gridCellSize);
        this.gridOriginX = -worldSize / 2;
        this.gridOriginY = -worldSize / 2;
        this.grid = {}; // Clear grid data
        // console.log(`Grid setup: ${this.gridWidth}x${this.gridHeight} cells, size ${this.gridCellSize.toFixed(2)}`);
    }

    getCellCoords(x, y) {
        const cellX = Math.floor((x - this.gridOriginX) / this.gridCellSize);
        const cellY = Math.floor((y - this.gridOriginY) / this.gridCellSize);
        return { cellX, cellY };
    }

    getCellKey(cellX, cellY) { return `${cellX}_${cellY}`; }

    updateGrid() {
        this.grid = {}; // Clear grid
        const posArray = this.geometry.attributes.position.array;
        const count = this.params.particlesCount; // Use current count

        for (let i = 0; i < count; i++) {
            const { cellX, cellY } = this.getCellCoords(posArray[i * 3], posArray[i * 3 + 1]);
            const key = this.getCellKey(cellX, cellY);
            if (!this.grid[key]) this.grid[key] = [];
            this.grid[key].push(i);
        }
    }

    getNeighbors(particleIndex) {
        const neighbors = [];
        const posArray = this.geometry.attributes.position.array;
        const { cellX, cellY } = this.getCellCoords(posArray[particleIndex * 3], posArray[particleIndex * 3 + 1]);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = this.getCellKey(cellX + dx, cellY + dy);
                if (this.grid[key]) {
                    neighbors.push(...this.grid[key]);
                }
            }
        }
        return neighbors;
    }


    // --- Event Listeners Setup ---
    setupEventListeners() {
        console.log("Adding event listeners...");
        // Use .bind(this) to maintain context within event handlers
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.onTouchEndCancel.bind(this));
        window.addEventListener('touchcancel', this.onTouchEndCancel.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    // --- Event Handlers ---
    onMouseMove(event) {
        const coords = this.getSimulationCoords(event.clientX, event.clientY);
        this.mouseX = coords.x;
        this.mouseY = coords.y;
        if (this.interactionRing) this.interactionRing.position.set(this.mouseX, this.mouseY, this.interactionRing.position.z);
    }

    onMouseDown(event) {
        if (event.target !== this.renderer.domElement) return;
        if (event.button === 0) { // Left
            if (event.shiftKey) { this.isVortexing = true; this.isAttracting = false; this.isRepelling = false; this.isStirring = false; }
            else if (event.ctrlKey || event.metaKey) { this.isStirring = true; this.isAttracting = false; this.isRepelling = false; this.isVortexing = false; }
            else { this.isAttracting = true; this.isRepelling = false; this.isVortexing = false; this.isStirring = false; }
        } else if (event.button === 1) { // Middle
            this.isVortexing = true; this.isAttracting = false; this.isRepelling = false; this.isStirring = false; event.preventDefault();
        } else if (event.button === 2) { // Right
            this.isRepelling = true; this.isAttracting = false; this.isVortexing = false; this.isStirring = false;
        }
    }

    onMouseUp() { this.isAttracting = false; this.isRepelling = false; this.isVortexing = false; this.isStirring = false; }

    onKeyDown(event) {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        switch (event.key.toUpperCase()) {
            case 'G': this.params.gravityEnabled = !this.params.gravityEnabled; break;
            case 'P': this.params.paused = !this.params.paused; break;
            case 'R': this.resetSimulation(); break;
        }
        // Update GUI for toggles like pause/gravity
        if (this.gui) {
            this.gui.controllersRecursive().forEach(c => {
                if (c.property === 'paused' || c.property === 'gravityEnabled') c.updateDisplay();
            });
        }
    }

    onTouchStart(event) {
        if (event.touches.length > 0) {
             const touch = event.touches[0]; this.touchIdentifier = touch.identifier;
             const coords = this.getSimulationCoords(touch.clientX, touch.clientY);
             this.mouseX = coords.x; this.mouseY = coords.y;
             if(this.interactionRing) this.interactionRing.position.set(this.mouseX, this.mouseY, this.interactionRing.position.z);
             // Simple touch: attract only
             this.isAttracting = true; this.isRepelling = false; this.isVortexing = false; this.isStirring = false;
             event.preventDefault();
         }
    }

    onTouchMove(event) {
       if (this.touchIdentifier !== null) {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 if (touch.identifier === this.touchIdentifier) {
                     const coords = this.getSimulationCoords(touch.clientX, touch.clientY);
                     this.mouseX = coords.x; this.mouseY = coords.y;
                     if(this.interactionRing) this.interactionRing.position.set(this.mouseX, this.mouseY, this.interactionRing.position.z);
                     event.preventDefault(); break;
                 }
             }
         }
    }

    onTouchEndCancel(event) {
        if (this.touchIdentifier !== null) {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 if (event.changedTouches[i].identifier === this.touchIdentifier) {
                     this.isAttracting = false; this.isRepelling = false; this.isVortexing = false; this.isStirring = false;
                     this.touchIdentifier = null; break;
                 }
             }
         }
    }

    onWindowResize() {
        const newAspect = window.innerWidth / window.innerHeight;
        this.camera.left = FRUSTUM_SIZE * newAspect / -2;
        this.camera.right = FRUSTUM_SIZE * newAspect / 2;
        this.camera.top = FRUSTUM_SIZE / 2;
        this.camera.bottom = FRUSTUM_SIZE / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
        // Optional: Re-apply pixel ratio limit if used
        // this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }


    // --- Main Update and Animation Loop ---
    update(deltaTime) {
        if (this.params.paused || !this.particleSystem || !this.geometry || !this.geometry.attributes.position) return;

        // 1. Update Spatial Grid
        this.updateGrid();

        const posArray = this.geometry.attributes.position.array;
        const velArray = this.velocities; // Direct reference
        const colArray = this.geometry.attributes.color.array;
        const count = this.params.particlesCount; // Use current active count

        // Pre-calculate squared radii & other constants for efficiency
        const mouseInteractionRadiusSq = this.params.interactionRadius * this.params.interactionRadius;
        const particleRepulsionRadius = this.params.particleRepulsionRadius;
        const particleRepulsionRadiusSq = particleRepulsionRadius * particleRepulsionRadius;
        const cohesionRadius = this.params.cohesionRadius;
        const cohesionRadiusSq = cohesionRadius * cohesionRadius;
        const maxVelSq = this.params.maxVelocity * this.params.maxVelocity;
        const damping = this.params.damping;
        const edgeDamping = this.params.edgeDamping;
        const containerRadius = this.params.containerRadius;
        const containerRadiusSq = containerRadius * containerRadius;
        const gravity = this.params.gravityEnabled ? this.params.gravityStrength : 0;
        const obstacles = this.params.enableObstacles ? this.params.obstacles : [];

        // Base Color HSL (fetch once per frame)
        let baseHSL = { h: 0, s: 1, l: 0.5 };
        if (this.baseColor && typeof this.baseColor.getHSL === 'function') {
            this.baseColor.getHSL(baseHSL);
        } else { // Fallback
            this.baseColor = new THREE.Color(this.params.particleBaseColor); this.baseColor.getHSL(baseHSL);
        }
        const velColorScale = this.params.particleVelocityColorScale * 0.1; // Precalc

        // --- Particle Update Loop ---
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const px = posArray[i3];
            const py = posArray[i3 + 1];
            let vx = velArray[i3];
            let vy = velArray[i3 + 1];

            // --- Apply Forces ---
            vy -= gravity; // Apply gravity

            // Mouse Interaction
            const dxMouse = this.mouseX - px; const dyMouse = this.mouseY - py;
            const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;
            if (distMouseSq < mouseInteractionRadiusSq * 1.1) { // Wider check is fine
                const distMouse = Math.sqrt(distMouseSq);
                if (distMouse > 0.01 && distMouse < this.params.interactionRadius) {
                    const invDist = 1.0 / distMouse; const normX = dxMouse * invDist; const normY = dyMouse * invDist;
                    if (this.isAttracting) { vx += normX * this.params.attractionStrength; vy += normY * this.params.attractionStrength; }
                    if (this.isRepelling) { vx -= normX * this.params.repellingStrength; vy -= normY * this.params.repellingStrength; }
                    if (this.isVortexing) { vx += -normY * this.params.vortexStrength; vy += normX * this.params.vortexStrength; }
                    if (this.isStirring) {
                        const stirFactor = this.params.stirStrength * Math.max(0, (1.0 - distMouse / this.params.interactionRadius));
                        vx += -normY * stirFactor; vy += normX * stirFactor;
                    }
                }
            }

             // Particle-Particle Interaction (Using Spatial Grid)
             const neighbors = this.getNeighbors(i);
             for (const j of neighbors) {
                 if (i === j) continue;

                 const j3 = j * 3;
                 const dx = posArray[j3] - px;
                 const dy = posArray[j3 + 1] - py;
                 const distSq = dx * dx + dy * dy;

                 // Repulsion
                 if (this.params.repulsionStrength > 0 && distSq < particleRepulsionRadiusSq && distSq > 0.0001) {
                     const distance = Math.sqrt(distSq);
                     const invDist = 1.0 / distance;
                     const forceMagnitude = (1.0 - distance / particleRepulsionRadius) * this.params.repulsionStrength * invDist;
                     vx -= dx * forceMagnitude;
                     vy -= dy * forceMagnitude;
                 }
                 // Cohesion (Apply only if outside repulsion range but inside cohesion range)
                 else if (this.params.cohesionStrength > 0 && distSq < cohesionRadiusSq && distSq > particleRepulsionRadiusSq * 0.9) { // Avoid overlap
                     const distance = Math.sqrt(distSq);
                      // Smoother cohesion force falloff
                     const forceMagnitude = this.params.cohesionStrength * (1.0 - distance / cohesionRadius);
                     const invDist = 1.0 / (distance + 0.001); // Avoid division by zero
                     vx += dx * forceMagnitude * invDist;
                     vy += dy * forceMagnitude * invDist;
                 }
             } // End neighbor loop

            // --- Velocity Limiting & Damping ---
            const velMagSq = vx * vx + vy * vy;
            if (velMagSq > maxVelSq) {
                const scale = this.params.maxVelocity / Math.sqrt(velMagSq); vx *= scale; vy *= scale;
            }
            vx *= damping; vy *= damping;

            // --- Update Position (Simple Euler integration) ---
            // Note: Using deltaTime (vx * deltaTime) gives frame-rate independence but
            // requires adjusting forces/damping values significantly. For a benchmark
            // where higher FPS looking faster might be okay, this simple integration is kept.
            let nextX = px + vx;
            let nextY = py + vy;

            // --- Collision Detection ---
            // Boundary
            const distFromCenterSq = nextX * nextX + nextY * nextY;
            if (distFromCenterSq > containerRadiusSq) {
                const distFromCenter = Math.sqrt(distFromCenterSq); const normX = nextX / distFromCenter; const normY = nextY / distFromCenter;
                const dot = vx * normX + vy * normY; // Velocity component towards boundary normal
                // Reflect and dampen perpendicular velocity component
                vx -= (1 + edgeDamping) * dot * normX; vy -= (1 + edgeDamping) * dot * normY;
                // Clamp position exactly to boundary
                nextX = normX * containerRadius; nextY = normY * containerRadius;
            }
            // Obstacles
            for (const obs of obstacles) {
                const dxObs = nextX - obs.x; const dyObs = nextY - obs.y; const distObsSq = dxObs * dxObs + dyObs * dyObs;
                const obsRadiusSq = obs.radius * obs.radius;
                if (distObsSq < obsRadiusSq && distObsSq > 0.0001) {
                    const distObs = Math.sqrt(distObsSq); const normX = dxObs / distObs; const normY = dyObs / distObs;
                    const dot = vx * normX + vy * normY;
                    // Only reflect if moving towards the obstacle center
                    if (dot < 0) { vx -= (1 + edgeDamping) * dot * normX; vy -= (1 + edgeDamping) * dot * normY; }
                    // Push particle slightly outside the obstacle
                    nextX = obs.x + normX * (obs.radius + 0.01); nextY = obs.y + normY * (obs.radius + 0.01);
                }
            }

            // --- Finalize Position & Velocity Update ---
            posArray[i3] = nextX; posArray[i3 + 1] = nextY;
            velArray[i3] = vx; velArray[i3 + 1] = vy;

            // --- Update Color ---
            const speed = Math.sqrt(vx * vx + vy * vy);
            const hueShift = Math.min(speed * velColorScale, 0.7); // Clamp hue shift
            const finalHue = (baseHSL.h + hueShift) % 1.0;
            // Keep saturation/lightness closer to base, maybe slight boost
            const finalSaturation = Math.min(1.0, baseHSL.s * 1.05);
            const finalLightness = Math.min(0.9, baseHSL.l * 1.1);
            this.tempColor.setHSL(finalHue, finalSaturation, finalLightness);
            colArray[i3] = this.tempColor.r; colArray[i3 + 1] = this.tempColor.g; colArray[i3 + 2] = this.tempColor.b;

        } // --- End Particle Loop ---

        // --- Mark Buffers for Update on GPU ---
        // Important: Only need to mark the *range* of particles that were updated
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this)); // Use bound function for RAF

        const currentTime = performance.now();
        // Calculate deltaTime, cap it to prevent large jumps if tab loses focus
        const deltaTime = Math.min(0.05, (currentTime - this.lastTime) / 1000);
        this.lastTime = currentTime;
        this.fpsUpdateTimer += deltaTime;

        // --- FPS Calculation ---
        this.frameCount++;
        if (this.fpsUpdateTimer >= 1.0) {
            const fps = this.frameCount; this.frameCount = 0; this.fpsUpdateTimer -= 1.0;
            if (this.fpsCounter) this.fpsCounter.textContent = `FPS: ${fps}`;
        }

        // --- Simulation Update Step ---
        this.update(deltaTime);

        // --- Render Scene ---
        if (this.composer && this.bloomPass?.enabled) {
            this.composer.render(deltaTime); // Use composer if bloom is enabled
        } else {
            this.renderer.render(this.scene, this.camera); // Basic render otherwise
        }
    }

    // --- Cleanup (Optional but good practice) ---
    dispose() {
         console.log("Disposing Fluid Simulation resources...");
         // Cancel animation loop? (might not be needed if page is changing)
         window.removeEventListener('mousemove', this.onMouseMove.bind(this));
         // Remove other listeners...
         if(this.gui) this.gui.destroy();
         this.obstacleMeshes.forEach(mesh => { /* dispose geo/mat */ this.scene.remove(mesh); });
         if(this.interactionRing) { /* dispose geo/mat */ this.scene.remove(this.interactionRing); }
         if(this.particleSystem) this.scene.remove(this.particleSystem);
         if(this.material) this.material.dispose();
         if(this.geometry) this.geometry.dispose();
         // Dispose composer passes?
         if(this.renderer) {
              this.renderer.dispose();
              this.container.removeChild(this.renderer.domElement); // Remove canvas
         }
    }
}


// --- Script Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    const simulation = new FluidSimulation(document.body);
    simulation.init();

    // Optional: Make simulation accessible globally for debugging
    // window.fluidSim = simulation;
});