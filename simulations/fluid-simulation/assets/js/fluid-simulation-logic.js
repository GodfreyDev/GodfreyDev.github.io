(function() {
const GUI = (window.lil && window.lil.GUI) ? window.lil.GUI : window.GUI;
const { FRUSTUM_SIZE = 120, MAX_PARTICLES = 20000, DEFAULT_PRESET_NAME = 'Medium' } = window.SIM_CONSTANTS || {};
const PRESETS = window.FLUID_PRESETS || {};

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
        this.tempColor = new THREE.Color();

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
        this.forceZoneMeshes = []; // For visualizing force zones

        // --- Buffers (allocated once) ---
        this.positions = null;
        this.velocities = null;
        this.colors = null;
        this.baseColors = null;
        this.initialPositions = null; // Stores start positions for reset
        this.isEmitter = null;

        // --- Spatial Grid ---
        this.grid = {};
        this.gridCellSize = 0; // Will be set by setupSpatialGrid

        // --- Timing & Control ---
        this.lastTime = performance.now();
        this.fpsCounter = document.getElementById('fpsCounter');
        this.frameCount = 0;
        this.fpsUpdateTimer = 0;
        this.gui = null;
        this.gifEncoder = null;
        this.gifStatusEl = document.getElementById('gifStatus');
        this.gifCapture = {
            active: false,
            rendering: false,
            frameDelayMs: 0,
            lastFrameTime: 0,
            maxFrames: 0,
            framesCaptured: 0
        };
        this.gifSettings = {
            duration: 3,
            fps: 15,
            quality: 10,
            scale: 0.7,
            cropMode: 'square',
            cropScale: 1,
            offsetX: 0,
            offsetY: 0,
            showFrame: false
        };
        this.gifCaptureCanvas = document.createElement('canvas');
        this.gifCaptureCtx = this.gifCaptureCanvas.getContext('2d', { willReadFrequently: true });
        this.gifCaptureRect = null;
        this.gifCaptureFrame = document.getElementById('gifCaptureFrame');

        // --- Simulation Parameters (will be populated by applyPreset) ---
        this.params = {
            currentPreset: DEFAULT_PRESET_NAME,
            paused: false,
            particlesCount: PRESETS[DEFAULT_PRESET_NAME].particlesCount, // Actual number of active particles
            // other params will be filled by applyPreset
        };

        // --- Interaction States ---
        this.draggedObstacleIndex = -1;
        this.draggedObstacleOffsetX = 0;
        this.draggedObstacleOffsetY = 0;

        // --- Emitter internal data ---
        // Stores accumulator for fractional particle emission
        this.emitterInternals = []; // Will be populated based on this.params.emitters

        this.boat = {
            enabled: false,
            nodes: [],
            sticks: [],
            damping: 0.99,
            interactionRadius: 4.0, // How close fluid particles need to be to affect the boat
            impulseFactor: 0.05, // How much a fluid particle pushes a boat node
        };
        this.boatStickMesh = null; // For rendering the boat's frame
        this.boatNodeMesh = null;  // For rendering the boat's vertices
    }

    init() {
        this.setupScene();
        this.setupRenderer();
        this.setupCamera();
        this.setupComposer();
        this.allocateBuffers();
        this.applyPreset(this.params.currentPreset, true); // true for initial load
        this.setupGUI();
        this.setupEventListeners();
        this.animate();
    }

    setupScene() {  this.scene = new THREE.Scene(); }
    setupRenderer() { 
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        // Lower pixel ratio a bit to improve performance on high DPI screens
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
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
        if (!window.THREE?.EffectComposer || !window.THREE?.RenderPass || !window.THREE?.UnrealBloomPass) {
             console.error("EffectComposer or required passes not found!");
             this.composer = null; this.bloomPass = null; return;
        }
        this.composer = new THREE.EffectComposer(this.renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
        this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        this.composer.addPass(this.bloomPass);
    }

    allocateBuffers() { 
         this.positions = new Float32Array(MAX_PARTICLES * 3);
         this.velocities = new Float32Array(MAX_PARTICLES * 3);
         this.colors = new Float32Array(MAX_PARTICLES * 3);
         this.baseColors = new Float32Array(MAX_PARTICLES * 3);
         this.initialPositions = new Float32Array(MAX_PARTICLES * 3);
         this.isEmitter = new Uint8Array(MAX_PARTICLES);
         this.geometry = new THREE.BufferGeometry();
         this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
         this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
         this.material = new THREE.PointsMaterial({ size: 1.0, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
         this.particleSystem = new THREE.Points(this.geometry, this.material);
         this.geometry.setDrawRange(0, 0);
         this.scene.add(this.particleSystem);
    }

    initializeParticles(fullReset = true) {
        const count = this.params.particlesCount; // This is the *initial* count for the preset
        this.baseColor.set(this.params.particleBaseColor);
        const currentContainerRadius = this.params.containerRadius;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            let px, py;
            if (!fullReset && i * 3 < this.initialPositions.length && (this.initialPositions[i3] !== 0 || this.initialPositions[i3+1] !== 0)) {
                 px = this.initialPositions[i3]; py = this.initialPositions[i3 + 1];
            } else {
                const radius = Math.pow(Math.random(), 0.7) * currentContainerRadius * 0.9 + currentContainerRadius * 0.05;
                const angle = Math.random() * Math.PI * 2;
                px = Math.cos(angle) * radius; py = Math.sin(angle) * radius;
                this.initialPositions[i3] = px; this.initialPositions[i3 + 1] = py; this.initialPositions[i3 + 2] = 0;
            }
            this.positions[i3] = px; this.positions[i3 + 1] = py; this.positions[i3 + 2] = 0;
            this.velocities[i3] = (Math.random() - 0.5) * 0.1; this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.1; this.velocities[i3 + 2] = 0;
            this.isEmitter[i] = 0;
            this.baseColors[i3] = this.baseColor.r; this.baseColors[i3 + 1] = this.baseColor.g; this.baseColors[i3 + 2] = this.baseColor.b;
            if (this.params.useVerticalGradient) {
                this.tempColor.copy(this.baseColor);
                const hsl = { h: 0, s: 0, l: 0 };
                this.tempColor.getHSL(hsl);
                hsl.h = (hsl.h + ((py + currentContainerRadius) / (2 * currentContainerRadius)) * this.params.gradientHueScale) % 1.0;
                this.tempColor.setHSL(hsl.h, hsl.s, hsl.l);
                this.colors[i3] = this.tempColor.r; this.colors[i3 + 1] = this.tempColor.g; this.colors[i3 + 2] = this.tempColor.b;
            } else {
                this.colors[i3] = this.baseColor.r; this.colors[i3 + 1] = this.baseColor.g; this.colors[i3 + 2] = this.baseColor.b;
            }
        }
        // Zero out remaining buffer parts if count < MAX_PARTICLES
        for (let i = count; i < MAX_PARTICLES; i++) {
            const i3 = i * 3;
            this.positions[i3] = 0; this.positions[i3+1] = 0; this.positions[i3+2] = 0;
            this.velocities[i3] = 0; this.velocities[i3+1] = 0; this.velocities[i3+2] = 0;
            this.colors[i3] = 0; this.colors[i3+1] = 0; this.colors[i3+2] = 0;
            this.baseColors[i3] = 0; this.baseColors[i3+1] = 0; this.baseColors[i3+2] = 0;
            this.isEmitter[i] = 0;
            if (fullReset) { // Only clear initial positions on a full reset
                 this.initialPositions[i3] = 0; this.initialPositions[i3+1] = 0; this.initialPositions[i3+2] = 0;
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.setDrawRange(0, count);
    }

    updateBaseColors() {
        const count = this.params.particlesCount;
        this.baseColor.set(this.params.particleBaseColor);
        const currentContainerRadius = this.params.containerRadius;
        for (let i = 0; i < count; i++) {
            if (this.isEmitter[i]) continue;
            const i3 = i * 3;
            this.baseColors[i3] = this.baseColor.r; this.baseColors[i3 + 1] = this.baseColor.g; this.baseColors[i3 + 2] = this.baseColor.b;
            if (this.params.useVerticalGradient) {
                const py = this.positions[i3 + 1];
                this.tempColor.copy(this.baseColor);
                const hsl = { h: 0, s: 0, l: 0 };
                this.tempColor.getHSL(hsl);
                hsl.h = (hsl.h + ((py + currentContainerRadius) / (2 * currentContainerRadius)) * this.params.gradientHueScale) % 1.0;
                this.tempColor.setHSL(hsl.h, hsl.s, hsl.l);
                this.colors[i3] = this.tempColor.r; this.colors[i3 + 1] = this.tempColor.g; this.colors[i3 + 2] = this.tempColor.b;
            } else {
                this.colors[i3] = this.baseColor.r; this.colors[i3 + 1] = this.baseColor.g; this.colors[i3 + 2] = this.baseColor.b;
            }
        }
        this.geometry.attributes.color.needsUpdate = true;
    }

    updateParticleCount(newCount) { // This is now mostly for the GUI slider control
        newCount = Math.max(10, Math.min(Math.round(newCount), MAX_PARTICLES));
        const oldCount = this.params.particlesCount;
        if (newCount === oldCount) return;

        this.params.particlesCount = newCount;

        if (newCount > oldCount) { // Increasing count
            this.baseColor.set(this.params.particleBaseColor);
            const currentContainerRadius = this.params.containerRadius;
            for (let i = oldCount; i < newCount; i++) {
                 const i3 = i * 3;
                 const radius = Math.pow(Math.random(), 0.7) * currentContainerRadius * 0.9 + currentContainerRadius * 0.05;
                 const angle = Math.random() * Math.PI * 2;
                 const px = Math.cos(angle) * radius; const py = Math.sin(angle) * radius;
                 this.positions[i3] = px; this.positions[i3 + 1] = py; this.positions[i3 + 2] = 0;
                 this.initialPositions[i3] = px; this.initialPositions[i3 + 1] = py; this.initialPositions[i3 + 2] = 0; // Store initial for these new particles
                 this.velocities[i3] = (Math.random() - 0.5) * 0.1; this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
                 this.isEmitter[i] = 0;
                 this.baseColors[i3] = this.baseColor.r; this.baseColors[i3 + 1] = this.baseColor.g; this.baseColors[i3 + 2] = this.baseColor.b;
                 if (this.params.useVerticalGradient) {
                     this.tempColor.copy(this.baseColor);
                     const hsl = { h: 0, s: 0, l: 0 };
                     this.tempColor.getHSL(hsl);
                     hsl.h = (hsl.h + ((py + currentContainerRadius) / (2 * currentContainerRadius)) * this.params.gradientHueScale) % 1.0;
                     this.tempColor.setHSL(hsl.h, hsl.s, hsl.l);
                     this.colors[i3] = this.tempColor.r; this.colors[i3+1] = this.tempColor.g; this.colors[i3+2] = this.tempColor.b;
                 } else {
                     this.colors[i3] = this.baseColor.r; this.colors[i3 + 1] = this.baseColor.g; this.colors[i3 + 2] = this.baseColor.b;
                 }
            }
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
        }
        // For decreasing, just the draw range update is enough.
        // For increasing, new particles are initialized above.
        this.geometry.setDrawRange(0, newCount);

        if (this.gui) { this.gui.controllersRecursive().find(c => c.property === 'particlesCount')?.updateDisplay(); }
    }


    resetSimulation() {
        if (!this.geometry || !this.initialPositions) { console.error("Cannot reset, buffers not initialized."); return; }

        // Reset to the *preset's* defined particlesCount, not necessarily MAX_PARTICLES or current dynamic count
        const preset = PRESETS[this.params.currentPreset] || PRESETS[DEFAULT_PRESET_NAME];
        this.params.particlesCount = preset.particlesCount;

        this.initializeParticles(true); // Full reset of particle positions, velocities, colors based on initialPositions

        this.createBoat();

        // Reset emitter accumulators
        this.emitterInternals = (this.params.emitters || []).map(emitter => ({
            id: emitter.id,
            accumulator: 0,
            // Store a THREE.Color object for the emitter
            particleColor: new THREE.Color(emitter.color || this.params.particleBaseColor)
        }));

        this.params.paused = false;
        if (this.gui) { this.gui.controllersRecursive().forEach(controller => controller.updateDisplay()); }
    }

    updateGifStatus(message) {
        if (!this.gifStatusEl) return;
        this.gifStatusEl.textContent = message;
    }

    startGifCapture() {
        if (this.gifCapture.active || this.gifCapture.rendering) return;
        if (!window.GIF) {
            this.updateGifStatus('GIF: Library missing');
            return;
        }
        if (window.location.protocol === 'file:') {
            this.updateGifStatus('GIF: Run via local server (file:// blocks workers)');
            return;
        }
        if (!this.renderer || !this.renderer.domElement) {
            this.updateGifStatus('GIF: Renderer not ready');
            return;
        }

        const fps = Math.max(5, Math.min(Math.round(this.gifSettings.fps), 30));
        const duration = Math.max(1, this.gifSettings.duration);
        const quality = Math.max(1, Math.min(Math.round(this.gifSettings.quality), 30));
        const frameDelayMs = Math.round(1000 / fps);
        const captureRect = this.getGifCaptureRect();
        if (!captureRect) {
            this.updateGifStatus('GIF: Capture frame unavailable');
            return;
        }
        this.gifCaptureRect = captureRect;
        if (!this.ensureGifCaptureCanvas(captureRect)) {
            this.updateGifStatus('GIF: Capture canvas failed');
            return;
        }

        let workerScript = 'assets/vendor/gif.worker.js';
        try {
            workerScript = new URL('assets/vendor/gif.worker.js', window.location.href).toString();
        } catch (error) {
            console.warn('GIF worker URL fallback used:', error);
        }
        try {
            this.gifEncoder = new GIF({
                workers: 2,
                quality,
                width: captureRect.outputWidth,
                height: captureRect.outputHeight,
                workerScript
            });
        } catch (error) {
            console.error('GIF worker failed to initialize:', error);
            this.updateGifStatus('GIF: Worker blocked');
            return;
        }

        this.gifCapture.active = true;
        this.gifCapture.rendering = false;
        this.gifCapture.frameDelayMs = frameDelayMs;
        this.gifCapture.maxFrames = Math.max(1, Math.round(duration * fps));
        this.gifCapture.framesCaptured = 0;
        this.gifCapture.lastFrameTime = performance.now();
        this.updateGifStatus(`GIF: Capturing 0/${this.gifCapture.maxFrames} (${captureRect.outputWidth}x${captureRect.outputHeight})`);

        this.gifEncoder.on('progress', (progress) => {
            const percent = Math.round(progress * 100);
            this.updateGifStatus(`GIF: Rendering ${percent}%`);
        });

        this.gifEncoder.on('finished', (blob) => {
            this.gifCapture.rendering = false;
            this.gifEncoder = null;
            this.downloadGif(blob);
            this.updateGifStatus('GIF: Ready');
        });
    }

    captureGifFrame(now) {
        if (!this.gifCapture.active || !this.gifEncoder || !this.renderer) return;
        if (now - this.gifCapture.lastFrameTime < this.gifCapture.frameDelayMs) return;

        this.gifCapture.lastFrameTime = now;
        try {
            const rect = this.gifCaptureRect || this.getGifCaptureRect();
            if (!rect) {
                this.cancelGifCapture();
                return;
            }
            if (!this.ensureGifCaptureCanvas(rect)) {
                this.cancelGifCapture();
                return;
            }
            this.gifCaptureRect = rect;
            this.gifCaptureCtx.drawImage(
                this.renderer.domElement,
                rect.sx,
                rect.sy,
                rect.sw,
                rect.sh,
                0,
                0,
                rect.outputWidth,
                rect.outputHeight
            );
            this.gifEncoder.addFrame(this.gifCaptureCtx, { copy: true, delay: this.gifCapture.frameDelayMs });
        } catch (error) {
            console.error('GIF capture failed:', error);
            this.cancelGifCapture();
            return;
        }

        this.gifCapture.framesCaptured += 1;
        this.updateGifStatus(`GIF: Capturing ${this.gifCapture.framesCaptured}/${this.gifCapture.maxFrames}`);
        if (this.gifCapture.framesCaptured >= this.gifCapture.maxFrames) {
            this.finishGifCapture();
        }
    }

    finishGifCapture() {
        if (!this.gifEncoder || this.gifCapture.rendering) return;
        this.gifCapture.active = false;
        this.gifCapture.rendering = true;
        this.gifCaptureRect = null;
        this.updateGifStatus('GIF: Rendering...');
        this.gifEncoder.render();
    }

    cancelGifCapture() {
        if (!this.gifEncoder || this.gifCapture.rendering) {
            this.updateGifStatus('GIF: Ready');
            return;
        }
        if (typeof this.gifEncoder.abort === 'function') {
            this.gifEncoder.abort();
        }
        this.gifEncoder = null;
        this.gifCapture.active = false;
        this.gifCapture.rendering = false;
        this.gifCaptureRect = null;
        this.updateGifStatus('GIF: Canceled');
    }

    downloadGif(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fluid-simulation-${Date.now()}.gif`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    centerGifFrame() {
        this.gifSettings.offsetX = 0;
        this.gifSettings.offsetY = 0;
        if (this.gui) {
            this.gui.controllersRecursive().forEach(controller => controller.updateDisplay());
        }
        this.updateGifCaptureFrame();
    }

    getGifCaptureRect() {
        if (!this.renderer || !this.renderer.domElement) return null;
        const canvas = this.renderer.domElement;
        const sourceWidth = canvas.width;
        const sourceHeight = canvas.height;
        if (!sourceWidth || !sourceHeight) return null;

        const outputScale = Math.max(0.2, Math.min(this.gifSettings.scale, 1));
        if (this.gifSettings.cropMode === 'full') {
            return {
                sx: 0,
                sy: 0,
                sw: sourceWidth,
                sh: sourceHeight,
                outputWidth: Math.max(10, Math.round(sourceWidth * outputScale)),
                outputHeight: Math.max(10, Math.round(sourceHeight * outputScale))
            };
        }

        const cropScale = Math.max(0.2, Math.min(this.gifSettings.cropScale, 1));
        const cropSize = Math.max(10, Math.round(Math.min(sourceWidth, sourceHeight) * cropScale));
        const offsetX = (this.gifSettings.offsetX || 0) * cropSize;
        const offsetY = (this.gifSettings.offsetY || 0) * cropSize;
        const centerX = sourceWidth / 2 + offsetX;
        const centerY = sourceHeight / 2 + offsetY;
        let sx = Math.round(centerX - cropSize / 2);
        let sy = Math.round(centerY - cropSize / 2);
        sx = Math.max(0, Math.min(sx, sourceWidth - cropSize));
        sy = Math.max(0, Math.min(sy, sourceHeight - cropSize));

        return {
            sx,
            sy,
            sw: cropSize,
            sh: cropSize,
            outputWidth: Math.max(10, Math.round(cropSize * outputScale)),
            outputHeight: Math.max(10, Math.round(cropSize * outputScale))
        };
    }

    ensureGifCaptureCanvas(rect) {
        if (!rect) return false;
        if (!this.gifCaptureCanvas) {
            this.gifCaptureCanvas = document.createElement('canvas');
        }
        if (!this.gifCaptureCtx) {
            this.gifCaptureCtx = this.gifCaptureCanvas.getContext('2d', { willReadFrequently: true });
        }
        if (!this.gifCaptureCtx) return false;
        if (this.gifCaptureCanvas.width !== rect.outputWidth || this.gifCaptureCanvas.height !== rect.outputHeight) {
            this.gifCaptureCanvas.width = rect.outputWidth;
            this.gifCaptureCanvas.height = rect.outputHeight;
        }
        this.gifCaptureCtx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in this.gifCaptureCtx) {
            this.gifCaptureCtx.imageSmoothingQuality = 'high';
        }
        return true;
    }

    updateGifCaptureFrame() {
        if (!this.gifCaptureFrame || !this.renderer || !this.renderer.domElement) return;
        if (!this.gifSettings.showFrame) {
            this.gifCaptureFrame.style.display = 'none';
            return;
        }
        const rect = this.getGifCaptureRect();
        if (!rect) {
            this.gifCaptureFrame.style.display = 'none';
            return;
        }
        const canvas = this.renderer.domElement;
        const bounds = canvas.getBoundingClientRect();
        const scaleX = bounds.width / canvas.width;
        const scaleY = bounds.height / canvas.height;
        this.gifCaptureFrame.style.display = 'block';
        this.gifCaptureFrame.style.left = `${Math.round(bounds.left + rect.sx * scaleX)}px`;
        this.gifCaptureFrame.style.top = `${Math.round(bounds.top + rect.sy * scaleY)}px`;
        this.gifCaptureFrame.style.width = `${Math.round(rect.sw * scaleX)}px`;
        this.gifCaptureFrame.style.height = `${Math.round(rect.sh * scaleY)}px`;
    }

    setupGUI() {
        if (this.gui) this.gui.destroy();
        if (!GUI) {
            console.error("lil-gui not loaded; GUI controls disabled.");
            return;
        }
        this.gui = new GUI();
        this.gui.title("Fluid Controls 2.0");

        // --- Presets ---
        this.gui.add(this.params, 'currentPreset', Object.keys(PRESETS))
            .name('Preset').onChange(value => this.applyPreset(value));

        // --- Performance & Core ---
        const coreFolder = this.gui.addFolder('Performance & Core');
        coreFolder.add(this.params, 'particlesCount', 100, MAX_PARTICLES, 100)
             .name('Particle Count').listen().onFinishChange(value => this.updateParticleCount(value));
        coreFolder.add(this.params, 'paused').name('Pause (P)').listen();
        coreFolder.add(this, 'resetSimulation').name('Reset (R)');
        coreFolder.open();

        const boatFolder = this.gui.addFolder('Boat');
        boatFolder.add(this.boat, 'enabled').name('Enable Boat').onChange(() => {
            this.createBoat(); // Recreate the boat when toggled
        });
        boatFolder.add(this.boat, 'damping', 0.9, 1.0, 0.001).name('Boat Damping');
        boatFolder.add(this.boat, 'interactionRadius', 1, 10, 0.1).name('Boat Node Radius');
        boatFolder.add(this.boat, 'impulseFactor', 0, 0.2, 0.005).name('Impulse Factor');
        boatFolder.open();


        // --- Mouse Tools ---
        const toolsFolder = this.gui.addFolder('Mouse Tools');
        toolsFolder.add(this.params, 'mouseTool', ['default', 'moveObstacle'])
            .name('Tool Mode').onChange(tool => {
                if (tool !== 'default') { // Deactivate standard interactions if a specific tool is chosen
                    this.isAttracting = this.isRepelling = this.isVortexing = this.isStirring = false;
                }
            });
        toolsFolder.add(this.params, 'interactionRadius', 1, 40, 0.5).name('Mouse Radius').onChange(() => this.createInteractionRing());
        toolsFolder.add(this.params, 'showInteractionRadius').name('Show Mouse Radius').onChange(v => { if(this.interactionRing) this.interactionRing.visible = v; });
        const defaultInteractionsFolder = toolsFolder.addFolder('Default Tool Interactions');
        defaultInteractionsFolder.add(this.params, 'attractionStrength', 0.0, 5.0, 0.01).name('Attraction Str.');
        defaultInteractionsFolder.add(this.params, 'repellingStrength', 0.0, 5.0, 0.01).name('Repulsion Str.');
        defaultInteractionsFolder.add(this.params, 'vortexStrength', 0.0, 5.0, 0.01).name('Vortex Str.');
        defaultInteractionsFolder.add(this.params, 'stirStrength', 0.0, 5.0, 0.01).name('Stir Str.');
        toolsFolder.open();


        // --- Physics ---
        const physicsFolder = this.gui.addFolder('Physics');
        physicsFolder.add(this.params, 'damping', 0.5, 1.0, 0.005).name('Damping');
        physicsFolder.add(this.params, 'edgeDamping', 0.0, 2.0, 0.05).name('Edge Damping');
        physicsFolder.add(this.params, 'maxVelocity', 0.0, 20.0, 0.1).name('Max Velocity');
        physicsFolder.add(this.params, 'gravityEnabled').name('Enable Gravity (G)').listen();
        physicsFolder.add(this.params, 'gravityStrength', 0.0, 2.0, 0.005).name('Gravity Strength');
        physicsFolder.add(this.params, 'containerRadius', 20, Math.max(100, FRUSTUM_SIZE/1.5), 1).name('Container Radius')
            .onFinishChange(() => this.setupSpatialGrid());
        physicsFolder.add(this.params, 'wrapAroundEdges').name('Wrap Around');
        physicsFolder.add(this.params, 'wrapScreenEdges').name('Screen Wrap');
        physicsFolder.close();

        // --- Particle Interactions ---
        const pInteractionsFolder = this.gui.addFolder('Particle Interactions');
        pInteractionsFolder.add(this.params, 'particleRepulsionRadius', 0.25, 20.0, 0.1).name('Repulsion Radius').onFinishChange(() => this.setupSpatialGrid());
        pInteractionsFolder.add(this.params, 'repulsionStrength', 0.0, 5.0, 0.01).name('Repulsion Str.');
        pInteractionsFolder.add(this.params, 'cohesionRadius', 1.0, 30.0, 0.1).name('Cohesion Radius').onFinishChange(() => this.setupSpatialGrid());
        pInteractionsFolder.add(this.params, 'cohesionStrength', 0.0, 1.0, 0.001).name('Cohesion Str.');
        pInteractionsFolder.add(this.params, 'viscosityRadius', 1.0, 10.0, 0.1).name('Viscosity Radius').onFinishChange(() => this.setupSpatialGrid());
        pInteractionsFolder.add(this.params, 'viscosityStrength', 0.0, 1.0, 0.01).name('Viscosity');
        pInteractionsFolder.close();

        // --- Visualization ---
        const vizFolder = this.gui.addFolder('Visualization');
        vizFolder.addColor(this.params, 'particleBaseColor').name('Base Color').onChange(() => this.updateBaseColors());
        vizFolder.add(this.params, 'particleVelocityColorScale', 0, 15, 0.1).name('Velocity Color Scale');
        vizFolder.add(this.params, 'particleSize', 0.1, 10.0, 0.1).name('Particle Size').onChange(value => { if (this.material) this.material.size = value; });
        vizFolder.add(this.params, 'useVerticalGradient').name('Vertical Gradient').onChange(() => this.updateBaseColors());
        vizFolder.add(this.params, 'gradientHueScale', 0.0, 1.0, 0.01).name('Gradient Scale').onChange(() => this.updateBaseColors());
        vizFolder.addColor(this.params, 'bgColor').name('Background Color').onChange(() => this.updateBackgroundColor());
        vizFolder.close();

        // --- Bloom Effect ---
        const bloomFolder = this.gui.addFolder('Bloom Effect');
        if (this.bloomPass) {
            bloomFolder.add(this.params, 'bloomEnabled').name('Enable Bloom').onChange(v => { if (this.bloomPass) this.bloomPass.enabled = v; });
            bloomFolder.add(this.params, 'bloomStrength', 0.0, 3.0, 0.05).name('Strength').onChange(v => { if (this.bloomPass) this.bloomPass.strength = v; });
            bloomFolder.add(this.params, 'bloomRadius', 0.0, 2.0, 0.05).name('Radius').onChange(v => { if (this.bloomPass) this.bloomPass.radius = v; });
            bloomFolder.add(this.params, 'bloomThreshold', 0.0, 1.0, 0.01).name('Threshold').onChange(v => { if (this.bloomPass) this.bloomPass.threshold = v; });
        } else { bloomFolder.add({ Note: "Bloom disabled" }, 'Note').disable(); }
        bloomFolder.close();

        // --- Obstacles ---
        const obstacleFolder = this.gui.addFolder('Obstacles');
        obstacleFolder.add(this.params, 'enableObstacles').name('Enable Obstacles').onChange(() => this.createObstacleMeshes());
        // Basic example: controls for the first obstacle if it exists
        if (this.params.obstacles && this.params.obstacles.length > 0) {
            const firstObsFolder = obstacleFolder.addFolder('Obstacle 1 (Example)');
            firstObsFolder.add(this.params.obstacles[0], 'x', -FRUSTUM_SIZE/2, FRUSTUM_SIZE/2, 0.1).name('X').onChange(() => this.updateObstacleMesh(0));
            firstObsFolder.add(this.params.obstacles[0], 'y', -FRUSTUM_SIZE/2, FRUSTUM_SIZE/2, 0.1).name('Y').onChange(() => this.updateObstacleMesh(0));
            firstObsFolder.add(this.params.obstacles[0], 'radius', 1, 30, 0.1).name('Radius').onChange(() => this.updateObstacleMesh(0));
        }
        obstacleFolder.close();

        // --- Emitters ---
        const emittersFolder = this.gui.addFolder('Emitters');
        (this.params.emitters || []).forEach((emitter, index) => {
            const eFolder = emittersFolder.addFolder(`Emitter ${index + 1} (${emitter.id.substring(0,10)})`);
            eFolder.add(emitter, 'enabled').name('Enabled');
            eFolder.add(emitter, 'x', -FRUSTUM_SIZE/2, FRUSTUM_SIZE/2, 0.1).name('X');
            eFolder.add(emitter, 'y', -FRUSTUM_SIZE/2, FRUSTUM_SIZE/2, 0.1).name('Y');
            eFolder.add(emitter, 'rate', 0, 100, 1).name('Rate (particles/frame)');
            eFolder.addColor(emitter, 'color').name('Color').onChange(value => {
                const internal = this.emitterInternals.find(ei => ei.id === emitter.id);
                if (internal) internal.particleColor.set(value);
            });
            eFolder.add(emitter.initialVelocity, 'x', -5, 5, 0.01).name('Initial Vel X');
            eFolder.add(emitter.initialVelocity, 'y', -5, 5, 0.01).name('Initial Vel Y');
            eFolder.add(emitter.velocityVariance, 'x', 0, 2, 0.01).name('Vel Var X');
            eFolder.add(emitter.velocityVariance, 'y', 0, 2, 0.01).name('Vel Var Y');
        });
        if (!this.params.emitters || this.params.emitters.length === 0) {
            emittersFolder.add({ Note: "No emitters in current preset" }, 'Note').disable();
        }
        emittersFolder.close();


        // --- Force Zones ---
        const forceZonesFolder = this.gui.addFolder('Force Zones');
        (this.params.forceZones || []).forEach((fz, index) => {
            const fzFolder = forceZonesFolder.addFolder(`Force Zone ${index + 1} (${fz.id.substring(0,10)})`);
            fzFolder.add(fz, 'enabled').name('Enabled').onChange(() => this.createForceZoneMeshes());
            fzFolder.add(fz, 'x', -FRUSTUM_SIZE/2, FRUSTUM_SIZE/2, 0.1).name('X').onChange(() => this.updateForceZoneMesh(index));
            fzFolder.add(fz, 'y', -FRUSTUM_SIZE/2, FRUSTUM_SIZE/2, 0.1).name('Y').onChange(() => this.updateForceZoneMesh(index));
            fzFolder.add(fz, 'radius', 1, FRUSTUM_SIZE, 0.1).name('Radius').onChange(() => this.updateForceZoneMesh(index));
            fzFolder.add(fz.force, 'x', -0.5, 0.5, 0.001).name('Force X');
            fzFolder.add(fz.force, 'y', -0.5, 0.5, 0.001).name('Force Y');
        });
        if (!this.params.forceZones || this.params.forceZones.length === 0) {
            forceZonesFolder.add({ Note: "No force zones in current preset" }, 'Note').disable();
        }
        forceZonesFolder.close();

        const exportFolder = this.gui.addFolder('Export GIF');
        exportFolder.add(this.gifSettings, 'duration', 1, 8, 0.5).name('Duration (s)');
        exportFolder.add(this.gifSettings, 'fps', 5, 30, 1).name('FPS');
        exportFolder.add(this.gifSettings, 'quality', 1, 20, 1).name('Quality');
        exportFolder.add(this.gifSettings, 'scale', 0.3, 1.0, 0.05).name('Output Scale');

        const frameFolder = exportFolder.addFolder('Capture Frame');
        frameFolder.add(this.gifSettings, 'cropMode', ['square', 'full']).name('Mode').onChange(() => this.updateGifCaptureFrame());
        frameFolder.add(this.gifSettings, 'cropScale', 0.4, 1.0, 0.05).name('Crop Scale').onChange(() => this.updateGifCaptureFrame());
        frameFolder.add(this.gifSettings, 'offsetX', -0.5, 0.5, 0.01).name('Offset X').onChange(() => this.updateGifCaptureFrame());
        frameFolder.add(this.gifSettings, 'offsetY', -0.5, 0.5, 0.01).name('Offset Y').onChange(() => this.updateGifCaptureFrame());
        frameFolder.add(this.gifSettings, 'showFrame').name('Show Frame').onChange(() => this.updateGifCaptureFrame());
        frameFolder.add(this, 'centerGifFrame').name('Center Frame');
        frameFolder.close();

        exportFolder.add(this, 'startGifCapture').name('Start Capture');
        exportFolder.add(this, 'cancelGifCapture').name('Cancel Capture');
        exportFolder.close();
    }

    applyPreset(name, isInitial = false) {
        const preset = PRESETS[name];
        if (!preset) { console.warn(`Preset "${name}" not found.`); return; }

        const currentPauseState = this.params.paused; // Preserve pause state
        const currentMouseTool = this.params.mouseTool; // Preserve mouse tool

        // Deep clone for safety, especially for nested objects like obstacles, emitters
        const baseParams = JSON.parse(JSON.stringify(PRESETS[DEFAULT_PRESET_NAME]));
        const newPresetParams = JSON.parse(JSON.stringify(preset));
        this.params = { ...baseParams, ...newPresetParams };

        this.params.paused = currentPauseState;
        this.params.currentPreset = name;
        // Restore mouse tool only if the new preset doesn't explicitly set one (or if it's the same)
        // Or, always let preset define the tool. For now, let preset define it.
        // this.params.mouseTool = newPresetParams.mouseTool || currentMouseTool;


        // --- Apply changes ---
        // particlesCount is the *initial* count for the preset or after reset.
        // Emitters will increase the *actual* active particle count dynamically.
        // So, initializeParticles should use this.params.particlesCount from the preset.
        if (isInitial) {
            this.initializeParticles(true); // Full reset, sets this.params.particlesCount from preset
        } else {
            // For preset change, effectively a reset.
            this.resetSimulation(); // This calls initializeParticles(true) and sets count from preset
        }


        this.baseColor.set(this.params.particleBaseColor);
        if (this.material) this.material.size = this.params.particleSize;
        if (this.bloomPass) {
            this.bloomPass.enabled = this.params.bloomEnabled;
            this.bloomPass.strength = this.params.bloomStrength;
            this.bloomPass.radius = this.params.bloomRadius;
            this.bloomPass.threshold = this.params.bloomThreshold;
        }
        this.updateBackgroundColor();
        this.createInteractionRing();
        this.createObstacleMeshes();
        this.createForceZoneMeshes();
        this.setupSpatialGrid();

        // Setup internal data for emitters based on the new preset
        this.emitterInternals = (this.params.emitters || []).map(emitter => ({
            id: emitter.id, // Make sure emitters in presets have unique IDs
            accumulator: 0,
            particleColor: new THREE.Color(emitter.color || this.params.particleBaseColor)
        }));


        if (this.gui) {
            // Rebuild GUI entirely for simplicity with dynamic elements like emitters/obstacles
            this.setupGUI();
        } else if (!isInitial) { // if not initial and no GUI, manually update controllers
             // This case is unlikely if GUI is always setup after first applyPreset
        }
        if (!isInitial) {
            // No need for another resetSimulation() here as it was called above for non-initial preset changes.
        }
    }

    updateBackgroundColor() { 
        if (this.renderer) this.renderer.setClearColor(this.params.bgColor, 1);
        document.body.style.backgroundColor = this.params.bgColor;
    }
    getSimulationCoords(clientX, clientY) { 
        if (!this.renderer || !this.camera) return { x: 0, y: 0 };
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        const vec = new THREE.Vector3(x, y, 0.5);
        vec.unproject(this.camera);
        return { x: vec.x, y: vec.y };
    }
    createInteractionRing() { 
        if (this.interactionRing) {
            if (this.interactionRing.geometry) this.interactionRing.geometry.dispose();
            if (this.interactionRing.material) this.interactionRing.material.dispose();
            this.scene.remove(this.interactionRing); this.interactionRing = null;
        }
        const ringGeometry = new THREE.RingGeometry(this.params.interactionRadius - 0.15, this.params.interactionRadius + 0.15, 48);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.3, depthWrite: false });
        this.interactionRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.interactionRing.visible = this.params.showInteractionRadius;
        this.interactionRing.position.z = 1;
        this.scene.add(this.interactionRing);
    }

    createObstacleMeshes() { 
        this.obstacleMeshes.forEach(mesh => {
            if(mesh.geometry) mesh.geometry.dispose(); if(mesh.material) mesh.material.dispose();
            this.scene.remove(mesh);
        });
        this.obstacleMeshes.length = 0;
        if (this.params.enableObstacles && this.params.obstacles && Array.isArray(this.params.obstacles)) {
            this.params.obstacles.forEach((obs) => {
                if (typeof obs?.x === 'number' && typeof obs?.y === 'number' && typeof obs?.radius === 'number' && obs.radius > 0) {
                    const geometry = new THREE.CircleGeometry(obs.radius, 32);
                    const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x666688, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
                    const mesh = new THREE.Mesh(geometry, meshMaterial);
                    mesh.position.set(obs.x, obs.y, -1);
                    this.scene.add(mesh); this.obstacleMeshes.push(mesh);
                } else { console.warn("Skipping invalid obstacle data:", obs); }
            });
        }
    }
    updateObstacleMesh(index) { // For GUI updates
        if (this.obstacleMeshes[index] && this.params.obstacles[index]) {
            const obs = this.params.obstacles[index];
            const mesh = this.obstacleMeshes[index];
            mesh.position.set(obs.x, obs.y, -1);
            // To update radius, need to recreate geometry
            if (mesh.geometry.parameters.radius !== obs.radius) {
                mesh.geometry.dispose();
                mesh.geometry = new THREE.CircleGeometry(obs.radius, 32);
            }
        }
    }


    // --- Force Zone Visualization ---
    createForceZoneMeshes() {
        this.forceZoneMeshes.forEach(mesh => {
            if(mesh.geometry) mesh.geometry.dispose();
            if(mesh.material) mesh.material.dispose();
            this.scene.remove(mesh);
        });
        this.forceZoneMeshes.length = 0;

        if (this.params.forceZones && Array.isArray(this.params.forceZones)) {
            this.params.forceZones.forEach((fz) => {
                if (fz.enabled && typeof fz.x === 'number' && typeof fz.y === 'number' && typeof fz.radius === 'number' && fz.radius > 0) {
                    const geometry = new THREE.RingGeometry(fz.radius - 0.2, fz.radius, 48); // Thin ring
                    const material = new THREE.MeshBasicMaterial({ color: 0x88FF88, side: THREE.DoubleSide, transparent: true, opacity: 0.25, depthWrite: false });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(fz.x, fz.y, -0.5); // Slightly behind particles, in front of obstacles
                    this.scene.add(mesh);
                    this.forceZoneMeshes.push(mesh);
                }
            });
        }
    }
    updateForceZoneMesh(index) {
        if (this.forceZoneMeshes[index] && this.params.forceZones[index]) {
            const fz = this.params.forceZones[index];
            const mesh = this.forceZoneMeshes[index]; // This mapping might be fragile if zones are added/removed. Safer to find by ID.
                                                    // For now, assume indices match.
            if (fz.enabled) {
                mesh.visible = true;
                mesh.position.set(fz.x, fz.y, -0.5);
                if (mesh.geometry.parameters.innerRadius !== fz.radius - 0.2 || mesh.geometry.parameters.outerRadius !== fz.radius) {
                     mesh.geometry.dispose();
                     mesh.geometry = new THREE.RingGeometry(fz.radius - 0.2, fz.radius, 48);
                }
            } else {
                mesh.visible = false;
            }
        } else if (this.params.forceZones[index] && this.params.forceZones[index].enabled) {
            // Mesh might have been removed (e.g. if toggled off then GUI changes radius)
            // Recreate all meshes for simplicity if one is missing but should be visible.
            this.createForceZoneMeshes();
        }
    }


    setupSpatialGrid() { 
        this.gridCellSize = Math.max(this.params.particleRepulsionRadius, this.params.cohesionRadius, this.params.viscosityRadius || 0, 1.0);
        const worldSize = this.params.containerRadius * 2.2;
        this.gridWidth = Math.ceil(worldSize / this.gridCellSize);
        this.gridHeight = Math.ceil(worldSize / this.gridCellSize);
        this.gridOriginX = -worldSize / 2; this.gridOriginY = -worldSize / 2;
        this.grid = {};
    }
    getCellCoords(x, y) {  const cellX = Math.floor((x - this.gridOriginX) / this.gridCellSize); const cellY = Math.floor((y - this.gridOriginY) / this.gridCellSize); return { cellX, cellY }; }
    getCellKey(cellX, cellY) {  return `${cellX}_${cellY}`; }
    updateGrid() { 
        this.grid = {};
        if (!this.geometry?.attributes?.position) return;
        const posArray = this.geometry.attributes.position.array;
        const count = this.params.particlesCount; // Current number of active particles
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const { cellX, cellY } = this.getCellCoords(posArray[i3], posArray[i3 + 1]);
            const key = this.getCellKey(cellX, cellY);
            if (!this.grid[key]) this.grid[key] = [];
            this.grid[key].push(i);
        }
    }
    getNeighbors(particleIndex) { 
        const neighbors = []; if (!this.geometry?.attributes?.position) return neighbors;
        const posArray = this.geometry.attributes.position.array;
        const i3 = particleIndex * 3; const { cellX, cellY } = this.getCellCoords(posArray[i3], posArray[i3 + 1]);
        for (let dx = -1; dx <= 1; dx++) { for (let dy = -1; dy <= 1; dy++) {
            const key = this.getCellKey(cellX + dx, cellY + dy);
            if (this.grid[key]) { neighbors.push(...this.grid[key]); }
        }} return neighbors;
    }

    setupEventListeners() { 
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        if (this.renderer?.domElement) {
            this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
            this.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
            this.renderer.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        }
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('touchend', this.onTouchEndCancel.bind(this));
        window.addEventListener('touchcancel', this.onTouchEndCancel.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    // --- Event Handlers (Modified for Tools) ---
    onMouseMove(event) {
        const coords = this.getSimulationCoords(event.clientX, event.clientY);
        this.mouseX = coords.x; this.mouseY = coords.y;
        if (this.interactionRing) this.interactionRing.position.set(this.mouseX, this.mouseY, this.interactionRing.position.z);

        if (this.params.mouseTool === 'moveObstacle' && this.draggedObstacleIndex !== -1) {
            const obs = this.params.obstacles[this.draggedObstacleIndex];
            if (obs) {
                obs.x = this.mouseX - this.draggedObstacleOffsetX;
                obs.y = this.mouseY - this.draggedObstacleOffsetY;
                this.updateObstacleMesh(this.draggedObstacleIndex); // Update visual
            }
        }
    }

    onMouseDown(event) {
        if (!this.renderer || event.target !== this.renderer.domElement) return;
        const coords = this.getSimulationCoords(event.clientX, event.clientY); // Get current coords for tool use
        this.mouseX = coords.x; this.mouseY = coords.y;


        if (this.params.mouseTool === 'default') {
            if (event.button === 0) { // Left
                if (event.shiftKey) { this.isVortexing = true; }
                else if (event.ctrlKey || event.metaKey) { this.isStirring = true; }
                else { this.isAttracting = true; }
            } else if (event.button === 1) { this.isVortexing = true; event.preventDefault(); }
            else if (event.button === 2) { this.isRepelling = true; }
        } else if (this.params.mouseTool === 'moveObstacle') {
            if (event.button === 0 && this.params.enableObstacles) { // Left click to drag
                let closestObstacleIndex = -1;
                let minDistSq = Infinity;
                this.params.obstacles.forEach((obs, index) => {
                    const dx = this.mouseX - obs.x;
                    const dy = this.mouseY - obs.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < obs.radius * obs.radius && distSq < minDistSq) { // Click inside obstacle
                        minDistSq = distSq;
                        closestObstacleIndex = index;
                    }
                });
                if (closestObstacleIndex !== -1) {
                    this.draggedObstacleIndex = closestObstacleIndex;
                    const obs = this.params.obstacles[this.draggedObstacleIndex];
                    this.draggedObstacleOffsetX = this.mouseX - obs.x;
                    this.draggedObstacleOffsetY = this.mouseY - obs.y;
                }
            }
        }
    }

    onMouseUp() {
        this.isAttracting = false; this.isRepelling = false; this.isVortexing = false; this.isStirring = false;
        this.draggedObstacleIndex = -1; // Stop dragging any obstacle
    }

    onKeyDown(event) { 
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        switch (event.key.toUpperCase()) {
            case 'G': this.params.gravityEnabled = !this.params.gravityEnabled; break;
            case 'P': this.params.paused = !this.params.paused; break;
            case 'R': this.resetSimulation(); break;
        }
        if (this.gui) { this.gui.controllersRecursive().forEach(c => { if (c.property === 'paused' || c.property === 'gravityEnabled') c.updateDisplay(); }); }
    }

    onTouchStart(event) { // Simplified touch: only default attract or move obstacle (if selected)
        if (event.touches.length > 0) {
            const touch = event.touches[0]; this.touchIdentifier = touch.identifier;
            const coords = this.getSimulationCoords(touch.clientX, touch.clientY);
            this.mouseX = coords.x; this.mouseY = coords.y;
            if(this.interactionRing) this.interactionRing.position.set(this.mouseX, this.mouseY, this.interactionRing.position.z);

            if (this.params.mouseTool === 'default') {
                this.isAttracting = true;
            } else if (this.params.mouseTool === 'moveObstacle' && this.params.enableObstacles) {
                // Similar logic to onMouseDown for moveObstacle
                let closestObstacleIndex = -1;
                let minDistSq = Infinity;
                this.params.obstacles.forEach((obs, index) => {
                    const dx = this.mouseX - obs.x;
                    const dy = this.mouseY - obs.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < obs.radius * obs.radius && distSq < minDistSq) {
                        minDistSq = distSq;
                        closestObstacleIndex = index;
                    }
                });
                if (closestObstacleIndex !== -1) {
                    this.draggedObstacleIndex = closestObstacleIndex;
                    const obs = this.params.obstacles[this.draggedObstacleIndex];
                    this.draggedObstacleOffsetX = this.mouseX - obs.x;
                    this.draggedObstacleOffsetY = this.mouseY - obs.y;
                }
            }
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

                     if (this.params.mouseTool === 'moveObstacle' && this.draggedObstacleIndex !== -1) {
                         const obs = this.params.obstacles[this.draggedObstacleIndex];
                         if (obs) {
                             obs.x = this.mouseX - this.draggedObstacleOffsetX;
                             obs.y = this.mouseY - this.draggedObstacleOffsetY;
                             this.updateObstacleMesh(this.draggedObstacleIndex);
                         }
                     }
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
                     this.draggedObstacleIndex = -1; // Stop dragging
                     this.touchIdentifier = null; break;
                 }
             }
         }
    }
    onWindowResize() { 
        if (!this.camera || !this.renderer) return;
        const newAspect = window.innerWidth / window.innerHeight;
        this.camera.left = FRUSTUM_SIZE * newAspect / -2; this.camera.right = FRUSTUM_SIZE * newAspect / 2;
        this.camera.top = FRUSTUM_SIZE / 2; this.camera.bottom = FRUSTUM_SIZE / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
        this.updateGifCaptureFrame();
    }

    createBoat() {
        // Clean up previous boat meshes if they exist
        if (this.boatStickMesh) {
            this.boatStickMesh.geometry.dispose();
            this.boatStickMesh.material.dispose();
            this.scene.remove(this.boatStickMesh);
            this.boatStickMesh = null;
        }
        if (this.boatNodeMesh) {
            this.boatNodeMesh.geometry.dispose();
            this.boatNodeMesh.material.dispose();
            this.scene.remove(this.boatNodeMesh);
            this.boatNodeMesh = null;
        }

        this.boat.nodes = [];
        this.boat.sticks = [];

        if (!this.boat.enabled) {
            return; // Don't create if not enabled
        }

        // Define the boat shape (a simple hull)
        const boatShape = [
            { x: 0, y: 15 },   // 0: Tip
            { x: -7, y: 0 },   // 1: Left corner
            { x: 7, y: 0 },    // 2: Right corner
            { x: -6, y: -12 }, // 3: Left rear
            { x: 6, y: -12 },  // 4: Right rear
        ];

        // Create nodes from the shape definition
        boatShape.forEach(p => {
            this.boat.nodes.push({
                x: p.x, y: p.y, z: 0,
                old_x: p.x, old_y: p.y, // For Verlet integration
            });
        });

        // Helper to add a stick between two node indices
        const addStick = (p1, p2) => {
            const node1 = this.boat.nodes[p1];
            const node2 = this.boat.nodes[p2];
            const dx = node2.x - node1.x;
            const dy = node2.y - node1.y;
            this.boat.sticks.push({
                p1: p1,
                p2: p2,
                length: Math.sqrt(dx * dx + dy * dy)
            });
        };

        // Create sticks to form the rigid structure
        addStick(0, 1); addStick(0, 2); // Front V
        addStick(1, 2); // Cross-beam
        addStick(1, 3); addStick(2, 4); // Sides
        addStick(3, 4); // Rear
        addStick(0, 3); addStick(0, 4); // Extra rigidity from tip to rear
        addStick(1, 4); addStick(2, 3); // X-brace for stability

        // --- Setup Three.js objects for rendering the boat ---
        // Nodes (vertices)
        const nodeGeometry = new THREE.BufferGeometry();
        const nodePositions = new Float32Array(this.boat.nodes.length * 3);
        nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3).setUsage(THREE.DynamicDrawUsage));
        const nodeMaterial = new THREE.PointsMaterial({ color: 0xffaa00, size: 6.0, depthWrite: false, transparent: true });
        this.boatNodeMesh = new THREE.Points(nodeGeometry, nodeMaterial);
        this.boatNodeMesh.position.z = 0.5; // Render in front of particles
        this.scene.add(this.boatNodeMesh);

        // Sticks (lines)
        const stickGeometry = new THREE.BufferGeometry();
        const stickPositions = new Float32Array(this.boat.sticks.length * 2 * 3); // 2 points per stick
        stickGeometry.setAttribute('position', new THREE.BufferAttribute(stickPositions, 3).setUsage(THREE.DynamicDrawUsage));
        const stickMaterial = new THREE.LineBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
        this.boatStickMesh = new THREE.LineSegments(stickGeometry, stickMaterial);
        this.boatStickMesh.position.z = 0.5; // Render in front of particles
        this.scene.add(this.boatStickMesh);
    }

    updateBoat() {
        if (!this.boat.enabled || this.boat.nodes.length === 0) return;

        const gravity = this.params.gravityEnabled ? this.params.gravityStrength : 0;

        // 1. Verlet integration: Update positions based on previous positions
        for (const node of this.boat.nodes) {
            const vx = (node.x - node.old_x) * this.boat.damping;
            const vy = (node.y - node.old_y) * this.boat.damping;

            node.old_x = node.x;
            node.old_y = node.y;

            node.x += vx;
            node.y += vy - gravity;
        }

        // 2. Solve constraints (multiple iterations for stability)
        const iterations = 8;
        for (let i = 0; i < iterations; i++) {
            // Solve stick constraints
            for (const stick of this.boat.sticks) {
                const n1 = this.boat.nodes[stick.p1];
                const n2 = this.boat.nodes[stick.p2];
                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) continue;
                const diff = stick.length - dist;
                const percent = diff / dist / 2; // Each node moves half the way
                const offsetX = dx * percent;
                const offsetY = dy * percent;

                n1.x -= offsetX; n1.y -= offsetY;
                n2.x += offsetX; n2.y += offsetY;
            }

            // Boundary constraints
            for (const node of this.boat.nodes) {
                const distSq = node.x * node.x + node.y * node.y;
                if (distSq > this.params.containerRadius * this.params.containerRadius) {
                    const dist = Math.sqrt(distSq);
                    const factor = this.params.containerRadius / dist;
                    node.x *= factor;
                    node.y *= factor;
                }
            }
        }
    }

    updateBoatMesh() {
        if (!this.boat.enabled || !this.boatNodeMesh || !this.boatStickMesh) return;

        // Update node positions
        const nodePositions = this.boatNodeMesh.geometry.attributes.position.array;
        this.boat.nodes.forEach((node, i) => {
            nodePositions[i * 3] = node.x;
            nodePositions[i * 3 + 1] = node.y;
            nodePositions[i * 3 + 2] = 0;
        });
        this.boatNodeMesh.geometry.attributes.position.needsUpdate = true;

        // Update stick positions
        const stickPositions = this.boatStickMesh.geometry.attributes.position.array;
        this.boat.sticks.forEach((stick, i) => {
            const n1 = this.boat.nodes[stick.p1];
            const n2 = this.boat.nodes[stick.p2];
            const i6 = i * 6;
            stickPositions[i6] = n1.x;
            stickPositions[i6 + 1] = n1.y;
            stickPositions[i6 + 2] = 0;
            stickPositions[i6 + 3] = n2.x;
            stickPositions[i6 + 4] = n2.y;
            stickPositions[i6 + 5] = 0;
        });
        this.boatStickMesh.geometry.attributes.position.needsUpdate = true;
    }


    // --- Main Update and Animation Loop ---
    update(deltaTime) { // deltaTime is passed but physics is per-frame for now
        if (this.params.paused || !this.particleSystem || !this.geometry?.attributes?.position || !this.velocities || !this.geometry?.attributes?.color) {
             return;
        }

        this.updateBoat();

        // --- 1. Process Emitters ---
        (this.params.emitters || []).forEach(emitter => {
            const internal = this.emitterInternals.find(ei => ei.id === emitter.id);
            if (!emitter.enabled || !internal) return;

            // Emit whole particles per frame based on rate
            let particlesToEmit = Math.floor(emitter.rate);
            internal.accumulator += emitter.rate - particlesToEmit; // Store fractional part
            if (internal.accumulator >= 1.0) {
                particlesToEmit += Math.floor(internal.accumulator);
                internal.accumulator -= Math.floor(internal.accumulator);
            }


            for (let k = 0; k < particlesToEmit; k++) {
                if (this.params.particlesCount >= MAX_PARTICLES) break; // Buffer full

                const i = this.params.particlesCount; // Index of the new particle
                const i3 = i * 3;

                this.positions[i3] = emitter.x;
                this.positions[i3+1] = emitter.y;
                this.positions[i3+2] = 0;

                this.velocities[i3] = emitter.initialVelocity.x + (Math.random() - 0.5) * 2 * emitter.velocityVariance.x;
                this.velocities[i3+1] = emitter.initialVelocity.y + (Math.random() - 0.5) * 2 * emitter.velocityVariance.y;
                this.velocities[i3+2] = 0;
                this.isEmitter[i] = 1;
                this.baseColors[i3] = internal.particleColor.r;
                this.baseColors[i3+1] = internal.particleColor.g;
                this.baseColors[i3+2] = internal.particleColor.b;

                if (this.params.useVerticalGradient) {
                    this.tempColor.copy(internal.particleColor);
                    const hsl = { h: 0, s: 0, l: 0 };
                    this.tempColor.getHSL(hsl);
                    hsl.h = (hsl.h + ((emitter.y + this.params.containerRadius) / (2 * this.params.containerRadius)) * this.params.gradientHueScale) % 1.0;
                    this.tempColor.setHSL(hsl.h, hsl.s, hsl.l);
                    this.colors[i3] = this.tempColor.r; this.colors[i3+1] = this.tempColor.g; this.colors[i3+2] = this.tempColor.b;
                } else {
                    this.colors[i3]   = internal.particleColor.r;
                    this.colors[i3+1] = internal.particleColor.g;
                    this.colors[i3+2] = internal.particleColor.b;
                }

                // Also store as initial position if needed for reset behavior, though emitters override
                this.initialPositions[i3] = emitter.x;
                this.initialPositions[i3+1] = emitter.y;
                this.initialPositions[i3+2] = 0;

                this.params.particlesCount++;
            }
        });
        if (this.params.emitters && this.params.emitters.some(e => e.enabled && e.rate > 0)) {
            this.geometry.setDrawRange(0, this.params.particlesCount); // Update draw range if particles were added
            // Mark relevant part of buffer as needing update (though full update is often fine)
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
        }


        // --- 2. Update Spatial Grid ---
        this.updateGrid(); // Uses this.params.particlesCount

        // Get direct references and current active count
        const posArray = this.geometry.attributes.position.array;
        const velArray = this.velocities;
        const colArray = this.geometry.attributes.color.array;
        const currentActiveParticles = this.params.particlesCount; // Use the dynamic count

        // Pre-calculate constants
        const { interactionRadius: mouseInteractionRadius, particleRepulsionRadius, cohesionRadius, maxVelocity, damping, edgeDamping, containerRadius, gravityStrength, attractionStrength, repellingStrength, vortexStrength, stirStrength, viscosityStrength, viscosityRadius } = this.params;
        const mouseInteractionRadiusSq = mouseInteractionRadius * mouseInteractionRadius;
        const particleRepulsionRadiusSq = particleRepulsionRadius * particleRepulsionRadius;
        const cohesionRadiusSq = cohesionRadius * cohesionRadius;
        const viscosityRadiusSq = viscosityRadius * viscosityRadius;
        const maxVelSq = maxVelocity * maxVelocity;
        const containerRadiusSq = containerRadius * containerRadius;
        const gravity = this.params.gravityEnabled ? gravityStrength : 0;
        const obstacles = (this.params.enableObstacles && this.obstacleMeshes.length > 0) ? this.params.obstacles : [];
        const activeForceZones = (this.params.forceZones || []).filter(fz => fz.enabled);

        let baseHSL = { h: 0, s: 1, l: 0.5 };
        this.baseColor.getHSL(baseHSL); // Ensure baseColor is current
        const velColorScale = this.params.particleVelocityColorScale * 0.1;

        const halfWidth = (this.camera.right - this.camera.left) / 2;
        const halfHeight = (this.camera.top - this.camera.bottom) / 2;


        // --- 3. Particle Update Loop (Iterate only over active particles) ---
        for (let i = 0; i < currentActiveParticles; i++) {
            const i3 = i * 3;
            const px = posArray[i3]; const py = posArray[i3 + 1];
            let vx = velArray[i3]; let vy = velArray[i3 + 1];

            // --- Apply Forces ---
            // Gravity
            vy -= gravity;

            // Force Zones
            activeForceZones.forEach(fz => {
                const dxZone = px - fz.x;
                const dyZone = py - fz.y;
                if (dxZone * dxZone + dyZone * dyZone < fz.radius * fz.radius) {
                    vx += fz.force.x;
                    vy += fz.force.y;
                }
            });

            // Mouse Interaction (only if default tool is active)
            if (this.params.mouseTool === 'default') {
                const dxMouse = this.mouseX - px; const dyMouse = this.mouseY - py;
                const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;
                if (distMouseSq > 0.0001 && distMouseSq < mouseInteractionRadiusSq) {
                    const distMouse = Math.sqrt(distMouseSq); const invDist = 1.0 / distMouse;
                    const normX = dxMouse * invDist; const normY = dyMouse * invDist;
                    if (this.isAttracting) { vx += normX * attractionStrength; vy += normY * attractionStrength; }
                    if (this.isRepelling) { vx -= normX * repellingStrength; vy -= normY * repellingStrength; }
                    if (this.isVortexing) { vx += -normY * vortexStrength; vy += normX * vortexStrength; }
                    if (this.isStirring) { const stirFactor = stirStrength * Math.max(0, (1.0 - distMouse / mouseInteractionRadius)); vx += -normY * stirFactor; vy += normX * stirFactor; }
                }
            }

            // Particle-Particle Interaction (Using Spatial Grid)
            if (this.params.repulsionStrength > 0 || this.params.cohesionStrength > 0 || viscosityStrength > 0) {
                const neighbors = this.getNeighbors(i);
                let avgVx = 0, avgVy = 0, neighborCount = 0;
                for (const j of neighbors) {
                    if (i === j) continue;
                    const j3 = j * 3; const dx = posArray[j3] - px; const dy = posArray[j3 + 1] - py;
                    const distSq = dx * dx + dy * dy;
                    if (this.params.repulsionStrength > 0 && distSq < particleRepulsionRadiusSq && distSq > 0.0001) {
                        const distance = Math.sqrt(distSq); const invDist = 1.0 / distance;
                        const forceMagnitude = (1.0 - distance / particleRepulsionRadius) * this.params.repulsionStrength * invDist;
                        vx -= dx * forceMagnitude; vy -= dy * forceMagnitude;
                    } else if (this.params.cohesionStrength > 0 && distSq < cohesionRadiusSq && distSq > particleRepulsionRadiusSq) {
                        const distance = Math.sqrt(distSq);
                        const forceMagnitude = this.params.cohesionStrength * (1.0 - distance / cohesionRadius);
                        const invDist = 1.0 / (distance + 0.001);
                        vx += dx * forceMagnitude * invDist; vy += dy * forceMagnitude * invDist;
                    }
                    if (viscosityStrength > 0 && distSq < viscosityRadiusSq) {
                        avgVx += velArray[j3];
                        avgVy += velArray[j3 + 1];
                        neighborCount++;
                    }
                }
                if (viscosityStrength > 0 && neighborCount > 0) {
                    avgVx /= neighborCount; avgVy /= neighborCount;
                    vx += (avgVx - vx) * viscosityStrength;
                    vy += (avgVy - vy) * viscosityStrength;
                }
            }

            // Velocity Limiting & Damping
            const velMagSq = vx * vx + vy * vy;
            if (velMagSq > maxVelSq) { const scale = maxVelocity / Math.sqrt(velMagSq); vx *= scale; vy *= scale; }
            vx *= damping; vy *= damping;

            // Update Position
            let nextX = px + vx; let nextY = py + vy;

            // Collision Detection & Response
            if (this.boat.enabled) {
                const boatInteractionRadiusSq = this.boat.interactionRadius * this.boat.interactionRadius;
                for (const boatNode of this.boat.nodes) {
                    const dxBoat = nextX - boatNode.x;
                    const dyBoat = nextY - boatNode.y;
                    const distBoatSq = dxBoat * dxBoat + dyBoat * dyBoat;

                    if (distBoatSq < boatInteractionRadiusSq && distBoatSq > 0.0001) {
                        const distBoat = Math.sqrt(distBoatSq);
                        const normX = dxBoat / distBoat;
                        const normY = dyBoat / distBoat;

                        const dot = vx * normX + vy * normY;
                        if (dot < 0) { // Only if particle is moving towards the boat node
                            // Reflect the particle's velocity
                            const collisionDamping = 0.1; // How much energy is lost in the collision
                            vx -= (1 + collisionDamping) * dot * normX;
                            vy -= (1 + collisionDamping) * dot * normY;

                            // Apply an impulse to the boat node based on the fluid particle's velocity
                            const impulse = -dot * this.boat.impulseFactor;
                            boatNode.x -= normX * impulse;
                            boatNode.y -= normY * impulse;
                        }
                    }
                }
            }

            // Boundary Handling
            if (this.params.wrapAroundEdges) {
                if (this.params.wrapScreenEdges) {
                    if (nextX < -halfWidth) nextX += 2 * halfWidth;
                    else if (nextX > halfWidth) nextX -= 2 * halfWidth;
                    if (nextY < -halfHeight) nextY += 2 * halfHeight;
                    else if (nextY > halfHeight) nextY -= 2 * halfHeight;
                } else {
                    if (nextX < -containerRadius) nextX += 2 * containerRadius;
                    else if (nextX > containerRadius) nextX -= 2 * containerRadius;
                    if (nextY < -containerRadius) nextY += 2 * containerRadius;
                    else if (nextY > containerRadius) nextY -= 2 * containerRadius;
                }
            } else {
                const distFromCenterSq = nextX * nextX + nextY * nextY;
                if (distFromCenterSq > containerRadiusSq) {
                    const distFromCenter = Math.sqrt(distFromCenterSq);
                    const normX = nextX / distFromCenter;
                    const normY = nextY / distFromCenter;
                    const dot = vx * normX + vy * normY;
                    vx -= (1 + edgeDamping) * dot * normX;
                    vy -= (1 + edgeDamping) * dot * normY;
                    nextX = normX * containerRadius;
                    nextY = normY * containerRadius;
                }
            }
            // Obstacle Collision
            for (const obs of obstacles) { // obstacles array from params
                const dxObs = nextX - obs.x; const dyObs = nextY - obs.y;
                const distObsSq = dxObs * dxObs + dyObs * dyObs; const obsRadiusSq = obs.radius * obs.radius;
                if (distObsSq < obsRadiusSq && distObsSq > 0.0001) {
                    const distObs = Math.sqrt(distObsSq); const normX = dxObs / distObs; const normY = dyObs / distObs;
                    const dot = vx * normX + vy * normY;
                    if (dot < 0) { vx -= (1 + edgeDamping) * dot * normX; vy -= (1 + edgeDamping) * dot * normY; }
                    nextX = obs.x + normX * (obs.radius + 0.01); nextY = obs.y + normY * (obs.radius + 0.01);
                }
            }

            // Finalize Position & Velocity
            posArray[i3] = nextX; posArray[i3 + 1] = nextY;
            velArray[i3] = vx; velArray[i3 + 1] = vy;

            // Update Color Based on Velocity
            const speed = Math.sqrt(vx * vx + vy * vy);
            const baseR = this.baseColors[i3];
            const baseG = this.baseColors[i3 + 1];
            const baseB = this.baseColors[i3 + 2];
            this.tempColor.setRGB(baseR, baseG, baseB);
            let particleBaseHSL = { h: 0, s: 0, l: 0 };
            this.tempColor.getHSL(particleBaseHSL);

            const hueShift = Math.min(speed * velColorScale, 0.7);
            let gradientHue = 0;
            if (this.params.useVerticalGradient) {
                gradientHue = ((nextY + containerRadius) / (2 * containerRadius)) * this.params.gradientHueScale;
            }
            const finalHue = (particleBaseHSL.h + hueShift + gradientHue) % 1.0;
            const finalSaturation = Math.min(1.0, particleBaseHSL.s * 1.05 + 0.05);
            const finalLightness = Math.min(0.9, particleBaseHSL.l * 1.0 + 0.1);
            this.tempColor.setHSL(finalHue, finalSaturation, finalLightness);
            colArray[i3] = this.tempColor.r; colArray[i3 + 1] = this.tempColor.g; colArray[i3 + 2] = this.tempColor.b;
        } // End Particle Loop

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const currentTime = performance.now();
        const deltaTime = Math.min(0.05, (currentTime - this.lastTime) / 1000);
        this.lastTime = currentTime;
        this.fpsUpdateTimer += deltaTime; this.frameCount++;
        if (this.fpsUpdateTimer >= 1.0) {
            const fps = this.frameCount; this.frameCount = 0; this.fpsUpdateTimer -= 1.0;
            if (this.fpsCounter) { this.fpsCounter.textContent = `FPS: ${fps} | Particles: ${this.params.particlesCount}/${MAX_PARTICLES}`; }
        }
        this.update(deltaTime);

        this.updateBoatMesh();

        if (this.composer && this.bloomPass?.enabled) { this.composer.render(deltaTime); }
        else if (this.renderer && this.scene && this.camera) { this.renderer.render(this.scene, this.camera); }

        this.updateGifCaptureFrame();
        this.captureGifFrame(currentTime);
    }

    dispose() {
        if (this.gui) this.gui.destroy();

        this.obstacleMeshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            if (this.scene) this.scene.remove(mesh);
        });
        this.obstacleMeshes.length = 0;

        this.forceZoneMeshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            if (this.scene) this.scene.remove(mesh);
        });
        this.forceZoneMeshes.length = 0;

        if (this.boatStickMesh) {
            this.boatStickMesh.geometry.dispose();
            this.boatStickMesh.material.dispose();
            if (this.scene) this.scene.remove(this.boatStickMesh);
        }
        if (this.boatNodeMesh) {
            this.boatNodeMesh.geometry.dispose();
            this.boatNodeMesh.material.dispose();
            if (this.scene) this.scene.remove(this.boatNodeMesh);
        }

        if (this.interactionRing) {
            if (this.interactionRing.geometry) this.interactionRing.geometry.dispose();
            if (this.interactionRing.material) this.interactionRing.material.dispose();
            if (this.scene) this.scene.remove(this.interactionRing);
        }

        if (this.particleSystem && this.scene) this.scene.remove(this.particleSystem);
        if (this.material) this.material.dispose();
        if (this.geometry) this.geometry.dispose();
        if (this.renderer) this.renderer.dispose();
    }
}


// --- Script Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
        const simulation = new FluidSimulation(document.body);
        try {
            simulation.init();
            window.fluidSim = simulation; // For debugging
        } catch (error) {
            console.error("Error initializing simulation:", error);
            const errorDiv = document.createElement('div'); 
            errorDiv.style.position = 'absolute'; errorDiv.style.top = '10px'; errorDiv.style.left = '10px';
            errorDiv.style.padding = '10px'; errorDiv.style.backgroundColor = 'rgba(255,0,0,0.8)';
            errorDiv.style.color = 'white'; errorDiv.style.zIndex = '2000'; // Ensure above GUI
            errorDiv.innerText = `Initialization Error: ${error.message}\n(Check console for details)`;
            document.body.appendChild(errorDiv);
        }
    } else { console.error("DOM body not found!"); }
});
})();
