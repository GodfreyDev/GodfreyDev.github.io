// Import the lil-gui library as an ES module
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17/dist/lil-gui.esm.min.js';

console.log("--- Fluid Simulation Script START ---");

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- DOMContentLoaded Fired ---");

    // --- Constants ---
    const FRUSTUM_SIZE = 110; // Define camera view size

    // --- State Variables ---
    let mouseX = 0;
    let mouseY = 0;
    let isAttracting = false;
    let isRepelling = false;
    let isVortexing = false;
    let isStirring = false;
    let interactionRing = null; // Reference to the mouse interaction visualizer
    const obstacleMeshes = []; // Array to hold obstacle visual meshes
    let tempColor = new THREE.Color(); // Reusable color object for performance
    let baseColor = new THREE.Color(); // Holds the current base particle color
    let touchIdentifier = null; // For tracking the active touch

    // --- Simulation Parameters (Configurable via GUI) ---
    const params = {
        particlesCount: 3000,
        damping: 0.95,          // How quickly particles lose velocity
        edgeDamping: 0.75,       // How much velocity is lost on boundary collision (1 = full stop, >1 = bounce)
        maxVelocity: 1.5,        // Maximum speed a particle can reach
        containerRadius: 50,     // Radius of the circular boundary
        gravityStrength: 0.03,   // Downward force applied when enabled
        gravityEnabled: false,
        paused: false,           // Simulation pause state
        interactionRadius: 8.0,  // Radius for mouse interaction and particle repulsion
        repulsionStrength: 0.08, // Force pushing particles away from each other
        cohesionStrength: 0.005, // Force pulling particles together (within cohesionRadius)
        cohesionRadius: 4.0,     // Radius within which cohesion applies (should be > interactionRadius ideally)
        attractionStrength: 0.05,// Force pulling particles towards the mouse
        repellingStrength: 0.1, // Force pushing particles away from the mouse
        vortexStrength: 0.08,    // Rotational force around the mouse
        stirStrength: 0.05,      // Tangential force around the mouse (less structured than vortex)
        particleBaseColor: '#00ffff', // Starting color of particles
        particleVelocityColorScale: 2.0, // How much speed affects color shift
        particleSize: 0.5,       // Visual size of particles
        showInteractionRadius: true, // Whether to display the mouse interaction ring
        bgColorTop: '#111133',   // Background gradient top color
        bgColorBottom: '#331111', // Background gradient bottom color
        obstacles: [             // Define static obstacles
            { x: -20, y: 15, radius: 8 },
            { x: 25, y: -10, radius: 12 },
            { x: 0, y: -30, radius: 5 }
        ],
        enableObstacles: true,   // Whether obstacles affect particles
    };
    baseColor.set(params.particleBaseColor); // Initialize baseColor

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(
        FRUSTUM_SIZE * aspect / -2, FRUSTUM_SIZE * aspect / 2,
        FRUSTUM_SIZE / 2, FRUSTUM_SIZE / -2,
        1, 1000
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background for CSS gradient
    document.body.appendChild(renderer.domElement);

    // --- Particle Data Buffers ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particlesCount * 3);
    const velocities = new Float32Array(params.particlesCount * 3); // Store velocity separately
    const colors = new Float32Array(params.particlesCount * 3);
    const initialPositions = new Float32Array(params.particlesCount * 3); // Store initial positions for reset

    // --- Particle Material ---
    const material = new THREE.PointsMaterial({
        size: params.particleSize,
        vertexColors: true,        // Enable color attribute usage
        sizeAttenuation: true,     // Particles shrink with distance (though less relevant in ortho)
        blending: THREE.AdditiveBlending, // Brighten where particles overlap
        depthWrite: false          // Avoid depth buffer issues with blending
    });
    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // --- Helper Functions ---

    /** Updates the body background gradient based on params */
    function updateBackground() {
        document.body.style.background = `linear-gradient(to bottom, ${params.bgColorTop}, ${params.bgColorBottom})`;
    }

    /** Converts screen coordinates (clientX, clientY) to simulation world coordinates */
    function getSimulationCoords(clientX, clientY) {
        const rect = renderer.domElement.getBoundingClientRect();
        // Normalize mouse coordinates to [-1, 1] range
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        // Unproject normalized device coordinates (NDC) to world space
        const vec = new THREE.Vector3(x, y, 0.5); // z=0.5 is on the near plane for ortho
        vec.unproject(camera);
        return { x: vec.x, y: vec.y };
    }

    /** Creates or updates the visual ring indicating mouse interaction radius */
    function createInteractionRing() {
        if (interactionRing) scene.remove(interactionRing); // Clean up old ring
        const ringGeometry = new THREE.RingGeometry(params.interactionRadius - 0.1, params.interactionRadius + 0.1, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        interactionRing = new THREE.Mesh(ringGeometry, ringMaterial);
        interactionRing.visible = params.showInteractionRadius;
        interactionRing.position.z = 1; // Ensure it's slightly in front of particles
        scene.add(interactionRing);
    }

    /** Creates or removes visual representations of obstacles */
    function createObstacleMeshes() {
        // Remove existing meshes
        obstacleMeshes.forEach(mesh => scene.remove(mesh));
        obstacleMeshes.length = 0; // Clear the array

        if (params.enableObstacles) {
            // console.log("Creating obstacle meshes..."); // Optional: Log creation
            params.obstacles.forEach((obs) => {
                const geometry = new THREE.CircleGeometry(obs.radius, 32);
                const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(geometry, meshMaterial);
                mesh.position.set(obs.x, obs.y, -1); // Slightly behind particles
                scene.add(mesh);
                obstacleMeshes.push(mesh);
            });
        }
    }

    /** Initializes particle positions, velocities, and colors */
    function initializeParticles() {
        console.log("Initializing particles...");
        tempColor = new THREE.Color(); // Ensure tempColor is fresh
        baseColor.set(params.particleBaseColor); // Ensure baseColor matches param

        for (let i = 0; i < params.particlesCount; i++) {
            const i3 = i * 3;
            // Distribute particles within a radius, avoiding the exact center initially
            const radius = Math.random() * params.containerRadius * 0.8 + params.containerRadius * 0.1;
            const angle = Math.random() * Math.PI * 2;

            // Position
            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = Math.sin(angle) * radius;
            positions[i3 + 2] = 0; // Z position is 0 for 2D simulation

            // Store initial position for reset
            initialPositions[i3] = positions[i3];
            initialPositions[i3 + 1] = positions[i3 + 1];
            initialPositions[i3 + 2] = positions[i3 + 2];

            // Initial velocity (small random push)
            velocities[i3] = (Math.random() - 0.5) * 0.1;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
            velocities[i3 + 2] = 0;

            // Initial color (base color)
            colors[i3] = baseColor.r;
            colors[i3 + 1] = baseColor.g;
            colors[i3 + 2] = baseColor.b;
        }

        // Set buffer attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Mark attributes for update
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        console.log("Particles Initialized.");
    }

    /** Resets the simulation to its initial state */
    function resetSimulation() {
        console.log("--- Resetting Simulation ---");
        // Restore initial positions
        positions.set(initialPositions);
        // Reset velocities
        velocities.fill(0);

        // Reset colors to base color
        baseColor.set(params.particleBaseColor); // Re-fetch in case it changed
        tempColor.set(baseColor); // Use the updated baseColor
        for (let i = 0; i < params.particlesCount; i++) {
            const i3 = i * 3;
            colors[i3] = tempColor.r;
            colors[i3 + 1] = tempColor.g;
            colors[i3 + 2] = tempColor.b;
        }

        // Mark buffers for update
        if (geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
        if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true;

        // Ensure simulation is unpaused and GUI reflects it
        params.paused = false;
        gui.controllersRecursive().forEach(controller => controller.updateDisplay());

        console.log("Simulation Reset Complete.");
    }

    // --- GUI Setup ---
    console.log("Setting up GUI...");
    const gui = new GUI();
    gui.title("Fluid Controls");

    const simFolder = gui.addFolder('Simulation Control');
    simFolder.add(params, 'paused').name('Pause (P)').listen().onChange(value => {
        console.log("Pause toggled via GUI:", value);
    });
    simFolder.add({ reset: resetSimulation }, 'reset').name('Reset (R)');
    simFolder.add(params, 'gravityEnabled').name('Enable Gravity (G)').listen().onChange(value => {
         console.log("Gravity toggled via GUI:", value);
    });
    simFolder.add(params, 'gravityStrength', 0.0, 0.1).name('Gravity Strength');
    simFolder.open();

    const interactionFolder = gui.addFolder('Interaction');
    interactionFolder.add(params, 'interactionRadius', 1, 20).name('Radius').onChange(createInteractionRing);
    interactionFolder.add(params, 'attractionStrength', 0.0, 0.2).name('Attraction Str.');
    interactionFolder.add(params, 'repellingStrength', 0.0, 0.3).name('Repulsion Str.');
    interactionFolder.add(params, 'vortexStrength', 0.0, 0.2).name('Vortex Str.');
    interactionFolder.add(params, 'stirStrength', 0.0, 0.2).name('Stir Str.');
    interactionFolder.open();

    const physicsFolder = gui.addFolder('Physics');
    physicsFolder.add(params, 'damping', 0.8, 1.0).name('Damping');
    physicsFolder.add(params, 'edgeDamping', 0.1, 1.0).name('Edge Damping');
    physicsFolder.add(params, 'maxVelocity', 0.1, 5.0).name('Max Velocity');
    physicsFolder.add(params, 'repulsionStrength', 0.0, 0.2).name('Particle Repulsion');
    physicsFolder.add(params, 'cohesionStrength', 0.0, 0.05).name('Cohesion Str.');
    physicsFolder.add(params, 'cohesionRadius', 1.0, 10.0).name('Cohesion Radius');
    physicsFolder.open();

    const vizFolder = gui.addFolder('Visualization');
    vizFolder.addColor(params, 'particleBaseColor').name('Base Color').onChange(value => {
        baseColor.set(value);
        // Force color recalculation on next frame even if paused by marking buffer
        if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
        console.log("Base color changed:", value);
    });
    vizFolder.add(params, 'particleVelocityColorScale', 0, 10).name('Velocity Color Scale');
    vizFolder.add(params, 'particleSize', 0.1, 3.0).name('Particle Size').onChange(value => {
        material.size = value;
    });
    vizFolder.add(params, 'showInteractionRadius').name('Show Interaction Radius').onChange(value => {
        if (interactionRing) interactionRing.visible = value;
    });
    vizFolder.addColor(params, 'bgColorTop').name('Background Top').onChange(updateBackground);
    vizFolder.addColor(params, 'bgColorBottom').name('Background Bottom').onChange(updateBackground);
    vizFolder.open();

    const obstacleFolder = gui.addFolder('Obstacles');
    obstacleFolder.add(params, 'enableObstacles').name('Enable Obstacles').onChange(createObstacleMeshes);
    obstacleFolder.open();

    console.log("GUI Setup Complete.");

    // --- Initial Setup Calls ---
    updateBackground();      // Set initial background gradient
    createInteractionRing(); // Create initial interaction ring visual
    createObstacleMeshes();  // Create initial obstacle visuals
    initializeParticles();   // Initialize particle data

    // --- Event Listeners ---
    console.log("Adding event listeners...");

    // Mouse Movement
    window.addEventListener('mousemove', (event) => {
        const coords = getSimulationCoords(event.clientX, event.clientY);
        mouseX = coords.x;
        mouseY = coords.y;
        if (interactionRing) {
           interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);
        }
    });

    // Mouse Button Down
    window.addEventListener('mousedown', (event) => {
        // Ignore clicks if not on the main canvas (e.g., on GUI)
        if (event.target !== renderer.domElement) return;

        if (event.button === 0) { // Left click
            if (event.shiftKey) { // Shift + Left Click = Vortex
                isVortexing = true; isAttracting = false; isRepelling = false; isStirring = false;
            } else if (event.ctrlKey || event.metaKey) { // Ctrl/Cmd + Left Click = Stir
                isStirring = true; isAttracting = false; isRepelling = false; isVortexing = false;
            } else { // Simple Left Click = Attract
                isAttracting = true; isRepelling = false; isVortexing = false; isStirring = false;
            }
        } else if (event.button === 1) { // Middle click = Vortex
             isVortexing = true; isAttracting = false; isRepelling = false; isStirring = false;
             event.preventDefault(); // Prevent default scroll/pan
        } else if (event.button === 2) { // Right click = Repel
            isRepelling = true; isAttracting = false; isVortexing = false; isStirring = false;
            // Prevent context menu handled by 'contextmenu' listener
        }
    });

    // Mouse Button Up
    window.addEventListener('mouseup', (event) => {
         // Reset all interaction flags regardless of which button was released
         isAttracting = false;
         isRepelling = false;
         isVortexing = false;
         isStirring = false;
    });

    // Prevent Context Menu on Canvas Right Click
    renderer.domElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    // Keyboard Input
    window.addEventListener('keydown', (event) => {
        // Ignore key events if user is typing into a GUI input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.key.toUpperCase()) {
            case 'G':
                params.gravityEnabled = !params.gravityEnabled;
                console.log("Gravity toggled via key:", params.gravityEnabled);
                // GUI updates via .listen()
                break;
            case 'P':
                params.paused = !params.paused;
                console.log("Pause toggled via key:", params.paused);
                // GUI updates via .listen()
                break;
            case 'R':
                resetSimulation();
                break;
        }
    });

    // Touch Input (Basic Single Touch = Attract)
    renderer.domElement.addEventListener('touchstart', (event) => {
        if (event.touches.length > 0) {
             const touch = event.touches[0];
             touchIdentifier = touch.identifier; // Store the ID of this touch
             const coords = getSimulationCoords(touch.clientX, touch.clientY);
             mouseX = coords.x;
             mouseY = coords.y;
             if(interactionRing) interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);

             isAttracting = true; // Default touch action
             isRepelling = false; isVortexing = false; isStirring = false;
             event.preventDefault(); // Prevent default scroll/zoom behavior
         }
    }, { passive: false }); // Need passive: false to call preventDefault

    renderer.domElement.addEventListener('touchmove', (event) => {
        if (touchIdentifier !== null) {
             // Find the touch that started the interaction
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 if (touch.identifier === touchIdentifier) {
                     const coords = getSimulationCoords(touch.clientX, touch.clientY);
                     mouseX = coords.x;
                     mouseY = coords.y;
                     if(interactionRing) interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);
                     event.preventDefault(); // Prevent scroll/zoom while dragging
                     break; // Found the correct touch
                 }
             }
         }
     }, { passive: false }); // Need passive: false to call preventDefault

    window.addEventListener('touchend', (event) => {
        if (touchIdentifier !== null) {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 if (touch.identifier === touchIdentifier) {
                     // Reset interaction flags when the tracked touch ends
                     isAttracting = false; isRepelling = false; isVortexing = false; isStirring = false;
                     touchIdentifier = null; // Stop tracking
                     break;
                 }
             }
         }
     });
     window.addEventListener('touchcancel', (event) => {
         if (touchIdentifier !== null) {
             // Also reset flags if the touch is cancelled (e.g., by system UI)
             isAttracting = false; isRepelling = false; isVortexing = false; isStirring = false;
             touchIdentifier = null;
         }
      });

    // Window Resize
    window.addEventListener('resize', () => {
        const newAspect = window.innerWidth / window.innerHeight;
        camera.left = FRUSTUM_SIZE * newAspect / -2;
        camera.right = FRUSTUM_SIZE * newAspect / 2;
        camera.top = FRUSTUM_SIZE / 2;
        camera.bottom = FRUSTUM_SIZE / -2;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    console.log("Event listeners added.");

    // --- FPS Counter ---
    const fpsCounter = document.getElementById('fpsCounter');
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 0;
    let fpsUpdateTimer = 0;

    // --- Animation Loop ---
    console.log("Starting animation loop...");
    function animate() {
        requestAnimationFrame(animate);

        const currentTime = performance.now();
        // Calculate delta time in seconds, capped to prevent large jumps if tab loses focus
        const deltaTime = Math.min(0.05, (currentTime - lastTime) / 1000);
        lastTime = currentTime;
        fpsUpdateTimer += deltaTime;

        // --- FPS Calculation ---
        frameCount++;
        if (fpsUpdateTimer >= 1.0) { // Update FPS counter approximately every second
            fps = frameCount;
            frameCount = 0;
            fpsUpdateTimer -= 1.0;
            if (fpsCounter) fpsCounter.textContent = `FPS: ${fps}`;
        }

        // --- Simulation Update Logic ---
        if (!params.paused) {
            const posArray = geometry.attributes.position.array;
            const velArray = velocities; // Direct reference, not a copy
            const colArray = geometry.attributes.color.array;
            const interactionRadiusSq = params.interactionRadius * params.interactionRadius;
            const cohesionRadiusSq = params.cohesionRadius * params.cohesionRadius;

            // Get base color HSL components ONCE per frame update,
            // as it might change via GUI but is constant for all particles in this frame.
            let baseHSL = { h: 0, s: 1, l: 0.5 };
            if (baseColor && typeof baseColor.getHSL === 'function') {
                baseColor.getHSL(baseHSL);
            } else {
                // Fallback / Warning if baseColor is invalid (shouldn't happen normally)
                console.warn("BaseColor is invalid in animation loop!");
                baseColor = new THREE.Color(params.particleBaseColor); // Attempt recovery
                baseColor.getHSL(baseHSL);
            }


            // --- Particle Update Loop ---
            for (let i = 0; i < params.particlesCount; i++) {
                const i3 = i * 3; // Index for X coordinate
                const px = posArray[i3];
                const py = posArray[i3 + 1];
                let vx = velArray[i3];
                let vy = velArray[i3 + 1];

                // 1. Apply Forces
                // --- Gravity ---
                if (params.gravityEnabled) {
                    vy -= params.gravityStrength; // Gravity acts downwards (negative Y)
                }

                // --- Mouse Interaction ---
                const dxMouse = mouseX - px;
                const dyMouse = mouseY - py;
                const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;

                // Check if particle is within potential interaction range (squared distance check is faster)
                // Use a slightly larger check radius to ensure smooth force application near edge.
                if (distMouseSq < interactionRadiusSq * 1.2) {
                     const distMouse = Math.sqrt(distMouseSq); // Calculate actual distance only if needed

                     if (distMouse > 0.01 && distMouse < params.interactionRadius) { // Avoid division by zero and check radius
                        const invDist = 1.0 / distMouse; // Precompute for normalization
                        const normX = dxMouse * invDist; // Normalized direction vector to mouse
                        const normY = dyMouse * invDist;

                        // Apply active mouse forces
                        if (isAttracting) {
                            vx += normX * params.attractionStrength;
                            vy += normY * params.attractionStrength;
                        }
                        if (isRepelling) {
                            vx -= normX * params.repellingStrength;
                            vy -= normY * params.repellingStrength;
                        }
                        if (isVortexing) { // Rotational force (perpendicular to direction)
                            vx += -normY * params.vortexStrength;
                            vy += normX * params.vortexStrength;
                        }
                        if (isStirring) { // Tangential force, decaying towards edge
                            const stirFactor = params.stirStrength * Math.max(0, (1.0 - distMouse / params.interactionRadius));
                            vx += -normY * stirFactor;
                            vy += normX * stirFactor;
                        }
                    }
                }

                // --- Particle-Particle Interaction (Repulsion & Cohesion) ---
                // This is O(N^2), the most expensive part. Consider spatial hashing for large N.
                 for (let j = i + 1; j < params.particlesCount; j++) { // Check against subsequent particles only
                    const j3 = j * 3;
                    const dx = posArray[j3] - px;
                    const dy = posArray[j3 + 1] - py;
                    const distSq = dx * dx + dy * dy;

                    // Repulsion: Strong force pushing particles apart at close range
                    if (params.repulsionStrength > 0 && distSq < interactionRadiusSq && distSq > 0.0001) {
                        const distance = Math.sqrt(distSq);
                        // Force increases sharply as distance decreases (inverse relationship)
                        // Normalize direction (dx/distance, dy/distance) and apply scaled force
                        const invDist = 1.0 / distance;
                        const forceMagnitude = (1.0 - distance / params.interactionRadius) * params.repulsionStrength * invDist;
                        const forceX = dx * forceMagnitude;
                        const forceY = dy * forceMagnitude;
                        vx -= forceX; // Apply force to particle i
                        vy -= forceY;
                        velArray[j3] += forceX; // Apply equal and opposite force to particle j
                        velArray[j3 + 1] += forceY;
                    }
                    // Cohesion: Gentle attraction towards particles within cohesion radius but outside repulsion radius
                    // Apply only if particles are further apart than roughly the interactionRadius but closer than cohesionRadius.
                    else if (params.cohesionStrength > 0 && distSq < cohesionRadiusSq && distSq > interactionRadiusSq * 0.8) {
                        const distance = Math.sqrt(distSq);
                         // Force attracts towards edge of cohesion radius, weakens further away
                        const forceMagnitude = params.cohesionStrength * (1 - cohesionRadiusSq / (distSq + 0.01)); // Avoid division by zero
                        const invDist = 1.0 / distance;
                        const forceX = dx * forceMagnitude * invDist;
                        const forceY = dy * forceMagnitude * invDist;

                        vx += forceX; // Apply force to particle i
                        vy += forceY;
                        velArray[j3] -= forceX; // Apply equal and opposite force to particle j
                        velArray[j3 + 1] -= forceY;
                    }
                }


                // 2. Apply Damping & Limit Velocity
                // --- Velocity Limiting ---
                const velMagSq = vx * vx + vy * vy;
                if (velMagSq > params.maxVelocity * params.maxVelocity) {
                    const scale = params.maxVelocity / Math.sqrt(velMagSq);
                    vx *= scale;
                    vy *= scale;
                }
                // --- Damping ---
                vx *= params.damping; // Slow down particle velocity over time
                vy *= params.damping;


                // 3. Update Position (Candidate)
                let nextX = px + vx; // Using velocity directly (deltaTime=1 assumed for simplicity here, adjust if needed)
                let nextY = py + vy;


                // 4. Boundary and Obstacle Collisions
                // --- Boundary Collision (Circular Container) ---
                const distFromCenterSq = nextX * nextX + nextY * nextY;
                if (distFromCenterSq > params.containerRadius * params.containerRadius) {
                    const distFromCenter = Math.sqrt(distFromCenterSq);
                    // Normal vector pointing outwards from center
                    const normX = nextX / distFromCenter;
                    const normY = nextY / distFromCenter;
                    // Velocity component towards the boundary normal
                    const dot = vx * normX + vy * normY;
                    // Reflect velocity away from boundary and apply edge damping
                    vx -= (1 + params.edgeDamping) * dot * normX;
                    vy -= (1 + params.edgeDamping) * dot * normY;
                    // Clamp position to the boundary edge
                    nextX = normX * params.containerRadius;
                    nextY = normY * params.containerRadius;
                }

                // --- Obstacle Collision ---
                if (params.enableObstacles) {
                    for (const obs of params.obstacles) {
                        const dxObs = nextX - obs.x;
                        const dyObs = nextY - obs.y;
                        const distObsSq = dxObs * dxObs + dyObs * dyObs;
                        // Check if candidate position is inside the obstacle
                        if (distObsSq < obs.radius * obs.radius && distObsSq > 0.0001) {
                            const distObs = Math.sqrt(distObsSq);
                            // Normal vector pointing outwards from obstacle center
                            const normX = dxObs / distObs;
                            const normY = dyObs / distObs;
                            // Velocity component towards the obstacle normal
                            const dot = vx * normX + vy * normY;
                            // Reflect velocity only if moving towards the obstacle center
                            if (dot < 0) {
                                vx -= (1 + params.edgeDamping) * dot * normX;
                                vy -= (1 + params.edgeDamping) * dot * normY;
                            }
                            // Push particle slightly outside the obstacle boundary to prevent sticking
                            nextX = obs.x + normX * (obs.radius + 0.01);
                            nextY = obs.y + normY * (obs.radius + 0.01);
                        }
                    }
                }


                // 5. Finalize Position & Velocity Update
                posArray[i3] = nextX;
                posArray[i3 + 1] = nextY;
                velArray[i3] = vx;
                velArray[i3 + 1] = vy;


                // 6. Update Color Based on Velocity
                const speed = Math.sqrt(vx * vx + vy * vy);
                // Calculate a hue shift based on speed, scaling factor determines sensitivity
                // Limit hue shift to prevent wrapping completely around too quickly (max shift 0.7)
                const hueShift = Math.min(speed * params.particleVelocityColorScale * 0.1, 0.7);

                // Apply hue shift to base HSL color. Clamp Saturation and Lightness for visibility.
                const finalHue = (baseHSL.h + hueShift) % 1.0; // Wrap hue [0, 1)
                const finalSaturation = Math.max(0.2, Math.min(1.0, baseHSL.s)); // Ensure minimum saturation
                const finalLightness = Math.max(0.3, Math.min(0.8, baseHSL.l)); // Ensure minimum/maximum lightness

                tempColor.setHSL(finalHue, finalSaturation, finalLightness);

                colArray[i3] = tempColor.r;
                colArray[i3 + 1] = tempColor.g;
                colArray[i3 + 2] = tempColor.b;

            } // --- End Particle Loop ---

            // --- Mark Buffers for Update on GPU ---
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.color.needsUpdate = true;

        } // --- End if(!params.paused) ---

        // --- Render Scene ---
        renderer.render(scene, camera);

    } // --- End animate() ---

    // --- Start Animation ---
    animate();

    console.log("--- Fluid Simulation Initialized Successfully ---");

}); // --- End DOMContentLoaded listener ---

console.log("--- Fluid Simulation Script END ---");