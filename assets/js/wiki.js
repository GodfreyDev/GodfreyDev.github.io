// # js/wiki.js

// Mapping of wiki pages to local markdown files
const wikiFiles = {
    "Home": "wiki/Home.md",
    "Getting Started": "wiki/Getting_Started.md",
    "Project 1": "wiki/Project1.md",
    "Tutorials": {
        "Tutorial 1": "wiki/Tutorials/Tutorial1.md",
        "Tutorial 2": "wiki/Tutorials/Tutorial2.md"
    }
};

// Function to fetch and render markdown content
async function fetchAndRenderMarkdown(url, containerId, linkElement = null) {
    try {
        const response = await fetch(url);
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
