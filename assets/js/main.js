// Define the Google Apps Script Web App URL
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyoKANgCs_Z8zF_PlzTwikZs7xBaxj4Ni-Uf1qNeRoXSBDlQZJLbeJ79NPraFZbektf/exec';

// Theme management functions (MODIFIED)
function setTheme(themeName) {
    // Ensure themeName is valid, default to light-mode otherwise
    const validTheme = (themeName === 'dark-mode' || themeName === 'light-mode') ? themeName : 'light-mode';
    localStorage.setItem('theme', validTheme);
    document.documentElement.className = validTheme; // Apply to HTML element
    console.log("Theme set to:", validTheme, "on HTML element");
    updateToggleIcon(); // Update icon based on the new theme
    // Only update particles if the function exists (might not on game pages if this script was loaded there)
    if (typeof updateParticles === 'function') {
        updateParticles();
    } else {
        console.log("updateParticles function not found, skipping particle update.");
    }
}

function toggleTheme() {
    // Read the current theme from the HTML element class or localStorage as fallback
    const currentTheme = document.documentElement.className || localStorage.getItem('theme');
    if (currentTheme === 'dark-mode') {
        setTheme('light-mode');
    } else {
        setTheme('dark-mode');
    }
}

function loadTheme() {
    const theme = localStorage.getItem('theme');
    let appliedTheme = '';
    // Check if a valid theme is stored
    if (theme === 'dark-mode' || theme === 'light-mode') {
        // Apply the theme class to the HTML element
        // Note: The <head> script should have already done this,
        // but we ensure consistency here.
        if (document.documentElement.className !== theme) {
             document.documentElement.className = theme;
             console.log("loadTheme corrected HTML class to:", theme);
        } else {
             console.log("loadTheme confirmed HTML class is:", theme);
        }
        appliedTheme = theme;
    } else {
        // If no valid theme in localStorage, check system preference
        const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        appliedTheme = prefersDarkScheme ? 'dark-mode' : 'light-mode';
        console.log("No valid saved theme, applying system preference:", appliedTheme);
        // Use setTheme to apply class, save preference, and update UI elements
        setTheme(appliedTheme);
        return; // setTheme handles further updates, so exit
    }

    // If we reached here, a theme was loaded from localStorage by the <head> script or this function.
    // Now, ensure UI elements dependent on the theme are updated.
    // These need the DOM to be ready, which is guaranteed as loadTheme is called in DOMContentLoaded.
    updateToggleIcon();
    if (typeof updateParticles === 'function') {
        // Check if particlesJS is ready before updating
        if (typeof particlesJS !== 'undefined') {
            updateParticles();
        } else {
            console.warn("loadTheme: particlesJS not ready yet for updateParticles.");
            // Attempt to update particles after a short delay as a fallback
            // setTimeout(updateParticles, 200);
        }
    }
}


function updateToggleIcon() {
    // Read theme from the HTML element class for most accurate current state
    const currentTheme = document.documentElement.className;
    const toggleIcon = document.getElementById('toggle-icon');
    if (!toggleIcon) {
        // console.log("Toggle icon not found on this page.");
        return; // Exit if icon element doesn't exist
    }

    // Determine the correct icon based on the current theme class
    if (currentTheme === 'dark-mode') {
        // Sun icon for switching to light mode
        toggleIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" class="feather feather-sun">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>`;
    } else {
        // Moon icon for switching to dark mode
        toggleIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" class="feather feather-moon">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>`;
    }
    // Style the SVG element
    const svgElement = toggleIcon.querySelector('svg');
    if (svgElement) {
        svgElement.style.width = '100%';
        svgElement.style.height = '100%';
        // Set stroke color based on the theme applied to the HTML element
        svgElement.style.stroke = currentTheme === 'dark-mode' ? '#aaa' : '#555';
        svgElement.style.transition = 'stroke 0.3s ease';
    }
    toggleIcon.style.display = 'flex';
    toggleIcon.style.alignItems = 'center';
    toggleIcon.style.justifyContent = 'center';
}


// Particle management
function updateParticles() {
    // Read theme from HTML element class, default to light-mode
    const theme = document.documentElement.className || 'light-mode';
    const particleColor = theme === 'dark-mode' ? '#ffffff' : '#333333';
    const lineColor = theme === 'dark-mode' ? '#ffffff' : '#555555';

    if (typeof particlesJS === 'undefined') {
        console.warn("particlesJS not loaded yet for updateParticles");
        return;
    }

    // Check if particles.js instance exists on the target element
    const particlesElement = document.getElementById('particles-js');
    if (!particlesElement) {
         console.warn("Element with ID 'particles-js' not found for updateParticles.");
         return; // Don't proceed if the element isn't there
    }

    // Use pJSDom array which particles.js v2 populates
    if (window.pJSDom && window.pJSDom[0] && window.pJSDom[0].pJS) {
        console.log("Destroying existing particles instance for update.");
        window.pJSDom[0].pJS.fn.vendors.destroypJS();
        window.pJSDom = []; // Reset the array is important
    } else {
        console.log("No existing particles instance found, initializing fresh.");
    }

    // Re-initialize particles.js
    console.log("Initializing particlesJS with color:", particleColor);
    particlesJS('particles-js', {
        "particles": {
            "number": { "value": 50, "density": { "enable": true, "value_area": 800 } },
            "color": { "value": particleColor },
            "shape": { "type": "circle" },
            "opacity": { "value": 0.6, "random": true },
            "size": { "value": 3, "random": true },
            "line_linked": { "enable": true, "distance": 150, "color": lineColor, "opacity": 0.4, "width": 1 },
            "move": { "enable": true, "speed": 4, "direction": "none", "random": false, "straight": false, "out_mode": "out" }
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": true, "mode": "push" }, "resize": true },
            "modes": { "grab": { "distance": 140, "line_linked": { "opacity": 1 } }, "push": { "particles_nb": 4 } }
        },
        "retina_detect": true
    }, function() {
      console.log('particles.js config reloaded for theme update');
    });
}


// Loading overlay for first visit
function showLoadingOverlayIfNeeded() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;

    const images = Array.from(document.images);
    const imagesPending = images.some(img => !img.complete);

    if (!imagesPending) {
        overlay.remove();
        return;
    }

    overlay.style.display = 'flex';

    const hideOverlay = () => {
        overlay.classList.add('fade-out');
    };

    window.addEventListener('load', hideOverlay);
    overlay.addEventListener('transitionend', () => overlay.remove());
}

// Countdown timer functions
let countdownInterval = null;

function setCountdownDate() {
    const dateInputElement = document.getElementById('dateInput');
    if (dateInputElement) {
        const dateInput = dateInputElement.value;
        if (dateInput) {
            localStorage.setItem('countdownDate', dateInput);
            startCountdown(dateInput);
        }
    } else {
         console.warn("dateInput element not found for countdown.");
    }
}

function startCountdown(date) {
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) {
        // console.warn("countdown element not found."); // Less noisy log
        return;
    }

    // Ensure date string includes time part for accurate parsing, assume start of day
    const targetDate = new Date(date + "T00:00:00").getTime();

    if (isNaN(targetDate)) {
        countdownElement.innerText = "Invalid Date Format";
        clearInterval(countdownInterval); // Stop timer if date is invalid
        return;
    }

    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const updateTimer = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            countdownElement.innerText = "The date has passed!";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const targetDateObj = new Date(targetDate); // Create date object for formatting
        countdownElement.innerText = `${days}d ${hours}h ${minutes}m ${seconds}s until ${targetDateObj.toLocaleDateString()}`;
    };

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}


// Hamburger Menu for Mobile Navigation
function initializeHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navElement = document.querySelector('nav');

    if (hamburger && navElement) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navElement.classList.toggle('show');
            const expanded = hamburger.classList.contains('active');
            hamburger.setAttribute('aria-expanded', expanded);
        });

        const navLinks = navElement.querySelectorAll('ul li a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768 && navElement.classList.contains('show')) {
                    navElement.classList.remove('show');
                    hamburger.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', false);
                }
                // Smooth scroll handled by initializeSmoothScroll
            });
        });
    } else {
         console.warn("Hamburger or Nav element not found for initialization.");
    }
}


// Initialize Countdown Timer on Load
function initializeCountdown() {
    const dateInputElement = document.getElementById('dateInput');
    const countdownElement = document.getElementById('countdown');

    if (dateInputElement && countdownElement) {
        const savedDate = localStorage.getItem('countdownDate');
        if (savedDate) {
            dateInputElement.value = savedDate;
            startCountdown(savedDate);
        } else {
             countdownElement.innerText = "Set a date to count down to!";
        }

        const setDateButton = dateInputElement.nextElementSibling;
        if (setDateButton && setDateButton.tagName === 'BUTTON') {
            // Ensure listener isn't added multiple times if script re-runs
            if (!setDateButton.hasAttribute('data-listener-added')) {
                 setDateButton.addEventListener('click', setCountdownDate);
                 setDateButton.setAttribute('data-listener-added', 'true');
            }
        } else {
             console.warn("Could not find button next to date input to attach listener.");
        }

        try {
            const todayStr = new Date().toISOString().split('T')[0];
            dateInputElement.min = todayStr;
        } catch (e) { console.error("Error setting min date:", e)}

    } else {
        // console.log("Countdown elements not found on this page."); // Less noisy
    }
}


// Smooth Scrolling
function initializeSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
         // Check if listener already exists
         if (anchor.hasAttribute('data-scroll-listener')) return;

        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href.length > 1 && href !== '#') {
                // Try finding element by ID
                let targetElement = null;
                try {
                    targetElement = document.querySelector(href);
                } catch (error) {
                    console.warn(`Invalid selector for smooth scroll: ${href}`, error);
                    return; // Exit if selector is invalid
                }


                if (targetElement) {
                    e.preventDefault();

                    const headerOffset = document.querySelector('header')?.offsetHeight || 70;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: "smooth"
                    });

                    const hamburger = document.querySelector('.hamburger');
                    const navElement = document.querySelector('nav');
                     if (hamburger && navElement && navElement.classList.contains('show')) {
                         hamburger.classList.remove('active');
                         navElement.classList.remove('show');
                         hamburger.setAttribute('aria-expanded', 'false');
                     }
                } else {
                    console.warn(`Smooth scroll target not found for href: ${href}`);
                }
            }
        });
        anchor.setAttribute('data-scroll-listener', 'true'); // Mark as listener added
    });
}


// On DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");
    loadTheme(); // Load theme and update UI elements like icon
    showLoadingOverlayIfNeeded();

    // Initialize other components
    initializeHamburgerMenu();
    initializeCountdown();
    initializeSmoothScroll();

    // Wiki/Graph initialization (if they exist)
    if (typeof initializeWiki === 'function') {
        initializeWiki();
    } else {
        // console.log("initializeWiki function not found.");
    }
    if (typeof initializeGraph === 'function') {
        initializeGraph();
    } else {
         // console.log("initializeGraph function not found.");
    }

    // Particles.js initialization is handled by its own script tag and callback
    // which should call updateParticles() if needed after loadTheme runs.
    // If particlesJS loads *after* DOMContentLoaded, loadTheme might call updateParticles too early.
    // The callback in index.html is the safest place to ensure particles are ready.
    console.log("Initializations complete.");
});