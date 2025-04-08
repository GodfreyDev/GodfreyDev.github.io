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
        // Provide defaults for all parameters even if not changing from medium
        edgeDamping: 0.6, containerRadius: 55, gravityStrength: 0.04, gravityEnabled: false,
        interactionRadius: 10.0, attractionStrength: 0.15, repellingStrength: 0.30, vortexStrength: 0.15, stirStrength: 0.10, showInteractionRadius: true,
        particleBaseColor: '#40E0D0', particleVelocityColorScale: 3.0, bgColor: '#050510',
        bloomStrength: 0.4, bloomRadius: 0.3, bloomThreshold: 0.65, // Keep bloom settings even if disabled
        obstacles: [ { x: -25, y: 20, radius: 10 }, { x: 30, y: -15, radius: 14 }, { x: 0, y: -35, radius: 6 }],
    },
    'Medium': { // Define this explicitly as the base/default
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
        // Other defaults
        edgeDamping: 0.6, containerRadius: 55, gravityStrength: 0.04, gravityEnabled: false,
        interactionRadius: 10.0, attractionStrength: 0.15, repellingStrength: 0.30, vortexStrength: 0.15, stirStrength: 0.10, showInteractionRadius: true,
        particleBaseColor: '#40E0D0', particleVelocityColorScale: 3.0, bgColor: '#050510',
        obstacles: [ { x: -25, y: 20, radius: 10 }, { x: 30, y: -15, radius: 14 }, { x: 0, y: -35, radius: 6 }],
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
        // Provide defaults for all parameters even if not changing from medium
        edgeDamping: 0.6, containerRadius: 55, gravityStrength: 0.04, gravityEnabled: false,
        interactionRadius: 10.0, attractionStrength: 0.15, repellingStrength: 0.30, vortexStrength: 0.15, stirStrength: 0.10, showInteractionRadius: true,
        particleBaseColor: '#40E0D0', particleVelocityColorScale: 3.0, bgColor: '#050510',
        obstacles: [ { x: -25, y: 20, radius: 10 }, { x: 30, y: -15, radius: 14 }, { x: 0, y: -35, radius: 6 }],
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
        // Provide defaults for all parameters even if not changing from medium
        edgeDamping: 0.6, containerRadius: 55, gravityStrength: 0.04, gravityEnabled: false,
        interactionRadius: 10.0, attractionStrength: 0.15, repellingStrength: 0.30, vortexStrength: 0.15, stirStrength: 0.10, showInteractionRadius: true,
        particleBaseColor: '#40E0D0', particleVelocityColorScale: 3.0, bgColor: '#050510',
        obstacles: [ { x: -25, y: 20, radius: 10 }, { x: 30, y: -15, radius: 14 }, { x: 0, y: -35, radius: 6 }],
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

        // --- Simulation Parameters (will be populated by applyPreset) ---
        this.params = {
            // Set the *initial* preset name here
            currentPreset: 'Medium',
            // Pause state can be initialized here
             paused: false,
            // Other parameters will be filled by applyPreset using PRESETS['Medium'] as base
        };
    }

    // *** CORRECTED INITIALIZATION ORDER ***
    init() {
        console.log("--- Fluid Simulation Initializing ---");

        // 1. Basic Three.js Setup (Scene, Renderer, Camera)
        this.setupScene();
        this.setupRenderer();
        this.setupCamera();
        this.setupComposer(); // Setup composer after renderer

        // 2. Allocate Buffers (doesn't depend on params yet)
        this.allocateBuffers();

        // 3. Apply the Initial Preset
        // This populates this.params fully *before* subsequent steps that need them.
        // It also calls initializeParticles(true) internally.
        this.applyPreset(this.params.currentPreset, true); // true for initial load

        // 4. Setup the GUI (Now safe, as this.params is populated)
        this.setupGUI();

        // 5. Setup Event Listeners
        this.setupEventListeners();

        // 6. Start Animation
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
        if (!window.THREE?.EffectComposer || !window.THREE?.RenderPass || !window.THREE?.UnrealBloomPass) {
             console.error("EffectComposer or required passes not found! Ensure Three.js addons (EffectComposer.js, RenderPass.js, UnrealBloomPass.js, etc.) are loaded correctly *after* three.min.js.");
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
         // Use DynamicDrawUsage for attributes that change frequently
         this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
         this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));

         // Material created here, properties updated later by applyPreset/GUI
         this.material = new THREE.PointsMaterial({
             size: 1.0, // Default, will be set by params
             vertexColors: true,
             blending: THREE.AdditiveBlending,
             depthWrite: false,
             transparent: true,
             opacity: 0.85 // Default, can be adjusted if needed
         });

         this.particleSystem = new THREE.Points(this.geometry, this.material);
         // Initially set draw range to 0, initializeParticles will set it correctly
         this.geometry.setDrawRange(0, 0);
         this.scene.add(this.particleSystem);
    }

    initializeParticles(fullReset = true) {
        // This function now *populates* the pre-allocated buffers based on current params.
        // It's typically called by applyPreset(..., true) or resetSimulation().
        const count = this.params.particlesCount;
        console.log(`Initializing state for ${count} particles...`);

        // Ensure baseColor is set from params
        this.baseColor.set(this.params.particleBaseColor);
        const currentContainerRadius = this.params.containerRadius;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            let px, py;
            // Use initial position if available and not a full reset
            if (!fullReset && i * 3 < this.initialPositions.length && this.initialPositions[i3+1] !== 0) { // Check a non-zero component
                 px = this.initialPositions[i3];
                 py = this.initialPositions[i3 + 1];
            } else {
                // Generate new position and store as initial if needed
                const radius = Math.pow(Math.random(), 0.7) * currentContainerRadius * 0.9 + currentContainerRadius * 0.05;
                const angle = Math.random() * Math.PI * 2;
                px = Math.cos(angle) * radius;
                py = Math.sin(angle) * radius;

                // Store this as the initial position
                 this.initialPositions[i3] = px;
                 this.initialPositions[i3 + 1] = py;
                 this.initialPositions[i3 + 2] = 0;
            }

            this.positions[i3] = px;
            this.positions[i3 + 1] = py;
            this.positions[i3 + 2] = 0;

            // Reset velocity and color
            this.velocities[i3] = (Math.random() - 0.5) * 0.1; // Start slower
            this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
            this.velocities[i3 + 2] = 0;

            this.colors[i3] = this.baseColor.r;
            this.colors[i3 + 1] = this.baseColor.g;
            this.colors[i3 + 2] = this.baseColor.b;
        }

        // Zero out remaining buffer parts (optional but clean)
        for (let i = count; i < MAX_PARTICLES; i++) {
            const i3 = i * 3;
            this.positions[i3] = 0; this.positions[i3+1] = 0; this.positions[i3+2] = 0;
            this.velocities[i3] = 0; this.velocities[i3+1] = 0; this.velocities[i3+2] = 0;
            this.colors[i3] = 0; this.colors[i3+1] = 0; this.colors[i3+2] = 0;
             this.initialPositions[i3] = 0; this.initialPositions[i3+1] = 0; this.initialPositions[i3+2] = 0;
        }


        // Mark buffers changed (important!)
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        // Set the correct draw range
        this.geometry.setDrawRange(0, count);
        console.log(`Particles initialized. Draw range set to ${count}.`);
    }

    updateParticleCount(newCount) {
        newCount = Math.max(10, Math.min(newCount, MAX_PARTICLES)); // Clamp count
        if (newCount === this.params.particlesCount) return;

        console.log(`Updating particle count from ${this.params.particlesCount} to ${newCount}...`);
        const oldCount = this.params.particlesCount;
        this.params.particlesCount = newCount;

        // If increasing count, initialize the *new* particles
        if (newCount > oldCount) {
            this.baseColor.set(this.params.particleBaseColor);
            const currentContainerRadius = this.params.containerRadius;
            for (let i = oldCount; i < newCount; i++) {
                 const i3 = i * 3;
                 // Generate new position
                 const radius = Math.pow(Math.random(), 0.7) * currentContainerRadius * 0.9 + currentContainerRadius * 0.05;
                 const angle = Math.random() * Math.PI * 2;
                 const px = Math.cos(angle) * radius;
                 const py = Math.sin(angle) * radius;

                 this.positions[i3] = px;
                 this.positions[i3 + 1] = py;
                 this.positions[i3 + 2] = 0;

                 // Store initial position for these new particles
                 this.initialPositions[i3] = px;
                 this.initialPositions[i3 + 1] = py;
                 this.initialPositions[i3 + 2] = 0;

                 // Initialize velocity and color
                 this.velocities[i3] = (Math.random() - 0.5) * 0.1;
                 this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
                 this.velocities[i3 + 2] = 0;
                 this.colors[i3] = this.baseColor.r;
                 this.colors[i3 + 1] = this.baseColor.g;
                 this.colors[i3 + 2] = this.baseColor.b;
            }
            // Mark the changed part of the buffer for update
            // NOTE: While updateRange is precise, setting needsUpdate=true often works fine
            // and might be simpler unless performance is extremely critical here.
            // this.geometry.attributes.position.updateRange.offset = oldCount * 3;
            // this.geometry.attributes.position.updateRange.count = (newCount - oldCount) * 3;
            // this.geometry.attributes.color.updateRange.offset = oldCount * 3;
            // this.geometry.attributes.color.updateRange.count = (newCount - oldCount) * 3;
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;

        } else { // Decreasing count
             // No buffer changes needed, just update draw range below
        }

        // Update the draw range regardless of increase/decrease
        this.geometry.setDrawRange(0, newCount);


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
            console.error("Cannot reset, buffers not initialized properly.");
            // Attempt recovery? Maybe re-run relevant init steps?
            // For now, just log the error.
            return;
        }

        const currentCount = this.params.particlesCount;
        console.log(`Resetting state for ${currentCount} particles.`);
        this.baseColor.set(this.params.particleBaseColor);

        // Reset only the active particles to their initial state
        for (let i = 0; i < currentCount; i++) {
            const i3 = i * 3;
            // Ensure initial position exists before trying to use it
            if (i * 3 < this.initialPositions.length) {
                 this.positions[i3] = this.initialPositions[i3];
                 this.positions[i3 + 1] = this.initialPositions[i3 + 1];
                 this.positions[i3 + 2] = this.initialPositions[i3 + 2];
            } else {
                // Fallback if initial position somehow missing (shouldn't happen now)
                 console.warn(`Missing initial position for particle ${i} during reset.`);
                 this.positions[i3] = 0; this.positions[i3 + 1] = 0; this.positions[i3 + 2] = 0;
            }

            // Reset velocity and color
            this.velocities[i3] = 0;
            this.velocities[i3 + 1] = 0;
            this.velocities[i3 + 2] = 0;

            this.colors[i3] = this.baseColor.r;
            this.colors[i3 + 1] = this.baseColor.g;
            this.colors[i3 + 2] = this.baseColor.b;
        }

        // Mark buffers changed
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
        // Ensure this.params.currentPreset exists before adding controller
        this.gui.add(this.params, 'currentPreset', presetOptions)
            .name('Preset')
            .onChange(value => this.applyPreset(value));

        // --- Performance & Core ---
        const perfFolder = this.gui.addFolder('Performance & Core');
        // Ensure this.params.particlesCount exists before adding controller
        perfFolder.add(this.params, 'particlesCount', 100, MAX_PARTICLES, 100)
             .name('Particle Count')
             .listen() // Listen for changes from presets
             .onFinishChange(value => this.updateParticleCount(Math.round(value))); // Manual change, ensure integer
        perfFolder.add(this.params, 'paused').name('Pause (P)').listen();
        perfFolder.add(this, 'resetSimulation').name('Reset (R)'); // Use class method directly
        perfFolder.open();

        // --- Physics ---
        const physicsFolder = this.gui.addFolder('Physics');
        // Add checks to ensure params exist before creating controllers
        if ('damping' in this.params) physicsFolder.add(this.params, 'damping', 0.85, 1.0, 0.005).name('Damping');
        if ('edgeDamping' in this.params) physicsFolder.add(this.params, 'edgeDamping', 0.0, 1.5, 0.05).name('Edge Damping');
        if ('maxVelocity' in this.params) physicsFolder.add(this.params, 'maxVelocity', 0.5, 10.0, 0.1).name('Max Velocity');
        if ('gravityEnabled' in this.params) physicsFolder.add(this.params, 'gravityEnabled').name('Enable Gravity (G)').listen();
        if ('gravityStrength' in this.params) physicsFolder.add(this.params, 'gravityStrength', 0.0, 0.2, 0.005).name('Gravity Strength');
        if ('containerRadius' in this.params) physicsFolder.add(this.params, 'containerRadius', 20, Math.max(100, FRUSTUM_SIZE/2), 1).name('Container Radius')
            .onFinishChange(() => this.setupSpatialGrid()); // Recalculate grid
        physicsFolder.close(); // Close by default

        // --- Mouse Interaction ---
        const mouseFolder = this.gui.addFolder('Mouse Interaction');
        if ('interactionRadius' in this.params) mouseFolder.add(this.params, 'interactionRadius', 1, 40, 0.5).name('Mouse Radius').onChange(() => this.createInteractionRing());
        if ('attractionStrength' in this.params) mouseFolder.add(this.params, 'attractionStrength', 0.0, 0.8, 0.01).name('Attraction Str.');
        if ('repellingStrength' in this.params) mouseFolder.add(this.params, 'repellingStrength', 0.0, 1.2, 0.01).name('Repulsion Str.');
        if ('vortexStrength' in this.params) mouseFolder.add(this.params, 'vortexStrength', 0.0, 0.6, 0.01).name('Vortex Str.');
        if ('stirStrength' in this.params) mouseFolder.add(this.params, 'stirStrength', 0.0, 0.6, 0.01).name('Stir Str.');
        if ('showInteractionRadius' in this.params) mouseFolder.add(this.params, 'showInteractionRadius').name('Show Mouse Radius').onChange(v => { if(this.interactionRing) this.interactionRing.visible = v; });
        mouseFolder.close();

        // --- Particle Physics ---
        const particlePhysicsFolder = this.gui.addFolder('Particle Physics');
        if ('particleRepulsionRadius' in this.params) particlePhysicsFolder.add(this.params, 'particleRepulsionRadius', 0.5, 20.0, 0.1).name('Repulsion Radius')
            .onFinishChange(() => this.setupSpatialGrid()); // Grid depends on this
        if ('repulsionStrength' in this.params) particlePhysicsFolder.add(this.params, 'repulsionStrength', 0.0, 1.0, 0.01).name('Repulsion Str.');
        if ('cohesionRadius' in this.params) particlePhysicsFolder.add(this.params, 'cohesionRadius', 1.0, 30.0, 0.1).name('Cohesion Radius')
             .onFinishChange(() => this.setupSpatialGrid()); // Grid depends on this
        if ('cohesionStrength' in this.params) particlePhysicsFolder.add(this.params, 'cohesionStrength', 0.0, 0.1, 0.001).name('Cohesion Str.');
        particlePhysicsFolder.close();

        // --- Visualization ---
        const vizFolder = this.gui.addFolder('Visualization');
        if ('particleBaseColor' in this.params) vizFolder.addColor(this.params, 'particleBaseColor').name('Base Color').onChange(value => this.baseColor.set(value));
        if ('particleVelocityColorScale' in this.params) vizFolder.add(this.params, 'particleVelocityColorScale', 0, 15, 0.1).name('Velocity Color Scale');
        if ('particleSize' in this.params) vizFolder.add(this.params, 'particleSize', 0.1, 10.0, 0.1).name('Particle Size').onChange(value => { if (this.material) this.material.size = value; });
        if ('bgColor' in this.params) vizFolder.addColor(this.params, 'bgColor').name('Background Color').onChange(() => this.updateBackgroundColor());
        vizFolder.close();

        // --- Bloom Effect ---
        const bloomFolder = this.gui.addFolder('Bloom Effect');
        // Check if bloomPass exists because composer setup might fail
        if (this.bloomPass) {
            if ('bloomEnabled' in this.params) bloomFolder.add(this.params, 'bloomEnabled').name('Enable Bloom').onChange(v => { if (this.bloomPass) this.bloomPass.enabled = v; });
            if ('bloomStrength' in this.params) bloomFolder.add(this.params, 'bloomStrength', 0.0, 3.0, 0.05).name('Strength').onChange(v => { if (this.bloomPass) this.bloomPass.strength = v; });
            if ('bloomRadius' in this.params) bloomFolder.add(this.params, 'bloomRadius', 0.0, 2.0, 0.05).name('Radius').onChange(v => { if (this.bloomPass) this.bloomPass.radius = v; });
            if ('bloomThreshold' in this.params) bloomFolder.add(this.params, 'bloomThreshold', 0.0, 1.0, 0.01).name('Threshold').onChange(v => { if (this.bloomPass) this.bloomPass.threshold = v; });
        } else {
            bloomFolder.add({ Note: "Bloom disabled (check console for errors)" }, 'Note').disable();
        }
        bloomFolder.close();

        // --- Obstacles ---
        const obstacleFolder = this.gui.addFolder('Obstacles');
        if ('enableObstacles' in this.params) obstacleFolder.add(this.params, 'enableObstacles').name('Enable Obstacles').onChange(() => this.createObstacleMeshes());
         // Maybe add controls for obstacle properties later if needed
        obstacleFolder.close();
    }

    applyPreset(name, isInitial = false) {
        console.log(`Applying preset: ${name}`);
        const preset = PRESETS[name];
        if (!preset) {
            console.warn(`Preset "${name}" not found.`);
            return;
        }

        const oldParticleCount = this.params.particlesCount;

        // --- Parameter Merging ---
        // Start with a deep copy of the 'Medium' preset as a base default structure
        // This ensures all expected keys exist.
        const baseParams = JSON.parse(JSON.stringify(PRESETS['Medium']));

        // Merge the selected preset over the base defaults
        const newParams = { ...baseParams, ...preset };

        // Preserve essential states across presets if not initial load
        if (!isInitial) {
             newParams.paused = this.params.paused; // Keep pause state
        }
         // Always update the current preset name
        newParams.currentPreset = name;


        // Update the main params object
        this.params = newParams;


        // --- Apply changes ---

        // Handle particle count changes OR initial particle setup
        if (!isInitial && this.params.particlesCount !== oldParticleCount) {
            // Particle count changed *after* initial load
            this.updateParticleCount(this.params.particlesCount);
        } else if (isInitial) {
             // This is the very first load, initialize particle state in buffers
             this.initializeParticles(true); // true = full reset of positions etc.
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
        this.createObstacleMeshes(); // Update obstacles based on new enable/properties
        this.setupSpatialGrid();     // Update grid based on new radii/container size


        // Update GUI to reflect the new state (if GUI exists)
        if (this.gui) {
            this.gui.controllersRecursive().forEach(controller => controller.updateDisplay());
        }

        // Reset simulation state only when *switching* presets for a clean comparison,
        // not on the very initial load.
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
        if (!this.renderer || !this.camera) return { x: 0, y: 0 }; // Safety check
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        const vec = new THREE.Vector3(x, y, 0.5); // Use Z=0.5 for orthographic unproject
        vec.unproject(this.camera);
        return { x: vec.x, y: vec.y };
    }

    createInteractionRing() {
        // Ensure param exists
        if (!('interactionRadius' in this.params)) return;

        if (this.interactionRing) {
            // Dispose old resources before removing
            if (this.interactionRing.geometry) this.interactionRing.geometry.dispose();
            if (this.interactionRing.material) this.interactionRing.material.dispose();
            this.scene.remove(this.interactionRing);
            this.interactionRing = null; // Clear reference
        }

        const ringGeometry = new THREE.RingGeometry(this.params.interactionRadius - 0.15, this.params.interactionRadius + 0.15, 48);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.3, depthWrite: false });
        this.interactionRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.interactionRing.visible = this.params.showInteractionRadius;
        this.interactionRing.position.z = 1; // Slightly in front of particles
        this.scene.add(this.interactionRing);
    }

    createObstacleMeshes() {
         // Ensure param exists
        if (!('enableObstacles' in this.params)) return;

        // Clear existing meshes and dispose resources
        this.obstacleMeshes.forEach(mesh => {
            if(mesh.geometry) mesh.geometry.dispose();
            if(mesh.material) mesh.material.dispose();
            this.scene.remove(mesh);
        });
        this.obstacleMeshes.length = 0; // Clear the array

        if (this.params.enableObstacles && this.params.obstacles && Array.isArray(this.params.obstacles)) {
            this.params.obstacles.forEach((obs) => {
                // Validate obstacle data
                if (typeof obs?.x === 'number' && typeof obs?.y === 'number' && typeof obs?.radius === 'number' && obs.radius > 0) {
                    const geometry = new THREE.CircleGeometry(obs.radius, 32);
                    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
                    const mesh = new THREE.Mesh(geometry, meshMaterial);
                    mesh.position.set(obs.x, obs.y, -1); // Behind particles
                    this.scene.add(mesh);
                    this.obstacleMeshes.push(mesh);
                } else {
                    console.warn("Skipping invalid obstacle data:", obs);
                }
            });
        }
    }

    // --- Spatial Grid ---
    setupSpatialGrid() {
        // Ensure necessary params exist
        if (!('particleRepulsionRadius' in this.params) ||
            !('cohesionRadius' in this.params) ||
            !('containerRadius' in this.params))
        {
             console.warn("Cannot setup spatial grid: Missing required parameters.");
             return;
        }

        this.gridCellSize = Math.max(this.params.particleRepulsionRadius, this.params.cohesionRadius, 1.0); // Min cell size of 1
        const worldSize = this.params.containerRadius * 2.2; // Grid slightly larger than container
        this.gridWidth = Math.ceil(worldSize / this.gridCellSize);
        this.gridHeight = Math.ceil(worldSize / this.gridCellSize);
        this.gridOriginX = -worldSize / 2;
        this.gridOriginY = -worldSize / 2;
        this.grid = {}; // Clear grid data structure
        // console.log(`Grid setup: ${this.gridWidth}x${this.gridHeight} cells, size ${this.gridCellSize.toFixed(2)}`);
    }

    getCellCoords(x, y) {
        const cellX = Math.floor((x - this.gridOriginX) / this.gridCellSize);
        const cellY = Math.floor((y - this.gridOriginY) / this.gridCellSize);
        // Clamp to grid bounds slightly? Might prevent edge issues but adds overhead.
        // cellX = Math.max(0, Math.min(this.gridWidth - 1, cellX));
        // cellY = Math.max(0, Math.min(this.gridHeight - 1, cellY));
        return { cellX, cellY };
    }

    getCellKey(cellX, cellY) { return `${cellX}_${cellY}`; }

    updateGrid() {
        this.grid = {}; // Clear grid each frame
        // Ensure geometry and attributes are ready
        if (!this.geometry?.attributes?.position) return;

        const posArray = this.geometry.attributes.position.array;
        const count = this.params.particlesCount; // Use current active count

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const { cellX, cellY } = this.getCellCoords(posArray[i3], posArray[i3 + 1]);
            const key = this.getCellKey(cellX, cellY);
            if (!this.grid[key]) this.grid[key] = [];
            this.grid[key].push(i); // Store particle index
        }
    }

    getNeighbors(particleIndex) {
        const neighbors = [];
        // Ensure geometry and attributes are ready
        if (!this.geometry?.attributes?.position) return neighbors;

        const posArray = this.geometry.attributes.position.array;
        const i3 = particleIndex * 3;
        const { cellX, cellY } = this.getCellCoords(posArray[i3], posArray[i3 + 1]);

        // Check current cell and 8 surrounding cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = this.getCellKey(cellX + dx, cellY + dy);
                if (this.grid[key]) {
                    // Add all particle indices from this cell
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
        // Ensure renderer exists before adding listeners to its element
        if (this.renderer?.domElement) {
            window.addEventListener('mousemove', this.onMouseMove.bind(this));
            window.addEventListener('mousedown', this.onMouseDown.bind(this));
            window.addEventListener('mouseup', this.onMouseUp.bind(this));
            this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
            this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
            this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        } else {
            console.error("Cannot add canvas event listeners: Renderer not initialized.");
        }
        window.addEventListener('keydown', this.onKeyDown.bind(this));
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
        if (!this.renderer || event.target !== this.renderer.domElement) return; // Ignore clicks outside canvas
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
        // Ignore keydown events if an input element has focus (e.g., in lil-gui)
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        switch (event.key.toUpperCase()) {
            case 'G':
                if ('gravityEnabled' in this.params) {
                    this.params.gravityEnabled = !this.params.gravityEnabled;
                 }
                break;
            case 'P':
                 if ('paused' in this.params) {
                    this.params.paused = !this.params.paused;
                 }
                 break;
            case 'R': this.resetSimulation(); break;
        }
        // Update GUI for toggles like pause/gravity
        if (this.gui) {
            this.gui.controllersRecursive().forEach(c => {
                if (c.property === 'paused' || c.property === 'gravityEnabled') {
                    c.updateDisplay();
                }
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
             event.preventDefault(); // Prevent default touch actions like scrolling
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
                     event.preventDefault(); // Prevent scrolling while dragging
                     break; // Found the tracked touch
                 }
             }
         }
    }

    onTouchEndCancel(event) {
        if (this.touchIdentifier !== null) {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 if (event.changedTouches[i].identifier === this.touchIdentifier) {
                     // Stop interaction when the tracked touch is released
                     this.isAttracting = false; this.isRepelling = false; this.isVortexing = false; this.isStirring = false;
                     this.touchIdentifier = null; // Stop tracking
                     break;
                 }
             }
         }
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return; // Don't resize if core components aren't ready

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
        // Ensure everything needed for update is ready and not paused
        if (this.params.paused ||
            !this.particleSystem ||
            !this.geometry?.attributes?.position ||
            !this.velocities ||
            !this.geometry?.attributes?.color)
        {
             return;
        }


        // 1. Update Spatial Grid
        this.updateGrid();

        // Get direct references to arrays and current count for performance
        const posArray = this.geometry.attributes.position.array;
        const velArray = this.velocities;
        const colArray = this.geometry.attributes.color.array;
        const count = this.params.particlesCount;

        // Pre-calculate constants/parameters used heavily in the loop
        const mouseInteractionRadius = this.params.interactionRadius;
        const mouseInteractionRadiusSq = mouseInteractionRadius * mouseInteractionRadius;
        const particleRepulsionRadius = this.params.particleRepulsionRadius;
        const particleRepulsionRadiusSq = particleRepulsionRadius * particleRepulsionRadius;
        const cohesionRadius = this.params.cohesionRadius;
        const cohesionRadiusSq = cohesionRadius * cohesionRadius;
        const maxVel = this.params.maxVelocity;
        const maxVelSq = maxVel * maxVel;
        const damping = this.params.damping;
        const edgeDamping = this.params.edgeDamping;
        const containerRadius = this.params.containerRadius;
        const containerRadiusSq = containerRadius * containerRadius;
        const gravity = this.params.gravityEnabled ? this.params.gravityStrength : 0;
        const obstacles = (this.params.enableObstacles && this.obstacleMeshes.length > 0) ? this.params.obstacles : []; // Use cached obstacles if enabled
        const repulsionStrength = this.params.repulsionStrength;
        const cohesionStrength = this.params.cohesionStrength;
        const attractionStrength = this.params.attractionStrength;
        const repellingStrength = this.params.repellingStrength;
        const vortexStrength = this.params.vortexStrength;
        const stirStrength = this.params.stirStrength;


        // Base Color HSL (fetch once per frame)
        let baseHSL = { h: 0, s: 1, l: 0.5 };
        if (this.baseColor && typeof this.baseColor.getHSL === 'function') {
            this.baseColor.getHSL(baseHSL);
        } else { // Fallback if baseColor isn't set correctly
            this.baseColor = new THREE.Color(this.params.particleBaseColor || '#40E0D0');
            this.baseColor.getHSL(baseHSL);
        }
        const velColorScale = this.params.particleVelocityColorScale * 0.1; // Precalc hue shift scale


        // --- Particle Update Loop (Iterate only over active particles) ---
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const px = posArray[i3];
            const py = posArray[i3 + 1];
            let vx = velArray[i3];
            let vy = velArray[i3 + 1];

            // --- Apply Forces ---
            // Gravity
            vy -= gravity;

            // Mouse Interaction
            const dxMouse = this.mouseX - px;
            const dyMouse = this.mouseY - py;
            const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;

            // Check if within interaction radius (use squared distance for efficiency)
            if (distMouseSq > 0.0001 && distMouseSq < mouseInteractionRadiusSq) {
                const distMouse = Math.sqrt(distMouseSq);
                const invDist = 1.0 / distMouse;
                const normX = dxMouse * invDist;
                const normY = dyMouse * invDist;

                if (this.isAttracting) { vx += normX * attractionStrength; vy += normY * attractionStrength; }
                if (this.isRepelling) { vx -= normX * repellingStrength; vy -= normY * repellingStrength; }
                if (this.isVortexing) { vx += -normY * vortexStrength; vy += normX * vortexStrength; } // Perpendicular force for vortex
                if (this.isStirring) {
                     // Stirring force decreases with distance from center
                    const stirFactor = stirStrength * Math.max(0, (1.0 - distMouse / mouseInteractionRadius));
                    vx += -normY * stirFactor; vy += normX * stirFactor;
                }
            }

             // Particle-Particle Interaction (Using Spatial Grid)
             if (repulsionStrength > 0 || cohesionStrength > 0) {
                 const neighbors = this.getNeighbors(i);
                 for (const j of neighbors) {
                     if (i === j) continue; // Don't interact with self

                     const j3 = j * 3;
                     const dx = posArray[j3] - px;
                     const dy = posArray[j3 + 1] - py;
                     const distSq = dx * dx + dy * dy;

                     // Repulsion (push away if too close)
                     if (repulsionStrength > 0 && distSq < particleRepulsionRadiusSq && distSq > 0.0001) {
                         const distance = Math.sqrt(distSq);
                         const invDist = 1.0 / distance;
                         // Force increases sharply as particles get closer
                         const forceMagnitude = (1.0 - distance / particleRepulsionRadius) * repulsionStrength * invDist;
                         vx -= dx * forceMagnitude;
                         vy -= dy * forceMagnitude;
                         // Note: The force on particle 'j' will be calculated when its turn comes.
                     }
                     // Cohesion (pull together if within cohesion range but outside repulsion range)
                     else if (cohesionStrength > 0 && distSq < cohesionRadiusSq && distSq > particleRepulsionRadiusSq) {
                         const distance = Math.sqrt(distSq);
                          // A simple linear attraction force towards the neighbor
                         const forceMagnitude = cohesionStrength * (1.0 - distance / cohesionRadius);
                         // Normalize direction and apply force
                         const invDist = 1.0 / (distance + 0.001); // Avoid division by zero
                         vx += dx * forceMagnitude * invDist;
                         vy += dy * forceMagnitude * invDist;
                     }
                 } // End neighbor loop
             } // End particle-particle check


            // --- Velocity Limiting & Damping ---
            const velMagSq = vx * vx + vy * vy;
            if (velMagSq > maxVelSq) {
                // Scale velocity back to maxVelocity if exceeding limit
                const scale = maxVel / Math.sqrt(velMagSq);
                vx *= scale; vy *= scale;
            }
            // Apply damping (friction)
            vx *= damping; vy *= damping;


            // --- Update Position (Simple Euler integration) ---
            // nextPos = currentPos + velocity * timeStep
            // Here, timeStep is implicitly 1 frame. Using actual deltaTime
            // would require re-tuning forces and damping.
            let nextX = px + vx;
            let nextY = py + vy;

            // --- Collision Detection & Response ---
            // 1. Boundary Collision
            const distFromCenterSq = nextX * nextX + nextY * nextY;
            if (distFromCenterSq > containerRadiusSq) {
                const distFromCenter = Math.sqrt(distFromCenterSq);
                // Normalize the position vector to get the boundary normal
                const normX = nextX / distFromCenter;
                const normY = nextY / distFromCenter;
                // Calculate velocity component normal to the boundary
                const dot = vx * normX + vy * normY;
                // Reflect the normal velocity component and apply edge damping
                vx -= (1 + edgeDamping) * dot * normX;
                vy -= (1 + edgeDamping) * dot * normY;
                // Clamp position exactly to the boundary edge
                nextX = normX * containerRadius;
                nextY = normY * containerRadius;
            }

            // 2. Obstacle Collision
            for (const obs of obstacles) {
                const dxObs = nextX - obs.x;
                const dyObs = nextY - obs.y;
                const distObsSq = dxObs * dxObs + dyObs * dyObs;
                const obsRadiusSq = obs.radius * obs.radius;

                // Check if inside obstacle
                if (distObsSq < obsRadiusSq && distObsSq > 0.0001) {
                    const distObs = Math.sqrt(distObsSq);
                    // Normal vector pointing from obstacle center to particle position
                    const normX = dxObs / distObs;
                    const normY = dyObs / distObs;
                    // Velocity component towards obstacle center
                    const dot = vx * normX + vy * normY;
                    // Only reflect if moving *into* the obstacle
                    if (dot < 0) {
                        vx -= (1 + edgeDamping) * dot * normX;
                        vy -= (1 + edgeDamping) * dot * normY;
                    }
                    // Push particle slightly outside the obstacle radius to prevent sticking
                    nextX = obs.x + normX * (obs.radius + 0.01);
                    nextY = obs.y + normY * (obs.radius + 0.01);
                }
            } // End obstacle loop


            // --- Finalize Position & Velocity Update in Buffers ---
            posArray[i3] = nextX;
            posArray[i3 + 1] = nextY;
            // posArray[i3 + 2] = 0; // Z position remains 0

            velArray[i3] = vx;
            velArray[i3 + 1] = vy;
            // velArray[i3 + 2] = 0; // Z velocity remains 0

            // --- Update Color Based on Velocity ---
            const speed = Math.sqrt(vx * vx + vy * vy); // Current speed
             // Shift hue based on speed, clamped to avoid excessive shifts
            const hueShift = Math.min(speed * velColorScale, 0.7);
            const finalHue = (baseHSL.h + hueShift) % 1.0; // Wrap hue around
            // Adjust saturation and lightness slightly for visual effect
            const finalSaturation = Math.min(1.0, baseHSL.s * 1.05 + 0.05);
            const finalLightness = Math.min(0.9, baseHSL.l * 1.0 + 0.1); // Brighter for faster particles

            // Set color using the temporary color object
            this.tempColor.setHSL(finalHue, finalSaturation, finalLightness);

            // Update color buffer
            colArray[i3] = this.tempColor.r;
            colArray[i3 + 1] = this.tempColor.g;
            colArray[i3 + 2] = this.tempColor.b;

        } // --- End Particle Loop ---

        // --- Mark Buffers for Update on GPU ---
        // Since we modified position and color arrays, tell Three.js to upload the changes.
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    animate() {
        // Request the next frame
        requestAnimationFrame(this.animate.bind(this));

        // Calculate time delta since last frame
        const currentTime = performance.now();
        // Cap delta time to prevent huge jumps if tab loses focus, etc. (e.g., max 50ms)
        const deltaTime = Math.min(0.05, (currentTime - this.lastTime) / 1000);
        this.lastTime = currentTime;

        // --- FPS Calculation ---
        this.fpsUpdateTimer += deltaTime;
        this.frameCount++;
        if (this.fpsUpdateTimer >= 1.0) { // Update FPS display every second
            const fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTimer -= 1.0; // Subtract 1 second, don't reset to 0
            if (this.fpsCounter) {
                 this.fpsCounter.textContent = `FPS: ${fps}`;
            }
        }

        // --- Simulation Update Step ---
        this.update(deltaTime); // Pass deltaTime (though not fully used in physics yet)

        // --- Render Scene ---
        if (this.composer && this.bloomPass?.enabled) {
            this.composer.render(deltaTime); // Use composer if bloom is enabled
        } else if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera); // Basic render otherwise
        }
    }

    // --- Cleanup (Optional but good practice) ---
    dispose() {
         console.log("Disposing Fluid Simulation resources...");
         // Stop animation loop? (Tricky with requestAnimationFrame)
         // Remove event listeners
         window.removeEventListener('mousemove', this.onMouseMove.bind(this));
         window.removeEventListener('mousedown', this.onMouseDown.bind(this));
         window.removeEventListener('mouseup', this.onMouseUp.bind(this));
         window.removeEventListener('keydown', this.onKeyDown.bind(this));
         window.removeEventListener('touchend', this.onTouchEndCancel.bind(this));
         window.removeEventListener('touchcancel', this.onTouchEndCancel.bind(this));
         window.removeEventListener('resize', this.onWindowResize.bind(this));
          if (this.renderer?.domElement) {
                this.renderer.domElement.removeEventListener('contextmenu', (event) => event.preventDefault()); // Might need handle if anonymous
                this.renderer.domElement.removeEventListener('touchstart', this.onTouchStart.bind(this));
                this.renderer.domElement.removeEventListener('touchmove', this.onTouchMove.bind(this));
          }

         if(this.gui) this.gui.destroy();

         // Dispose THREE.js objects
         this.obstacleMeshes.forEach(mesh => {
            if(mesh.geometry) mesh.geometry.dispose();
            if(mesh.material) mesh.material.dispose();
            if(this.scene) this.scene.remove(mesh);
         });
         this.obstacleMeshes.length = 0;

         if(this.interactionRing) {
            if(this.interactionRing.geometry) this.interactionRing.geometry.dispose();
            if(this.interactionRing.material) this.interactionRing.material.dispose();
            if(this.scene) this.scene.remove(this.interactionRing);
         }

         if(this.particleSystem && this.scene) this.scene.remove(this.particleSystem);
         if(this.material) this.material.dispose();
         if(this.geometry) this.geometry.dispose();

         // Dispose composer passes? Check Three.js docs for specific pass disposal if needed.
         // If composer has a dispose method: if(this.composer) this.composer.dispose();

         if(this.renderer) {
              this.renderer.dispose(); // Release WebGL context and resources
               if (this.renderer.domElement && this.container) {
                    this.container.removeChild(this.renderer.domElement); // Remove canvas from DOM
               }
         }
         console.log("Fluid Simulation disposed.");
    }
}


// --- Script Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    // Make sure the body exists before trying to append the canvas
    if (document.body) {
        const simulation = new FluidSimulation(document.body);
        try {
            simulation.init();
             // Optional: Make simulation accessible globally for debugging in console
             // window.fluidSim = simulation;
        } catch (error) {
            console.error("Error initializing simulation:", error);
            // Display error to user?
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'absolute';
            errorDiv.style.top = '10px';
            errorDiv.style.left = '10px';
            errorDiv.style.padding = '10px';
            errorDiv.style.backgroundColor = 'rgba(255,0,0,0.8)';
            errorDiv.style.color = 'white';
            errorDiv.style.zIndex = '200';
            errorDiv.innerText = `Initialization Error: ${error.message}\n(Check console for details)`;
            document.body.appendChild(errorDiv);
        }
    } else {
        console.error("DOM body not found at DOMContentLoaded!");
    }
});