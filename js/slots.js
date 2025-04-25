// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    console.log("slots.js loaded and DOM ready.");

    // --- Get References to HTML Elements ---
    const spinButton = document.getElementById('spin-button');
    const decreaseBetButton = document.getElementById('decrease-bet');
    const increaseBetButton = document.getElementById('increase-bet');
    const currentBetSpan = document.getElementById('current-bet');
    const reelElements = [
        document.getElementById('reel1'),
        document.getElementById('reel2'),
        document.getElementById('reel3')
    ];
    const resultMessage = document.getElementById('result-message');
    const balanceAmountSpan = document.getElementById('balance-amount');

    // --- Game Configuration ---
    const symbols = ['🍒', '🍋', '🍊', '🍉', '⭐', '🔔', '🍀', '💎'];
    const betIncrement = 1;
    const minBet = 1;
    const maxBet = 10;
    const paytableMultipliers3 = {
        '💎': 50, '⭐': 25, '🔔': 15, '🍉': 10, '🍀': 8, '🍊': 5, '🍋': 3, '🍒': 2
    };
    const pairPayouts = {
        '💎': 4, '⭐': 3, '🍒': 1
    };
    const firstReelCherryPayout = 0.5;

    // --- Game State Variables ---
    let balance = 100;
    let currentBet = 1;
    let isSpinning = false;

    // --- Initialization ---
    function initializeSlots() {
        if (!spinButton || !decreaseBetButton || !increaseBetButton || !currentBetSpan ||
            !resultMessage || !balanceAmountSpan || reelElements.some(reel => !reel)) {
            console.error("One or more essential slot elements not found!");
            if(resultMessage) resultMessage.textContent = "Error: Missing game elements.";
            if(spinButton) spinButton.disabled = true;
            if(decreaseBetButton) decreaseBetButton.disabled = true;
            if(increaseBetButton) increaseBetButton.disabled = true;
            return;
        }
        updateBalanceDisplay();
        updateBetDisplay();
        updateBetButtons();
        resultMessage.textContent = 'Adjust your bet and press Spin.';
        spinButton.disabled = false;
        spinButton.addEventListener('click', handleSpin);
        decreaseBetButton.addEventListener('click', decreaseBet);
        increaseBetButton.addEventListener('click', increaseBet);
        console.log("Slot machine initialized.");
    }

    // --- Betting Functions ---
    function decreaseBet() {
        if (currentBet > minBet) {
            currentBet -= betIncrement;
            updateBetDisplay(); updateBetButtons();
        }
    }
    function increaseBet() {
        if (currentBet < maxBet) {
            currentBet += betIncrement;
            updateBetDisplay(); updateBetButtons();
        }
    }
    function updateBetDisplay() { currentBetSpan.textContent = currentBet; }
    function updateBetButtons() {
        decreaseBetButton.disabled = (currentBet <= minBet);
        increaseBetButton.disabled = (currentBet >= maxBet);
    }

    // --- Core Game Functions ---
    function handleSpin() {
        if (isSpinning) return;
        if (balance < currentBet) {
            resultMessage.textContent = "Not enough balance!"; return;
        }
        isSpinning = true;
        spinButton.disabled = true;
        decreaseBetButton.disabled = true;
        increaseBetButton.disabled = true;
        resultMessage.textContent = 'Spinning...';
        clearWinHighlight(); // ADDED BACK CALL

        balance -= currentBet;
        updateBalanceDisplay();

        let spinCycles = 0;
        const maxCycles = 15;
        const cycleInterval = 80;
        const spinInterval = setInterval(() => {
            reelElements.forEach(reel => { reel.textContent = getRandomSymbol(); });
            spinCycles++;
            if (spinCycles >= maxCycles) {
                clearInterval(spinInterval);
                determineResult();
            }
        }, cycleInterval);
    }

    function getRandomSymbol() {
        return symbols[Math.floor(Math.random() * symbols.length)];
    }

    // --- Determine Result (Highlighting Restored) ---
    function determineResult() {
        const finalSymbols = reelElements.map(reel => {
            const symbol = getRandomSymbol();
            reel.textContent = symbol;
            return symbol;
        });
        console.log("Final Symbols:", finalSymbols);

        let totalWinAmount = 0;
        let winMessages = [];
        let winningReelIndices = new Set(); // ADDED BACK Set

        // --- Check Win Lines ---
        checkLineWin(finalSymbols, [0, 1, 2]); // Center
        checkLineWin(finalSymbols, [0, 1, 2], true); // Diagonal TL-BR
        checkLineWin(finalSymbols, [0, 1, 2], true, true); // Diagonal TR-BL

        // --- Check for Pairs ---
        const counts = {};
        finalSymbols.forEach(symbol => { counts[symbol] = (counts[symbol] || 0) + 1; });
        for (const symbol in pairPayouts) {
            if (counts[symbol] === 2) {
                const alreadyWonWithTriple = winMessages.some(msg => msg.includes(`${symbol}${symbol}${symbol}`));
                if (!alreadyWonWithTriple) {
                    const pairWin = currentBet * pairPayouts[symbol];
                    totalWinAmount += pairWin;
                    winMessages.push(`Two ${symbol} = +$${pairWin}`);
                    // ADDED BACK: Add indices for highlighting pairs
                    finalSymbols.forEach((s, index) => {
                        if (s === symbol) {
                            winningReelIndices.add(index);
                        }
                    });
                }
            }
        }

        // --- Check for Single Cherry on First Reel ---
        if (finalSymbols[0] === '🍒' && firstReelCherryPayout > 0) {
             const alreadyWonWithCherries = winMessages.some(msg => msg.includes('🍒'));
             if (!alreadyWonWithCherries) {
                 const cherryWin = Math.max(1, Math.floor(currentBet * firstReelCherryPayout));
                 totalWinAmount += cherryWin;
                 winMessages.push(`First Reel 🍒 = +$${cherryWin}`);
                 winningReelIndices.add(0); // ADDED BACK: Highlight first reel
             }
        }

        // --- Helper function to check a line ---
        function checkLineWin(symbols, indices, isDiagonal = false, isReverseDiagonal = false) {
            let s1, s2, s3;
            let actualIndices = indices; // Default to center indices
            if (isDiagonal) {
                 if (isReverseDiagonal) {
                     s1 = symbols[2]; s2 = symbols[1]; s3 = symbols[0];
                     actualIndices = [2, 1, 0]; // Indices involved in this diagonal
                 } else {
                     s1 = symbols[0]; s2 = symbols[1]; s3 = symbols[2];
                     actualIndices = [0, 1, 2]; // Indices involved in this diagonal
                 }
            } else {
                 s1 = symbols[indices[0]]; s2 = symbols[indices[1]]; s3 = symbols[indices[2]];
            }

            if (s1 === s2 && s2 === s3) {
                const symbol = s1;
                if (paytableMultipliers3[symbol]) {
                    const lineWin = currentBet * paytableMultipliers3[symbol];
                    totalWinAmount += lineWin;
                    let lineName = isDiagonal ? (isReverseDiagonal ? "Diagonal↘" : "Diagonal↙") : "Center";
                    winMessages.push(`${lineName} ${symbol}${symbol}${symbol} = +$${lineWin}`);
                    // ADDED BACK: Add indices for highlighting lines
                    actualIndices.forEach(i => winningReelIndices.add(i));
                }
            }
        }

        // --- Final Update ---
        if (totalWinAmount > 0) {
            balance += totalWinAmount;
            resultMessage.innerHTML = winMessages.join('<br>');
            highlightWin(Array.from(winningReelIndices)); // ADDED BACK CALL
        } else {
            resultMessage.textContent = `Try Again! [${finalSymbols.join(' ')}]`;
        }

        updateBalanceDisplay();
        isSpinning = false;
        spinButton.disabled = false;
        updateBetButtons();
    }

    // --- START: Added back highlight functions ---
    function highlightWin(reelIndices) {
        reelIndices.forEach(index => {
            if (reelElements[index]) {
                reelElements[index].classList.add('reel-win');
            }
        });
    }

    function clearWinHighlight() {
        reelElements.forEach(reel => {
            reel.classList.remove('reel-win');
        });
    }
    // --- END: Added back highlight functions ---


    function updateBalanceDisplay() {
        balanceAmountSpan.textContent = balance;
        if (balance <= 0 && !isSpinning) {
             resultMessage.textContent = "Game Over! No balance left.";
             spinButton.disabled = true;
             decreaseBetButton.disabled = true;
             increaseBetButton.disabled = true;
        }
    }

    // --- Start the Game ---
    initializeSlots();

}); // End DOMContentLoaded