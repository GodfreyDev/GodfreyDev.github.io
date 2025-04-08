// Import the lil-gui library as an ES module
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17/dist/lil-gui.esm.min.js';

document.addEventListener('DOMContentLoaded', () => {
    let isPaused = false;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 110; // Size of the viewing volume for OrthographicCamera

    // Use OrthographicCamera for a consistent 2D view
    const camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, // left
        frustumSize * aspect / 2,  // right
        frustumSize / 2,           // top
        frustumSize / -2,          // bottom
        1,                         // near
        1000                       // far
    );
    camera.position.z = 10; // Position camera further back

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Set a default clear color (can be overridden by gradient)
    renderer.setClearColor(0x000000, 0); // Transparent background
    document.body.appendChild(renderer.domElement);

    // --- Parameters ---
    const params = {
        // --- Simulation ---
        particlesCount: 3000,         // Increased particle count
        damping: 0.95,                // Slightly less damping
        edgeDamping: 0.75,            // Damping when hitting edges/obstacles
        maxVelocity: 1.5,             // Increased max velocity
        containerRadius: 50,
        gravityStrength: 0.03,         // Adjusted gravity strength
        gravityEnabled: false,
        paused: isPaused,

        // --- Interaction ---
        interactionRadius: 8.0,
        repulsionStrength: 0.08,
        cohesionStrength: 0.005,       // Added cohesion
        cohesionRadius: 4.0,          // Radius for cohesion
        attractionStrength: 0.05,      // Adjusted strengths
        repellingStrength: 0.1,
        vortexStrength: 0.08,          // Strength for vortex
        stirStrength: 0.05,           // Strength for stirring

        // --- Visuals ---
        particleBaseColor: '#00ffff',  // Base color (cyan)
        particleVelocityColorScale: 2.0, // How much velocity affects color shift (hue)
        particleSize: 0.5,
        showInteractionRadius: true,
        bgColorTop: '#111133',
        bgColorBottom: '#331111',

        // --- Obstacles ---
        obstacles: [
            { x: -20, y: 15, radius: 8 },
            { x: 25, y: -10, radius: 12 },
            { x: 0, y: -30, radius: 5}
        ],
        enableObstacles: true,
    };

    // --- Particle Data ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particlesCount * 3);
    const velocities = new Float32Array(params.particlesCount * 3);
    const colors = new Float32Array(params.particlesCount * 3); // For per-particle color
    const initialPositions = new Float32Array(params.particlesCount * 3); // To store initial state for reset
    const baseColor = new THREE.Color(params.particleBaseColor);

    // --- Material ---
    // Use vertex colors and size attenuation
    const material = new THREE.PointsMaterial({
        size: params.particleSize,
        vertexColors: true,         // Enable per-particle color
        sizeAttenuation: true,      // Size depends on distance (though less relevant for ortho)
        blending: THREE.AdditiveBlending, // Brighter where particles overlap
        depthWrite: false           // Improves rendering with blending
    });
    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // --- Mouse Interaction Visualizer ---
    const interactionRingGeometry = new THREE.RingGeometry(params.interactionRadius - 0.1, params.interactionRadius + 0.1, 32);
    const interactionRingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const interactionRing = new THREE.Mesh(interactionRingGeometry, interactionRingMaterial);
    interactionRing.visible = params.showInteractionRadius;
    scene.add(interactionRing);

    // --- Obstacle Visualizers ---
    const obstacleMeshes = [];
    function createObstacleMeshes() {
        // Clear existing meshes
        obstacleMeshes.forEach(mesh => scene.remove(mesh));
        obstacleMeshes.length = 0;

        if (params.enableObstacles) {
             params.obstacles.forEach(obs => {
                const geometry = new THREE.CircleGeometry(obs.radius, 32);
                const material = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(obs.x, obs.y, -1); // Place slightly behind particles
                scene.add(mesh);
                obstacleMeshes.push(mesh);
            });
        }
    }
    createObstacleMeshes(); // Initial creation

    // --- State Variables ---
    let mouseX = 0;
    let mouseY = 0;
    let attracting = false;
    let repelling = false;
    let vortexing = false;
    let stirring = false;

    // --- GUI Setup ---
    const gui = new GUI();
    gui.title("Fluid Controls");

    // Simulation Control
    const simFolder = gui.addFolder('Simulation Control');
    simFolder.add(params, 'paused').name('Pause (P)').onChange(value => isPaused = value);
    simFolder.add({ reset: () => resetSimulation() }, 'reset').name('Reset (R)');
    simFolder.add(params, 'gravityEnabled').name('Enable Gravity (G)');
    simFolder.add(params, 'gravityStrength', 0.0, 0.1).name('Gravity Strength');
    simFolder.open();

    // Interaction Folder
    const interactionFolder = gui.addFolder('Interaction');
    interactionFolder.add(params, 'interactionRadius', 1, 20).name('Radius').onChange(value => {
        // Update visualizer geometry
        interactionRing.geometry.dispose(); // Dispose old geometry
        interactionRing.geometry = new THREE.RingGeometry(value - 0.1, value + 0.1, 32);
    });
    interactionFolder.add(params, 'attractionStrength', 0.0, 0.2).name('Attraction');
    interactionFolder.add(params, 'repellingStrength', 0.0, 0.3).name('Repulsion');
    interactionFolder.add(params, 'vortexStrength', 0.0, 0.2).name('Vortex');
    interactionFolder.add(params, 'stirStrength', 0.0, 0.2).name('Stir');
    interactionFolder.open();

    // Physics Folder
    const physicsFolder = gui.addFolder('Physics');
    physicsFolder.add(params, 'damping', 0.8, 1.0).name('Damping');
    physicsFolder.add(params, 'edgeDamping', 0.1, 1.0).name('Edge Damping');
    physicsFolder.add(params, 'maxVelocity', 0.1, 5.0).name('Max Velocity');
    physicsFolder.add(params, 'repulsionStrength', 0.0, 0.2).name('Particle Repulsion');
     physicsFolder.add(params, 'cohesionStrength', 0.0, 0.05).name('Cohesion Strength');
     physicsFolder.add(params, 'cohesionRadius', 1.0, 10.0).name('Cohesion Radius');
    physicsFolder.open();

    // Visualization Folder
    const vizFolder = gui.addFolder('Visualization');
    vizFolder.addColor(params, 'particleBaseColor').name('Base Color').onChange(value => baseColor.set(value));
    vizFolder.add(params, 'particleVelocityColorScale', 0, 10).name('Velocity Color Scale');
    vizFolder.add(params, 'particleSize', 0.1, 3.0).name('Particle Size').onChange(value => material.size = value);
    vizFolder.add(params, 'showInteractionRadius').name('Show Interaction Radius').onChange(value => interactionRing.visible = value);
    vizFolder.addColor(params, 'bgColorTop').name('Background Top').onChange(updateBackground);
    vizFolder.addColor(params, 'bgColorBottom').name('Background Bottom').onChange(updateBackground);
    vizFolder.open();

     // Obstacles Folder
    const obstacleFolder = gui.addFolder('Obstacles');
    obstacleFolder.add(params, 'enableObstacles').name('Enable Obstacles').onChange(createObstacleMeshes);
    // Note: Dynamically editing obstacle positions/radii in the GUI would require more complex updates.
    obstacleFolder.open();


    // --- Helper Functions ---

    // Update background gradient
    function updateBackground() {
        document.body.style.background = `linear-gradient(to bottom, ${params.bgColorTop}, ${params.bgColorBottom})`;
    }
    updateBackground(); // Initial call

    // Convert screen coordinates to simulation world coordinates (Orthographic)
    function getSimulationCoords(clientX, clientY) {
        const rect = renderer.domElement.getBoundingClientRect();
        // Normalize mouse coordinates (-1 to +1)
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

        // Unproject normalized coordinates into world space
        const vec = new THREE.Vector3(x, y, 0.5); // z doesn't matter much here
        vec.unproject(camera);

        return { x: vec.x, y: vec.y };
    }

    // Initialize or Reset particle positions, velocities, and colors
    function initializeParticles() {
        const tempColor = new THREE.Color(); // Temporary color object
        for (let i = 0; i < params.particlesCount; i++) {
            const i3 = i * 3;

            // Initial position within a smaller radius initially
            const radius = Math.random() * params.containerRadius * 0.8;
            const angle = Math.random() * Math.PI * 2;
            positions[i3] = Math.cos(angle) * radius; // X
            positions[i3 + 1] = Math.sin(angle) * radius; // Y
            positions[i3 + 2] = 0; // Z

            // Store initial positions
            initialPositions[i3] = positions[i3];
            initialPositions[i3 + 1] = positions[i3 + 1];
            initialPositions[i3 + 2] = positions[i3 + 2];

            // Initial velocities (small random)
            velocities[i3] = (Math.random() - 0.5) * 0.1; // X
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.1; // Y
            velocities[i3 + 2] = 0; // Z

            // Initial colors (set to base color)
            tempColor.set(params.particleBaseColor);
            colors[i3] = tempColor.r;
            colors[i3 + 1] = tempColor.g;
            colors[i3 + 2] = tempColor.b;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); // Add color attribute
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
    }

    function resetSimulation() {
        console.log("Resetting simulation...");
        // Simply copy initial positions back
        positions.set(initialPositions);
        // Reset velocities
        velocities.fill(0);
         // Reset colors (optional, could recalculate based on zero velocity)
        const tempColor = new THREE.Color(params.particleBaseColor);
         for (let i = 0; i < params.particlesCount; i++) {
             const i3 = i * 3;
             colors[i3] = tempColor.r;
             colors[i3 + 1] = tempColor.g;
             colors[i3 + 2] = tempColor.b;
         }

        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true; // Update colors too
        isPaused = false; // Ensure simulation is not paused after reset
        params.paused = false;
        gui.controllers.forEach(c => c.updateDisplay()); // Update GUI display
    }


    // --- Event Listeners ---
    window.addEventListener('mousemove', (event) => {
        const coords = getSimulationCoords(event.clientX, event.clientY);
        mouseX = coords.x;
        mouseY = coords.y;
        // Update interaction ring position
        interactionRing.position.set(mouseX, mouseY, 0);
    });

    window.addEventListener('mousedown', (event) => {
        if (event.button === 0) { // Left click
             if (event.shiftKey) vortexing = true;
             else if (event.ctrlKey) stirring = true;
             else attracting = true;
        } else if (event.button === 1) { // Middle click
             vortexing = true;
             event.preventDefault(); // Prevent default middle-click scroll behavior
        } else if (event.button === 2) { // Right click
            repelling = true;
             event.preventDefault(); // Prevent default context menu
        }
    });

    window.addEventListener('mouseup', (event) => {
         if (event.button === 0) { // Left click release
             attracting = false;
             vortexing = false;
             stirring = false;
        } else if (event.button === 1) { // Middle click release
             vortexing = false;
         } else if (event.button === 2) { // Right click release
             repelling = false;
         }
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (event) => event.preventDefault());

    // Keyboard listeners
    window.addEventListener('keydown', (event) => {
        switch(event.key.toUpperCase()) {
            case 'G':
                params.gravityEnabled = !params.gravityEnabled;
                gui.controllers.forEach(c => c.updateDisplay()); // Update GUI
                break;
            case 'P':
                isPaused = !isPaused;
                params.paused = isPaused;
                 gui.controllers.forEach(c => c.updateDisplay()); // Update GUI
                break;
            case 'R':
                resetSimulation();
                break;
            // Add more keybinds here if needed
        }
    });


    // Touch event listeners (simplified: single touch attracts)
    let touchIdentifier = null; // Track the primary touch
     window.addEventListener('touchstart', (event) => {
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            touchIdentifier = touch.identifier; // Store the ID of this touch
            const coords = getSimulationCoords(touch.clientX, touch.clientY);
            mouseX = coords.x;
            mouseY = coords.y;
            interactionRing.position.set(mouseX, mouseY, 0);
            attracting = true; // Simple touch = attract
        }
        event.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (event) => {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            if (touch.identifier === touchIdentifier) { // Only track the primary touch
                const coords = getSimulationCoords(touch.clientX, touch.clientY);
                mouseX = coords.x;
                mouseY = coords.y;
                 interactionRing.position.set(mouseX, mouseY, 0);
                break; // Found the primary touch, stop searching
            }
        }
        event.preventDefault();
    }, { passive: false });

    window.addEventListener('touchend', (event) => {
         for (let i = 0; i < event.changedTouches.length; i++) {
             const touch = event.changedTouches[i];
             if (touch.identifier === touchIdentifier) { // Check if the primary touch ended
                 attracting = false;
                 touchIdentifier = null; // Reset the tracked touch ID
                 break;
             }
         }
        event.preventDefault();
    }, { passive: false });
    window.addEventListener('touchcancel', (event) => {
         for (let i = 0; i < event.changedTouches.length; i++) {
             const touch = event.changedTouches[i];
             if (touch.identifier === touchIdentifier) {
                 attracting = false;
                 touchIdentifier = null;
                 break;
             }
         }
        event.preventDefault();
     }, { passive: false });


    // --- Initialization ---
    initializeParticles();

    // --- FPS Counter Setup ---
    const fpsCounter = document.getElementById('fpsCounter');
    let lastTime = performance.now();
    let frames = 0;
    let fps = 0;

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);

        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000; // Time since last frame in seconds

        // --- FPS Calculation ---
        frames++;
        if (currentTime - lastTime >= 1000) {
            fps = frames;
            frames = 0;
            lastTime = currentTime; // Reset lastTime for accurate FPS
            fpsCounter.textContent = `FPS: ${fps}`;
        } else {
             lastTime = currentTime; // Update lastTime for deltaTime calc if not resetting FPS yet
        }

        // --- Simulation Update (if not paused) ---
        if (!isPaused) {
            const posArray = geometry.attributes.position.array;
            const velArray = velocities; // Use direct reference
            const colArray = geometry.attributes.color.array;
            const interactionRadiusSq = params.interactionRadius * params.interactionRadius; // Squared for cheaper distance checks
            const cohesionRadiusSq = params.cohesionRadius * params.cohesionRadius;

            const tempColor = new THREE.Color(); // For color calculations

            for (let i = 0; i < params.particlesCount; i++) {
                const i3 = i * 3;
                const px = posArray[i3];
                const py = posArray[i3 + 1];
                let vx = velArray[i3];
                let vy = velArray[i3 + 1];

                // --- Apply Gravity ---
                if (params.gravityEnabled) {
                    vy -= params.gravityStrength; // Apply gravity directly to velocity
                }

                // --- Mouse/Touch Interaction ---
                const dxMouse = mouseX - px;
                const dyMouse = mouseY - py;
                const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;

                if (distMouseSq < interactionRadiusSq * 4) { // Optimization: check wider radius before sqrt
                     const distMouse = Math.sqrt(distMouseSq);
                     if (distMouse > 0.1 && distMouse < params.interactionRadius) { // Check actual radius and avoid self-interaction
                        const factor = 1.0 / distMouse; // Normalize direction vector
                         if (attracting) {
                            vx += dxMouse * factor * params.attractionStrength;
                            vy += dyMouse * factor * params.attractionStrength;
                        }
                        if (repelling) {
                            vx -= dxMouse * factor * params.repellingStrength;
                            vy -= dyMouse * factor * params.repellingStrength;
                        }
                        if (vortexing) {
                            // Apply force perpendicular to the direction vector (tangential)
                            vx += -dyMouse * factor * params.vortexStrength; // -dy for clockwise rotation
                            vy += dxMouse * factor * params.vortexStrength; // dx for clockwise rotation
                        }
                         if (stirring) {
                             // Apply a gentler tangential force, maybe weaker further away
                             const stirFactor = params.stirStrength * (1.0 - distMouse / params.interactionRadius);
                             vx += -dyMouse * factor * stirFactor;
                             vy += dxMouse * factor * stirFactor;
                         }
                    }
                }


                // --- Particle-Particle Interaction (Repulsion & Cohesion) ---
                for (let j = i + 1; j < params.particlesCount; j++) { // Optimization: only check pairs once (j = i + 1)
                    const j3 = j * 3;
                    const dx = posArray[j3] - px;
                    const dy = posArray[j3 + 1] - py;
                    const distSq = dx * dx + dy * dy;

                    // Repulsion
                    if (distSq < interactionRadiusSq && distSq > 0.001) { // Check repulsion radius
                        const distance = Math.sqrt(distSq);
                        const force = (params.interactionRadius - distance) * params.repulsionStrength / distance; // Normalized force
                        const forceX = dx * force;
                        const forceY = dy * force;

                        vx -= forceX;
                        vy -= forceY;
                        // Apply equal and opposite force to particle j
                        velArray[j3] += forceX;
                        velArray[j3 + 1] += forceY;
                    }
                    // Cohesion
                    else if (distSq < cohesionRadiusSq && distSq > interactionRadiusSq * 0.5 ) { // Check cohesion radius (but not too close)
                        const distance = Math.sqrt(distSq);
                         // Attract towards each other gently
                        const force = (distance - params.cohesionRadius * 0.5) * params.cohesionStrength / distance; // Adjusted force profile
                        const forceX = dx * force;
                        const forceY = dy * force;

                        vx += forceX;
                        vy += forceY;
                        // Apply equal and opposite force to particle j
                        velArray[j3] -= forceX;
                        velArray[j3 + 1] -= forceY;
                    }
                }

                // --- Velocity Limiting ---
                const velMagSq = vx * vx + vy * vy;
                if (velMagSq > params.maxVelocity * params.maxVelocity) {
                    const scale = params.maxVelocity / Math.sqrt(velMagSq);
                    vx *= scale;
                    vy *= scale;
                }

                // --- Apply Damping ---
                vx *= params.damping;
                vy *= params.damping;

                // --- Update Position ---
                let nextX = px + vx;
                let nextY = py + vy;

                 // --- Boundary Collision (Circular Container) ---
                const distFromCenterSq = nextX * nextX + nextY * nextY;
                if (distFromCenterSq > params.containerRadius * params.containerRadius) {
                    const distFromCenter = Math.sqrt(distFromCenterSq);
                    const normalX = nextX / distFromCenter;
                    const normalY = nextY / distFromCenter;

                    // Reflect velocity component normal to the boundary
                    const dotProduct = vx * normalX + vy * normalY;
                    vx -= 2 * dotProduct * normalX;
                    vy -= 2 * dotProduct * normalY;

                    // Apply edge damping
                    vx *= params.edgeDamping;
                    vy *= params.edgeDamping;

                    // Move particle back onto the boundary slightly inside
                    nextX = normalX * params.containerRadius * 0.99;
                    nextY = normalY * params.containerRadius * 0.99;
                }

                // --- Obstacle Collision ---
                if (params.enableObstacles) {
                    for (const obs of params.obstacles) {
                        const dxObs = nextX - obs.x;
                        const dyObs = nextY - obs.y;
                        const distObsSq = dxObs * dxObs + dyObs * dyObs;

                        if (distObsSq < obs.radius * obs.radius) {
                            const distObs = Math.sqrt(distObsSq);
                             const normalX = dxObs / distObs;
                             const normalY = dyObs / distObs;

                            // Reflect velocity component normal to the obstacle boundary
                             const dotProduct = vx * normalX + vy * normalY;
                             vx -= 2 * dotProduct * normalX;
                             vy -= 2 * dotProduct * normalY;

                            // Apply edge damping
                             vx *= params.edgeDamping;
                             vy *= params.edgeDamping;

                            // Move particle just outside the obstacle boundary
                             nextX = obs.x + normalX * obs.radius * 1.01;
                             nextY = obs.y + normalY * obs.radius * 1.01;
                         }
                    }
                }

                // --- Final Update ---
                posArray[i3] = nextX;
                posArray[i3 + 1] = nextY;
                velArray[i3] = vx;
                velArray[i3 + 1] = vy;


                // --- Update Particle Color based on Velocity ---
                const speed = Math.sqrt(vx * vx + vy * vy);
                // Map speed to hue (0=base, increases towards red/violet as speed increases)
                // Clamp speed effect to avoid extreme shifts
                const hueShift = Math.min(speed * params.particleVelocityColorScale * 0.1, 0.7); // 0.7 prevents wrapping fully back to red
                tempColor.setHSL(baseColor.getHSL({ h: 0, s: 0, l: 0 }).h + hueShift, 1.0, 0.5); // Use HSL for easy hue shift, full saturation, 50% lightness

                colArray[i3] = tempColor.r;
                colArray[i3 + 1] = tempColor.g;
                colArray[i3 + 2] = tempColor.b;
            }

            // --- Mark Buffers for Update ---
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.color.needsUpdate = true;
        } // End of if(!isPaused)

        // --- Render Scene ---
        renderer.render(scene, camera);
    }

    // --- Start Animation ---
    animate();

    // --- Handle Window Resize ---
    window.addEventListener('resize', () => {
        const newAspect = window.innerWidth / window.innerHeight;
        camera.left = frustumSize * newAspect / -2;
        camera.right = frustumSize * newAspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});