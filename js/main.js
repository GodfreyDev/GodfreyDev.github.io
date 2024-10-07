// Theme Toggle Functionality
function setTheme(themeName) {
    localStorage.setItem('theme', themeName);
    document.body.className = themeName;
    updateToggleIcon();
    updateParticles();
}

function toggleTheme() {
    if (localStorage.getItem('theme') === 'dark-mode') {
        setTheme('light-mode');
    } else {
        setTheme('dark-mode');
    }
}

function loadTheme() {
    if (localStorage.getItem('theme')) {
        document.body.className = localStorage.getItem('theme');
    } else {
        const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setTheme(prefersDarkScheme ? 'dark-mode' : 'light-mode');
    }
    updateToggleIcon();
}

function updateToggleIcon() {
    const theme = localStorage.getItem('theme');
    const toggleIcon = document.getElementById('toggle-icon');
    if (theme === 'dark-mode') {
        // Sun icon (white) for dark mode
        toggleIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>`; // Sun icon
    } else {
        // Moon icon (black) for light mode
        toggleIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3a7.5 7.5 0 009.79 9.79z"></path>
            </svg>`; // Moon icon
    }
}

function updateParticles() {
    const particleColor = localStorage.getItem('theme') === 'dark-mode' ? '#ffffff' : '#333333';

    // Destroy existing particles instance before reloading
    if (window.pJSDom && window.pJSDom.length > 0) {
        window.pJSDom[0].pJS.fn.vendors.destroy();
        window.pJSDom = [];
    }

    particlesJS('particles-js', {
        "particles": {
            "number": {
                "value": 50,
                "density": {
                    "enable": true,
                    "value_area": 800
                }
            },
            "color": {
                "value": particleColor
            },
            "shape": {
                "type": "circle",
                "stroke": {
                    "width": 0,
                    "color": "#000000"
                },
                "polygon": {
                    "nb_sides": 5
                }
            },
            "opacity": {
                "value": 0.5,
                "random": false,
                "anim": {
                    "enable": false,
                    "speed": 1,
                    "opacity_min": 0.1,
                    "sync": false
                }
            },
            "size": {
                "value": 3,
                "random": true,
                "anim": {
                    "enable": false,
                    "speed": 40,
                    "size_min": 0.1,
                    "sync": false
                }
            },
            "line_linked": {
                "enable": true,
                "distance": 150,
                "color": particleColor,
                "opacity": 0.4,
                "width": 1
            },
            "move": {
                "enable": true,
                "speed": 6,
                "direction": "none",
                "random": false,
                "straight": false,
                "out_mode": "out",
                "bounce": false,
                "attract": {
                    "enable": false,
                    "rotateX": 600,
                    "rotateY": 1200
                }
            }
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": {
                "onhover": {
                    "enable": true,
                    "mode": "grab"
                },
                "onclick": {
                    "enable": true,
                    "mode": "push"
                },
                "resize": true
            },
            "modes": {
                "grab": {
                    "distance": 140,
                    "line_linked": {
                        "opacity": 1
                    }
                },
                "bubble": {
                    "distance": 400,
                    "size": 40,
                    "duration": 2,
                    "opacity": 8,
                    "speed": 3
                },
                "repulse": {
                    "distance": 200,
                    "duration": 0.4
                },
                "push": {
                    "particles_nb": 4
                },
                "remove": {
                    "particles_nb": 2
                }
            }
        },
        "retina_detect": true
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    updateParticles();
    initializeHamburgerMenu();
    initializeCountdown();
});

// Initialize Countdown Timer
function setCountdownDate() {
    const input = document.getElementById('dateInput').value;
    const countdown = document.getElementById('countdown');
    if (input) {
        const targetDate = new Date(input).getTime();
        if (isNaN(targetDate)) {
            countdown.innerHTML = "Invalid Date!";
            return;
        }
        localStorage.setItem('countdownDate', targetDate);
        updateCountdown(targetDate);
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => updateCountdown(targetDate), 1000);
    }
}

function updateCountdown(targetDate) {
    const countdown = document.getElementById('countdown');
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance < 0) {
        countdown.innerHTML = "The event has started!";
        clearInterval(countdownInterval);
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdown.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

let countdownInterval;

function initializeCountdown() {
    const savedDate = localStorage.getItem('countdownDate');
    if (savedDate) {
        updateCountdown(parseInt(savedDate));
        countdownInterval = setInterval(() => updateCountdown(parseInt(savedDate)), 1000);
    }
}

// Initialize Hamburger Menu for Mobile Navigation
function initializeHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('nav ul');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('show');
        const expanded = hamburger.classList.contains('active');
        hamburger.setAttribute('aria-expanded', expanded);
    });

    // Close the menu when a link is clicked
    const navLinks = document.querySelectorAll('nav ul li a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu.classList.contains('show')) {
                navMenu.classList.remove('show');
                hamburger.classList.remove('active');
                hamburger.setAttribute('aria-expanded', false);
            }
        });
    });
}
