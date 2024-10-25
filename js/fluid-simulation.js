// Import the lil-gui library as an ES module
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.17/dist/lil-gui.esm.min.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75, // Field of view
        window.innerWidth / window.innerHeight, // Aspect ratio
        0.1, // Near clipping plane
        1000 // Far clipping plane
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create a basic point light
    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(10, 10, 10);
    scene.add(light);

    // Position the camera to focus on a 2D plane
    camera.position.z = 100;

    // Create a particle system with 2D physics properties
    const particles = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particles * 3); // Z is set to 0
    const velocities = new Float32Array(particles * 3);

    // Interaction parameters (configurable)
    const params = {
        interactionRadius: 5.0,         // Adjusted for visible repulsion
        damping: 0.9,                   // Increased damping for smoother motion
        edgeDamping: 0.5,              // Additional damping when hitting edges
        maxVelocity: 1.0,              // Cap on maximum velocity for stability
        containerRadius: 50,            // Radius of the circular container
        repulsionStrength: 0.1,        // Reduced repulsion strength
        attractionStrength: 1.0,        // Strength of the attraction force
        repellingStrength: 1.0,         // Strength of the repelling force
        gravityStrength: 0.25,          // Strength of gravity, default on
        gravityEnabled: false,           // Control gravity based on GUI
        particlesCount: particles,      // Number of particles
        particleColor: '#00ff00',       // Particle color
        particleSize: 0.75,              // Particle size
    };

    let mouseX = 0;
    let mouseY = 0;
    let attracting = false; // State for attraction mode
    let repelling = false;  // State for repelling mode

    // Initialize GUI
    const gui = new GUI();

    const guiParams = {
        interactionRadius: params.interactionRadius,
        damping: params.damping,
        edgeDamping: params.edgeDamping,
        maxVelocity: params.maxVelocity,
        containerRadius: params.containerRadius,
        repulsionStrength: params.repulsionStrength,
        attractionStrength: params.attractionStrength,
        repellingStrength: params.repellingStrength,
        gravityStrength: params.gravityStrength,
        gravityEnabled: params.gravityEnabled,
        particleColor: params.particleColor,
        particleSize: params.particleSize,
    };

    // Interaction Folder
    const interactionFolder = gui.addFolder('Interaction');
    interactionFolder.add(guiParams, 'interactionRadius', 1, 20).name('Interaction Radius').onChange(value => {
        params.interactionRadius = value;
    });
    interactionFolder.add(guiParams, 'repulsionStrength', 0.0, 0.1).name('Repulsion Strength').onChange(value => {
        params.repulsionStrength = value;
    });
    interactionFolder.add(guiParams, 'attractionStrength', 0.0, 1.0).name('Attraction Strength').onChange(value => {
        params.attractionStrength = value;
    });
    interactionFolder.add(guiParams, 'repellingStrength', 0.0, 1.0).name('Repelling Strength').onChange(value => {
        params.repellingStrength = value;
    });
    interactionFolder.open();

    // Physics Folder
    const physicsFolder = gui.addFolder('Physics');
    physicsFolder.add(guiParams, 'damping', 0.5, 1.0).name('Damping').onChange(value => {
        params.damping = value;
    });
    physicsFolder.add(guiParams, 'edgeDamping', 0.5, 1.0).name('Edge Damping').onChange(value => {
        params.edgeDamping = value;
    });
    physicsFolder.add(guiParams, 'maxVelocity', 0.05, 1.0).name('Max Velocity').onChange(value => {
        params.maxVelocity = value;
    });
    physicsFolder.add(guiParams, 'gravityStrength', 0.0, 1.0).name('Gravity Strength').onChange(value => {
        params.gravityStrength = value;
    });
    physicsFolder.add(guiParams, 'gravityEnabled').name('Enable Gravity').onChange(value => {
        params.gravityEnabled = value;
    });
    physicsFolder.open();

    // Visualization Folder
    const visualizationFolder = gui.addFolder('Visualization');
    visualizationFolder.addColor(guiParams, 'particleColor').name('Particle Color').onChange(value => {
        material.color.set(value);
    });
    visualizationFolder.add(guiParams, 'particleSize', 0.1, 5.0).name('Particle Size').onChange(value => {
        material.size = value;
    });
    visualizationFolder.open();

    // Container Settings
    gui.add(guiParams, 'containerRadius', 10, 100).name('Container Radius').onChange(value => {
        params.containerRadius = value;
    });

    // Utility function to convert screen coordinates to simulation coordinates
    function getSimulationCoords(clientX, clientY) {
        const rect = renderer.domElement.getBoundingClientRect();
        const simX = ((clientX - rect.left) / rect.width) * 100 - 50; // X range: -50 to 50
        const simY = -(((clientY - rect.top) / rect.height) * 100 - 50); // Y range: -50 to 50
        return { x: simX, y: simY };
    }

    // Mouse event listeners to track mouse position and interaction mode
    window.addEventListener('mousemove', (event) => {
        const coords = getSimulationCoords(event.clientX, event.clientY);
        mouseX = coords.x;
        mouseY = coords.y;
    });

    window.addEventListener('mousedown', (event) => {
        if (event.button === 0) attracting = true; // Left click for attraction
        if (event.button === 2) repelling = true; // Right click for repulsion
    });

    window.addEventListener('mouseup', (event) => {
        if (event.button === 0) attracting = false; // Left click release
        if (event.button === 2) repelling = false; // Right click release
    });

    window.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // Prevent default right-click menu
    });

    // Touch event listeners for mobile devices
    window.addEventListener('touchstart', (event) => {
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            const coords = getSimulationCoords(touch.clientX, touch.clientY);
            mouseX = coords.x;
            mouseY = coords.y;
            attracting = true; // Start attraction on touch
        }
        event.preventDefault(); // Prevent default touch behavior
    }, { passive: false });

    window.addEventListener('touchmove', (event) => {
        if (event.touches.length > 0) {
            const touch = event.touches[0];
            const coords = getSimulationCoords(touch.clientX, touch.clientY);
            mouseX = coords.x;
            mouseY = coords.y;
        }
        event.preventDefault(); // Prevent default touch behavior
    }, { passive: false });

    window.addEventListener('touchend', (event) => {
        attracting = false; // Stop attraction when touch ends
        event.preventDefault(); // Prevent default touch behavior
    }, { passive: false });

    // Initialize positions and velocities (2D: X and Y only)
    for (let i = 0; i < params.particlesCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * params.containerRadius; // X position
        positions[i + 1] = (Math.random() - 0.5) * params.containerRadius; // Y position
        positions[i + 2] = 0; // Z position fixed to 0 for 2D

        // Random initial velocities (2D)
        velocities[i] = (Math.random() - 0.5) * 0.05; // X velocity
        velocities[i + 1] = (Math.random() - 0.5) * 0.05; // Y velocity
        velocities[i + 2] = 0; // Z velocity fixed to 0
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Use PointsMaterial to display particles
    const material = new THREE.PointsMaterial({ color: params.particleColor, size: params.particleSize });
    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // FPS Counter Setup
    const fpsCounter = document.getElementById('fpsCounter');
    let lastTime = performance.now();
    let frames = 0;
    let fps = 0;

    // Animation loop with circular boundary, mouse attraction/repulsion, gravity, and improved behavior
    function animate() {
        requestAnimationFrame(animate);

        // FPS Calculation
        const currentTime = performance.now();
        frames++;
        if (currentTime - lastTime >= 1000) {
            fps = frames;
            frames = 0;
            lastTime = currentTime;
            fpsCounter.textContent = `FPS: ${fps}`;
        }

        // Update particle positions with 2D fluid dynamics
        const posArray = geometry.attributes.position.array;

        for (let i = 0; i < params.particlesCount * 3; i += 3) {
            // Apply gravity to Y velocity if enabled
            if (params.gravityEnabled) {
                velocities[i + 1] -= params.gravityStrength;
            }

            // Calculate attraction/repulsion towards the mouse/touch
            const dxToMouse = mouseX - posArray[i];
            const dyToMouse = mouseY - posArray[i + 1];
            const distanceToMouse = Math.sqrt(dxToMouse * dxToMouse + dyToMouse * dyToMouse);

            // Apply attraction force if in attraction mode
            if (attracting && distanceToMouse < params.containerRadius) {
                velocities[i] += (dxToMouse / distanceToMouse) * params.attractionStrength;
                velocities[i + 1] += (dyToMouse / distanceToMouse) * params.attractionStrength;
            }

            // Apply repulsion force if in repelling mode
            if (repelling && distanceToMouse < params.containerRadius) {
                velocities[i] -= (dxToMouse / distanceToMouse) * params.repellingStrength;
                velocities[i + 1] -= (dyToMouse / distanceToMouse) * params.repellingStrength;
            }

            // Interaction with nearby particles for repulsion force
            for (let j = 0; j < params.particlesCount * 3; j += 3) {
                if (i !== j) {
                    // Calculate 2D distance between particles
                    const dx = posArray[j] - posArray[i];
                    const dy = posArray[j + 1] - posArray[i + 1];
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // If within interaction radius, apply a repulsion force
                    if (distance < params.interactionRadius && distance > 0) { // Avoid division by zero
                        const force = (params.interactionRadius - distance) * params.repulsionStrength;
                        velocities[i] -= (force * dx) / distance;
                        velocities[i + 1] -= (force * dy) / distance;
                    }
                }
            }

            // Apply velocity to position (2D only)
            posArray[i] += velocities[i];
            posArray[i + 1] += velocities[i + 1];

            // Limit maximum velocity for stability
            const velocityMagnitude = Math.sqrt(velocities[i] ** 2 + velocities[i + 1] ** 2);
            if (velocityMagnitude > params.maxVelocity) {
                velocities[i] = (velocities[i] / velocityMagnitude) * params.maxVelocity;
                velocities[i + 1] = (velocities[i + 1] / velocityMagnitude) * params.maxVelocity;
            }

            // Apply damping for smoother motion
            velocities[i] *= params.damping;
            velocities[i + 1] *= params.damping;

            // Check for collision with the circular boundary
            const distanceFromCenter = Math.sqrt(posArray[i] * posArray[i] + posArray[i + 1] * posArray[i + 1]);
            if (distanceFromCenter > params.containerRadius) {
                // Reflect the velocity when hitting the boundary
                const normalX = posArray[i] / distanceFromCenter;
                const normalY = posArray[i + 1] / distanceFromCenter;
                const dotProduct = velocities[i] * normalX + velocities[i + 1] * normalY;

                // Reverse the component of velocity perpendicular to the boundary
                velocities[i] -= 2 * dotProduct * normalX;
                velocities[i + 1] -= 2 * dotProduct * normalY;

                // Apply additional damping when hitting the edge
                velocities[i] *= params.edgeDamping;
                velocities[i + 1] *= params.edgeDamping;

                // Slightly move the particle back inside the boundary
                posArray[i] = normalX * params.containerRadius;
                posArray[i + 1] = normalY * params.containerRadius;
            }
        }

        // Update the geometry and render
        geometry.attributes.position.needsUpdate = true;
        renderer.render(scene, camera);
    }

    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});
