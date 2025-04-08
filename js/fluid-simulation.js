// Import the lil-gui library as an ES module
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17/dist/lil-gui.esm.min.js';

console.log("--- Fluid Simulation Script START ---"); // Check if this specific script loads

document.addEventListener('DOMContentLoaded', () => {
    console.log("--- DOMContentLoaded Fired ---");

    let isPaused = false;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 110;
    const camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.body.appendChild(renderer.domElement);

    // --- Parameters ---
    const params = {
        particlesCount: 3000,
        damping: 0.95,
        edgeDamping: 0.75,
        maxVelocity: 1.5,
        containerRadius: 50,
        gravityStrength: 0.03,
        gravityEnabled: false,
        paused: isPaused, // Link to the isPaused variable for GUI display
        interactionRadius: 8.0,
        repulsionStrength: 0.08, // Particle-particle repulsion
        cohesionStrength: 0.005,
        cohesionRadius: 4.0,
        attractionStrength: 0.05, // Mouse attraction
        repellingStrength: 0.1, // Mouse repulsion
        vortexStrength: 0.08,
        stirStrength: 0.05,
        particleBaseColor: '#00ffff',
        particleVelocityColorScale: 2.0,
        particleSize: 0.5,
        showInteractionRadius: true,
        bgColorTop: '#111133',
        bgColorBottom: '#331111',
        obstacles: [
            { x: -20, y: 15, radius: 8 },
            { x: 25, y: -10, radius: 12 },
            { x: 0, y: -30, radius: 5 }
        ],
        enableObstacles: true,
    };

    // --- Particle Data ---
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particlesCount * 3);
    const velocities = new Float32Array(params.particlesCount * 3);
    const colors = new Float32Array(params.particlesCount * 3);
    const initialPositions = new Float32Array(params.particlesCount * 3);
    const baseColor = new THREE.Color(params.particleBaseColor);
    let tempColor = new THREE.Color(); // Reusable color object

    // --- Material ---
    const material = new THREE.PointsMaterial({
        size: params.particleSize,
        vertexColors: true, // <<< CRITICAL for color change
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // --- Mouse Interaction Visualizer ---
    let interactionRing = null; // Initialize later
    function createInteractionRing() {
         if (interactionRing) scene.remove(interactionRing); // Remove old one if exists
         const geometry = new THREE.RingGeometry(params.interactionRadius - 0.1, params.interactionRadius + 0.1, 32);
         const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
         interactionRing = new THREE.Mesh(geometry, ringMaterial);
         interactionRing.visible = params.showInteractionRadius;
         interactionRing.position.z = 1; // Ensure it's slightly in front
         scene.add(interactionRing);
         console.log("Interaction ring created/updated. Radius:", params.interactionRadius);
    }
    createInteractionRing();

    // --- Obstacle Visualizers ---
    const obstacleMeshes = [];
    function createObstacleMeshes() {
        obstacleMeshes.forEach(mesh => scene.remove(mesh));
        obstacleMeshes.length = 0;
        if (params.enableObstacles) {
            console.log("Creating obstacle meshes...");
            params.obstacles.forEach((obs, index) => {
                const geometry = new THREE.CircleGeometry(obs.radius, 32);
                const meshMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(geometry, meshMaterial);
                mesh.position.set(obs.x, obs.y, -1);
                scene.add(mesh);
                obstacleMeshes.push(mesh);
                console.log(` - Obstacle ${index} added at (${obs.x}, ${obs.y}) R=${obs.radius}`);
            });
        } else {
            console.log("Obstacle meshes disabled.");
        }
    }
    createObstacleMeshes();

    // --- State Variables ---
    let mouseX = 0;
    let mouseY = 0;
    let attracting = false;
    let repelling = false;
    let vortexing = false;
    let stirring = false;

    // --- GUI Setup ---
    console.log("Setting up GUI...");
    const gui = new GUI();
    gui.title("Fluid Controls");

    const simFolder = gui.addFolder('Simulation Control');
    // Use params.paused directly for the GUI binding
    simFolder.add(params, 'paused').name('Pause (P)').onChange(value => {
        isPaused = value; // Update the actual control variable
        console.log("Pause toggled via GUI:", isPaused);
    });
    simFolder.add({ reset: () => resetSimulation() }, 'reset').name('Reset (R)');
    simFolder.add(params, 'gravityEnabled').name('Enable Gravity (G)').onChange(value => {
         console.log("Gravity toggled via GUI:", value);
    });
    simFolder.add(params, 'gravityStrength', 0.0, 0.1).name('Gravity Strength');
    simFolder.open();

    const interactionFolder = gui.addFolder('Interaction');
    interactionFolder.add(params, 'interactionRadius', 1, 20).name('Radius').onChange(value => {
        params.interactionRadius = value;
        createInteractionRing(); // Recreate ring with new radius
    });
    interactionFolder.add(params, 'attractionStrength', 0.0, 0.2).name('Attraction');
    interactionFolder.add(params, 'repellingStrength', 0.0, 0.3).name('Repulsion');
    interactionFolder.add(params, 'vortexStrength', 0.0, 0.2).name('Vortex');
    interactionFolder.add(params, 'stirStrength', 0.0, 0.2).name('Stir');
    interactionFolder.open();

    const physicsFolder = gui.addFolder('Physics');
    physicsFolder.add(params, 'damping', 0.8, 1.0).name('Damping');
    physicsFolder.add(params, 'edgeDamping', 0.1, 1.0).name('Edge Damping');
    physicsFolder.add(params, 'maxVelocity', 0.1, 5.0).name('Max Velocity');
    physicsFolder.add(params, 'repulsionStrength', 0.0, 0.2).name('Particle Repulsion');
    physicsFolder.add(params, 'cohesionStrength', 0.0, 0.05).name('Cohesion Strength');
    physicsFolder.add(params, 'cohesionRadius', 1.0, 10.0).name('Cohesion Radius');
    physicsFolder.open();

    const vizFolder = gui.addFolder('Visualization');
    vizFolder.addColor(params, 'particleBaseColor').name('Base Color').onChange(value => {
        baseColor.set(value);
        console.log("Base color changed:", value);
        // Force color recalculation on next frame even if paused
        if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true;
    });
    vizFolder.add(params, 'particleVelocityColorScale', 0, 10).name('Velocity Color Scale');
    vizFolder.add(params, 'particleSize', 0.1, 3.0).name('Particle Size').onChange(value => {
        material.size = value;
        console.log("Particle size changed:", value);
    });
    vizFolder.add(params, 'showInteractionRadius').name('Show Interaction Radius').onChange(value => {
        interactionRing.visible = value;
        console.log("Interaction ring visibility:", value);
    });
    vizFolder.addColor(params, 'bgColorTop').name('Background Top').onChange(updateBackground);
    vizFolder.addColor(params, 'bgColorBottom').name('Background Bottom').onChange(updateBackground);
    vizFolder.open();

    const obstacleFolder = gui.addFolder('Obstacles');
    obstacleFolder.add(params, 'enableObstacles').name('Enable Obstacles').onChange(createObstacleMeshes);
    obstacleFolder.open();
    console.log("GUI Setup Complete.");

    // --- Helper Functions ---
    function updateBackground() {
        document.body.style.background = `linear-gradient(to bottom, ${params.bgColorTop}, ${params.bgColorBottom})`;
        console.log("Background updated.");
    }
    updateBackground();

    function getSimulationCoords(clientX, clientY) {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        const vec = new THREE.Vector3(x, y, 0.5);
        vec.unproject(camera);
        return { x: vec.x, y: vec.y };
    }

    function initializeParticles() {
        console.log("Initializing particles...");
        tempColor = new THREE.Color(); // Ensure tempColor is fresh
        for (let i = 0; i < params.particlesCount; i++) {
            const i3 = i * 3;
            const radius = Math.random() * params.containerRadius * 0.8;
            const angle = Math.random() * Math.PI * 2;
            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = Math.sin(angle) * radius;
            positions[i3 + 2] = 0;
            initialPositions[i3] = positions[i3];
            initialPositions[i3 + 1] = positions[i3 + 1];
            initialPositions[i3 + 2] = positions[i3 + 2];
            velocities[i3] = (Math.random() - 0.5) * 0.1;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
            velocities[i3 + 2] = 0;
            tempColor.set(params.particleBaseColor);
            colors[i3] = tempColor.r;
            colors[i3 + 1] = tempColor.g;
            colors[i3 + 2] = tempColor.b;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); // <<< CRITICAL FOR COLOR
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true; // <<< CRITICAL FOR COLOR
        console.log("Particles Initialized. Position & Color attributes set.");
    }

    function resetSimulation() {
        console.log("--- Resetting Simulation ---");
        positions.set(initialPositions);
        velocities.fill(0);
        tempColor.set(params.particleBaseColor); // Reset color object
        for (let i = 0; i < params.particlesCount; i++) {
            const i3 = i * 3;
            colors[i3] = tempColor.r;
            colors[i3 + 1] = tempColor.g;
            colors[i3 + 2] = tempColor.b;
        }
        if (geometry.attributes.position) geometry.attributes.position.needsUpdate = true;
        if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true; // <<< CRITICAL FOR COLOR RESET
        isPaused = false;
        params.paused = false; // Update GUI state
        // Update all GUI controllers to reflect potentially reset state
        gui.controllersRecursive().forEach(controller => controller.updateDisplay());
        console.log("Simulation Reset Complete.");
    }

    // --- Event Listeners ---
    console.log("Adding event listeners...");
    window.addEventListener('mousemove', (event) => {
        const coords = getSimulationCoords(event.clientX, event.clientY);
        mouseX = coords.x;
        mouseY = coords.y;
        if (interactionRing) {
           interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);
        }
    });

    window.addEventListener('mousedown', (event) => {
        console.log(`--- Mouse Down - Button: ${event.button}, Shift: ${event.shiftKey}, Ctrl: ${event.ctrlKey}, Meta: ${event.metaKey} ---`);
        // Check for clicks on the GUI first - simple check, might need refinement
        if (event.target !== renderer.domElement) {
             console.log("Click potentially on GUI, ignoring for simulation interaction.");
             return;
        }

        if (event.button === 0) { // Left click
            if (event.shiftKey) {
                console.log("Setting vortexing = true");
                vortexing = true; attracting = false; repelling = false; stirring = false;
            } else if (event.ctrlKey || event.metaKey) { // Check Meta for Mac Command key
                 console.log("Setting stirring = true");
                stirring = true; attracting = false; repelling = false; vortexing = false;
            } else {
                console.log("Setting attracting = true");
                attracting = true; repelling = false; vortexing = false; stirring = false;
            }
        } else if (event.button === 1) { // Middle click
             console.log("Setting vortexing = true (Middle Click)");
             vortexing = true; attracting = false; repelling = false; stirring = false;
             event.preventDefault(); // Prevent default scroll/pan
        } else if (event.button === 2) { // Right click
            console.log("Setting repelling = true");
            repelling = true; attracting = false; vortexing = false; stirring = false;
            event.preventDefault(); // Prevent context menu
        }
    });

    window.addEventListener('mouseup', (event) => {
         console.log(`--- Mouse Up - Button: ${event.button} ---`);
         // Always reset all interaction flags on mouseup for simplicity
         attracting = false;
         repelling = false;
         vortexing = false;
         stirring = false;
         console.log("Reset interaction flags (attract, repel, vortex, stir) to false.");
    });

    window.addEventListener('contextmenu', (event) => {
        // Prevent context menu only if clicking on the canvas
        if (event.target === renderer.domElement) {
            console.log("Preventing context menu on canvas right-click.");
            event.preventDefault();
        }
    });

    window.addEventListener('keydown', (event) => {
        // Ignore key events if user is typing into a GUI input
        if (event.target.tagName === 'INPUT') {
            console.log("Keydown ignored (target is input)");
            return;
        }

        console.log(`--- Key Down: ${event.key.toUpperCase()} ---`);
        switch (event.key.toUpperCase()) {
            case 'G':
                params.gravityEnabled = !params.gravityEnabled;
                console.log("Gravity toggled via key:", params.gravityEnabled);
                // Manually update the specific GUI controller if needed
                 gui.controllersRecursive().forEach(c => { if (c.property === 'gravityEnabled') c.updateDisplay(); });
                break;
            case 'P':
                isPaused = !isPaused;
                params.paused = isPaused; // Update GUI state variable
                console.log("Pause toggled via key:", isPaused);
                 // Manually update the specific GUI controller
                 gui.controllersRecursive().forEach(c => { if (c.property === 'paused') c.updateDisplay(); });
                break;
            case 'R':
                console.log("Reset triggered via key.");
                resetSimulation();
                break;
        }
    });

    // Basic Touch handling (single touch attracts)
    let touchIdentifier = null;
    window.addEventListener('touchstart', (event) => {
        if (event.target === renderer.domElement && event.touches.length > 0) {
             const touch = event.touches[0];
             touchIdentifier = touch.identifier;
             const coords = getSimulationCoords(touch.clientX, touch.clientY);
             mouseX = coords.x;
             mouseY = coords.y;
             if(interactionRing) interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);
             console.log("Touch Start - Setting attracting = true");
             attracting = true; repelling = false; vortexing = false; stirring = false;
             event.preventDefault(); // Prevent default scroll/zoom
         }
    }, { passive: false });

    window.addEventListener('touchmove', (event) => {
        if (touchIdentifier !== null) {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 if (touch.identifier === touchIdentifier) {
                     const coords = getSimulationCoords(touch.clientX, touch.clientY);
                     mouseX = coords.x;
                     mouseY = coords.y;
                     if(interactionRing) interactionRing.position.set(mouseX, mouseY, interactionRing.position.z);
                     break;
                 }
             }
             event.preventDefault(); // Prevent default scroll/zoom
         }
     }, { passive: false });

    window.addEventListener('touchend', (event) => {
        if (touchIdentifier !== null) {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 if (touch.identifier === touchIdentifier) {
                     console.log("Touch End - Resetting interaction flags.");
                     attracting = false; repelling = false; vortexing = false; stirring = false;
                     touchIdentifier = null;
                     break;
                 }
             }
             // Don't preventDefault here if not needed, might interfere elsewhere
         }
     }, { passive: false });
     window.addEventListener('touchcancel', (event) => {
         if (touchIdentifier !== null) {
             console.log("Touch Cancel - Resetting interaction flags.");
             attracting = false; repelling = false; vortexing = false; stirring = false;
             touchIdentifier = null;
             // Don't preventDefault here if not needed
         }
      }, { passive: false });

    console.log("Event listeners added.");

    // --- Initialization ---
    initializeParticles();

    // --- FPS Counter Setup ---
    const fpsCounter = document.getElementById('fpsCounter');
    let lastTime = performance.now();
    let frameCount = 0; // Use frameCount instead of frames
    let fps = 0;
    let logTimer = 0; // Timer for periodic logs

    // --- Animation Loop ---
    console.log("Starting animation loop...");
    function animate() {
        requestAnimationFrame(animate);

        const currentTime = performance.now();
        const deltaTime = Math.min(0.05, (currentTime - lastTime) / 1000); // Delta time in seconds, capped to prevent large jumps
        lastTime = currentTime;
        logTimer += deltaTime;

        // FPS Calculation
        frameCount++;
        if (logTimer >= 1.0) { // Update FPS counter every second
            fps = frameCount;
            frameCount = 0;
            logTimer -= 1.0;
            fpsCounter.textContent = `FPS: ${fps}`;
             // Periodic check log
             if(!isPaused) console.log(` | Running | Grav:${params.gravityEnabled} Att:${attracting} Rep:${repelling} Vor:${vortexing} Stir:${stirring}`);
        }

        // --- Simulation Update ---
        if (!isPaused) {
            const posArray = geometry.attributes.position.array;
            const velArray = velocities;
            const colArray = geometry.attributes.color.array;
            const interactionRadiusSq = params.interactionRadius * params.interactionRadius;
            const cohesionRadiusSq = params.cohesionRadius * params.cohesionRadius;

            // Ensure tempColor is valid
            if (!tempColor) tempColor = new THREE.Color();

             // Re-fetch baseColor HSL each frame in case it was changed via GUI
             let baseHSL = { h: 0, s: 1, l: 0.5 }; // Default fallback
             if (baseColor && typeof baseColor.getHSL === 'function') {
                 baseColor.getHSL(baseHSL);
             } else {
                  // This should not happen if baseColor is initialized correctly
                  if(frameCount % 180 == 0) console.warn("baseColor invalid in animate loop!"); // Log warning occasionally
                  baseColor = new THREE.Color(params.particleBaseColor); // Try to recover
                  baseColor.getHSL(baseHSL);
             }


            for (let i = 0; i < params.particlesCount; i++) {
                const i3 = i * 3;
                const px = posArray[i3];
                const py = posArray[i3 + 1];
                let vx = velArray[i3];
                let vy = velArray[i3 + 1];

                // --- Gravity ---
                if (params.gravityEnabled) {
                    vy -= params.gravityStrength; // Apply gravity force (acceleration)
                    // if (i === 0 && frameCount % 60 === 0) console.log(`P[0] Applying gravity. vy before: ${velArray[i3+1].toFixed(3)}, after: ${vy.toFixed(3)}`);
                }

                // --- Mouse Interaction ---
                const dxMouse = mouseX - px;
                const dyMouse = mouseY - py;
                const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;

                // Optimization: Only calculate sqrt if potentially within range
                if (distMouseSq < interactionRadiusSq * 1.5) { // Check slightly wider area
                     const distMouse = Math.sqrt(distMouseSq);

                     if (distMouse > 0.01 && distMouse < params.interactionRadius) {
                        const factor = 1.0 / distMouse; // Normalized direction
                        let appliedForce = false;
                        if (attracting && params.attractionStrength > 0) {
                            vx += dxMouse * factor * params.attractionStrength;
                            vy += dyMouse * factor * params.attractionStrength;
                            appliedForce = true;
                        }
                        if (repelling && params.repellingStrength > 0) {
                            vx -= dxMouse * factor * params.repellingStrength;
                            vy -= dyMouse * factor * params.repellingStrength;
                             appliedForce = true;
                        }
                        if (vortexing && params.vortexStrength > 0) {
                            vx += -dyMouse * factor * params.vortexStrength;
                            vy += dxMouse * factor * params.vortexStrength;
                            appliedForce = true;
                        }
                        if (stirring && params.stirStrength > 0) {
                            const stirFactor = params.stirStrength * Math.max(0, (1.0 - distMouse / params.interactionRadius)); // Decays towards edge
                            vx += -dyMouse * factor * stirFactor;
                            vy += dxMouse * factor * stirFactor;
                            appliedForce = true;
                        }
                         // Log if a force was applied to particle 0 occasionally
                        // if(i===0 && appliedForce && frameCount % 30 === 0) console.log(`P[0] Mouse Force Applied. Att:${attracting}, Rep:${repelling}, Vor:${vortexing}, Stir:${stirring}`);
                    }
                }

                // --- Particle-Particle Interaction ---
                 for (let j = i + 1; j < params.particlesCount; j++) {
                    const j3 = j * 3;
                    const dx = posArray[j3] - px;
                    const dy = posArray[j3 + 1] - py;
                    const distSq = dx * dx + dy * dy;

                    // Repulsion (priority over cohesion)
                    if (params.repulsionStrength > 0 && distSq < interactionRadiusSq && distSq > 0.0001) {
                        const distance = Math.sqrt(distSq);
                        // Force increases sharply as distance approaches 0
                        const forceMagnitude = (1.0 - distance / params.interactionRadius) * params.repulsionStrength / distance;
                        const forceX = dx * forceMagnitude;
                        const forceY = dy * forceMagnitude;
                        vx -= forceX;
                        vy -= forceY;
                        velArray[j3] += forceX; // Apply equal and opposite force
                        velArray[j3 + 1] += forceY;
                    }
                    // Cohesion (only if not repelling)
                    else if (params.cohesionStrength > 0 && distSq < cohesionRadiusSq && distSq > interactionRadiusSq * 0.8) { // Apply cohesion only outside repulsion radius but within cohesion range
                        const distance = Math.sqrt(distSq);
                        // Gentle attraction towards cohesion radius edge
                        const forceMagnitude = params.cohesionStrength * (1 - cohesionRadiusSq / (distSq + 0.01)); // Force weakens further away
                         const forceX = dx * forceMagnitude / distance;
                         const forceY = dy * forceMagnitude / distance;

                        vx += forceX;
                        vy += forceY;
                         velArray[j3] -= forceX; // Apply equal and opposite force
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

                // --- Damping ---
                vx *= params.damping;
                vy *= params.damping;

                // --- Update Position candidate ---
                let nextX = px + vx;
                let nextY = py + vy;

                // --- Boundary Collision ---
                const distFromCenterSq = nextX * nextX + nextY * nextY;
                if (distFromCenterSq > params.containerRadius * params.containerRadius) {
                    const distFromCenter = Math.sqrt(distFromCenterSq);
                    const normX = nextX / distFromCenter;
                    const normY = nextY / distFromCenter;
                    const dot = vx * normX + vy * normY;
                    vx -= (1 + params.edgeDamping) * dot * normX; // Reflect and dampen
                    vy -= (1 + params.edgeDamping) * dot * normY;
                    // Project back onto boundary
                    nextX = normX * params.containerRadius;
                    nextY = normY * params.containerRadius;
                }

                // --- Obstacle Collision ---
                if (params.enableObstacles) {
                    for (const obs of params.obstacles) {
                        const dxObs = nextX - obs.x;
                        const dyObs = nextY - obs.y;
                        const distObsSq = dxObs * dxObs + dyObs * dyObs;
                        if (distObsSq < obs.radius * obs.radius && distObsSq > 0.0001) {
                            const distObs = Math.sqrt(distObsSq);
                            const normX = dxObs / distObs;
                            const normY = dyObs / distObs;
                            const dot = vx * normX + vy * normY;
                            // Reflect and dampen only if moving towards the obstacle center
                            if (dot < 0) {
                                vx -= (1 + params.edgeDamping) * dot * normX;
                                vy -= (1 + params.edgeDamping) * dot * normY;
                            }
                            // Push particle out slightly
                            nextX = obs.x + normX * (obs.radius + 0.01);
                            nextY = obs.y + normY * (obs.radius + 0.01);
                            // if (i === 0 && frameCount % 10 === 0) console.log(`P[0] Obstacle Collision!`); // Log obstacle hit
                        }
                    }
                }


                // --- Final Update Position & Velocity ---
                posArray[i3] = nextX;
                posArray[i3 + 1] = nextY;
                velArray[i3] = vx;
                velArray[i3 + 1] = vy;


                // --- Update Color ---
                const speed = Math.sqrt(vx * vx + vy * vy);
                const hueShift = Math.min(speed * params.particleVelocityColorScale * 0.1, 0.7);
                // Ensure HSL values are valid before setting
                const finalHue = (baseHSL.h + hueShift) % 1.0; // Wrap hue
                const finalSaturation = Math.max(0.1, Math.min(1.0, baseHSL.s)); // Clamp saturation
                const finalLightness = Math.max(0.1, Math.min(0.9, baseHSL.l)); // Clamp lightness

                tempColor.setHSL(finalHue, finalSaturation, finalLightness);

                colArray[i3] = tempColor.r;
                colArray[i3 + 1] = tempColor.g;
                colArray[i3 + 2] = tempColor.b;

                // if (i === 0 && frameCount % 60 === 0) { // Log particle 0 color info periodically
                //     console.log(`P[0] Spd:${speed.toFixed(2)} H:${finalHue.toFixed(2)} S:${finalSaturation.toFixed(2)} L:${finalLightness.toFixed(2)} | RGB:(${tempColor.r.toFixed(2)},${tempColor.g.toFixed(2)},${tempColor.b.toFixed(2)})`);
                // }

            } // End particle loop

            // --- Mark Buffers for Update ---
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.color.needsUpdate = true; // <<< CRITICAL FOR COLOR

        } else {
             if (logTimer >= 1.0) { // Still update FPS counter when paused
                 console.log(" | Paused |");
             }
        }// End if(!isPaused)

        // --- Render ---
        renderer.render(scene, camera);

    } // End animate()

    // --- Start Animation ---
    animate();

    // --- Handle Window Resize ---
    window.addEventListener('resize', () => {
        console.log("Window resized");
        const newAspect = window.innerWidth / window.innerHeight;
        camera.left = frustumSize * newAspect / -2;
        camera.right = frustumSize * newAspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = frustumSize / -2;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        console.log("Camera and renderer updated for resize.");
    });

    console.log("--- Fluid Simulation Initialized Successfully ---");

}); // End DOMContentLoaded listener

console.log("--- Fluid Simulation Script END ---");