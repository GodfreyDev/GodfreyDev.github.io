// # js/wiki.js

// CORS Proxy to bypass CORS restrictions
const corsProxy = 'https://cors-anywhere.herokuapp.com/';

// Mapping of wiki pages to their Google Drive download URLs
const wikiFiles = {
    "Home": "https://drive.google.com/uc?export=download&id=FILE_ID_1",
    "Getting Started": "https://drive.google.com/uc?export=download&id=FILE_ID_2",
    "Project 1": "https://drive.google.com/uc?export=download&id=FILE_ID_3",
    "Tutorials": {
        "Tutorial 1": "https://drive.google.com/uc?export=download&id=FILE_ID_4",
        "Tutorial 2": "https://drive.google.com/uc?export=download&id=FILE_ID_5"
    }
};

// Function to fetch and render markdown content
async function fetchAndRenderMarkdown(url, containerId, linkElement = null) {
    try {
        const response = await fetch(corsProxy + url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const markdown = await response.text();
        const rawHtml = marked.parse(markdown);
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);
        document.getElementById(containerId).innerHTML = sanitizedHtml;
        // Remove 'active' class from all links
        document.querySelectorAll('#wiki-navigation a').forEach(a => a.classList.remove('active'));
        // Add 'active' class to the current link
        if (linkElement) {
            linkElement.classList.add('active');
        }
    } catch (error) {
        console.error('Error fetching markdown:', error);
        document.getElementById(containerId).innerHTML = '<p>Error loading content.</p>';
    }
}

// Function to build navigation based on wikiFiles
function buildWikiNavigation(wikiObj, parentElement) {
    const ul = document.createElement('ul');

    for (const [key, value] of Object.entries(wikiObj)) {
        const li = document.createElement('li');
        if (typeof value === 'string') {
            const a = document.createElement('a');
            a.href = "#";
            a.textContent = key;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                fetchAndRenderMarkdown(value, 'wiki-content', a);
            });
            li.appendChild(a);
        } else if (typeof value === 'object') {
            const span = document.createElement('span');
            span.textContent = key;
            li.appendChild(span);
            buildWikiNavigation(value, li); // Recursive call for nested items
        }
        ul.appendChild(li);
    }

    parentElement.appendChild(ul);
}

// Initialize the wiki (called from main.js)
function initializeWiki() {
    const navContainer = document.getElementById('wiki-navigation');
    if (!navContainer) return;
    buildWikiNavigation(wikiFiles, navContainer);
    // Load the Home page by default
    fetchAndRenderMarkdown(wikiFiles["Home"], 'wiki-content', null);
}
