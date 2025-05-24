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

// Function to extract links from markdown (for graph)
function extractLinks(markdown) {
    const linkPattern = /\[\[([^\]]+)\]\]/g;
    let match;
    const links = [];
    while ((match = linkPattern.exec(markdown)) !== null) {
        links.push(match[1]);
    }
    return links;
}

// Function to build graph data
async function buildGraphData() {
    const nodes = new Set();
    const edges = [];

    for (const [key, value] of Object.entries(wikiFiles)) {
        if (typeof value === 'string') {
            nodes.add(key);
            try {
                const response = await fetch(corsProxy + value);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const markdown = await response.text();
                const links = extractLinks(markdown);
                links.forEach(link => {
                    nodes.add(link);
                    edges.push({ from: key, to: link });
                });
            } catch (error) {
                console.error(`Error fetching markdown for ${key}:`, error);
            }
        } else if (typeof value === 'object') {
            for (const [subKey, subValue] of Object.entries(value)) {
                nodes.add(subKey);
                try {
                    const response = await fetch(corsProxy + subValue);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const markdown = await response.text();
                    const links = extractLinks(markdown);
                    links.forEach(link => {
                        nodes.add(link);
                        edges.push({ from: subKey, to: link });
                    });
                } catch (error) {
                    console.error(`Error fetching markdown for ${subKey}:`, error);
                }
            }
        }
    }

    // Convert nodes to array of objects
    const nodesArray = Array.from(nodes).map(node => ({ id: node, label: node }));

    return { nodes: nodesArray, edges: edges };
}

// Function to render graph
async function renderGraph() {
    const graphData = await buildGraphData();

    const container = document.getElementById('graph-container');
    const data = {
        nodes: new vis.DataSet(graphData.nodes),
        edges: new vis.DataSet(graphData.edges)
    };
    const options = {
        layout: {
            improvedLayout: true
        },
        physics: {
            stabilization: false
        },
        interaction: {
            navigationButtons: true,
            keyboard: true
        }
    };
    const network = new vis.Network(container, data, options);

    // Handle node clicks to display content
    network.on("click", function (params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            if (wikiFiles[nodeId]) {
                // Direct link
                fetchAndRenderMarkdown(wikiFiles[nodeId], 'wiki-content', null);
            } else {
                // Possibly in nested objects
                let found = false;
                for (const [key, value] of Object.entries(wikiFiles)) {
                    if (typeof value === 'object' && value[nodeId]) {
                        fetchAndRenderMarkdown(value[nodeId], 'wiki-content', null);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    document.getElementById('wiki-content').innerHTML = '<p>Page not found.</p>';
                }
            }
        }
    });
}

// Initialize the wiki on page load
document.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.getElementById('wiki-navigation');
    buildWikiNavigation(wikiFiles, navContainer);
    // Load the Home page by default
    fetchAndRenderMarkdown(wikiFiles["Home"], 'wiki-content', null);
    // Render the graph
    renderGraph();
});
