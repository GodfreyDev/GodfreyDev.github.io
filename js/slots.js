document.addEventListener('DOMContentLoaded', () => {
    console.log("slots.js 5x3 Free Spin Fix loaded.");

    // --- Get References ---
    // ... (same as before) ...
    const spinButton = document.getElementById('spin-button');
    const decreaseLevelButton = document.getElementById('decrease-level');
    const increaseLevelButton = document.getElementById('increase-level');
    const decreaseCoinButton = document.getElementById('decrease-coin');
    const increaseCoinButton = document.getElementById('increase-coin');
    const betLevelDisplay = document.getElementById('bet-level-display');
    const coinValueDisplay = document.getElementById('coin-value-display');
    const activeLinesDisplay = document.getElementById('active-lines-display');
    const betPerLineDisplay = document.getElementById('bet-per-line-display');
    // spinCostDisplay is inside spinButton now
    const slotMachineGrid = document.getElementById('slot-machine');
    const resultMessage = document.getElementById('result-message');
    const balanceAmountSpan = document.getElementById('balance-amount');
    const freeSpinsDisplay = document.getElementById('free-spins-display');
    const freeSpinsCountSpan = document.getElementById('free-spins-count');
    const stopButtons = [];
    for (let i = 0; i < 5; i++) { stopButtons.push(document.getElementById(`stop-reel-${i}`)); }


    // --- Game Configuration ---
    // ... (same symbols, weights, payouts, etc. as before) ...
    const ROWS = 3; const COLS = 5;
    const WILD_SYMBOL = 'Images/shield.png'; const SCATTER_SYMBOL = 'Images/dragon.png'; const BONUS_SYMBOL = 'Images/chest.png'; // Use actual image path
    const weightedSymbols = [ { src: 'Images/map_scroll.png', weight: 10 }, { src: 'Images/coin.png', weight: 10 }, { src: 'Images/map_scroll.png', weight: 10 }, { src: 'Images/mana_potion.png', weight: 9 }, { src: 'Images/key.png', weight: 9 }, { src: 'Images/health_potion.png', weight: 8 }, { src: 'Images/axe.png', weight: 7 }, { src: 'Images/staff.png', weight: 6 }, { src: 'Images/ring.png', weight: 6 }, { src: 'Images/gem.png', weight: 4 }, { src: WILD_SYMBOL, weight: 3 }, { src: 'Images/sword2.png', weight: 2 }, { src: SCATTER_SYMBOL, weight: 8 }, { src: BONUS_SYMBOL, weight: 3 } ]; // Scatter weight increased
    const imageAltText = { 'Images/map_scroll.png': 'Map/Scroll', 'Images/coin.png': 'Coin', 'Images/mana_potion.png': 'MP Potion', 'Images/key.png': 'Key', 'Images/health_potion.png': 'HP Potion', 'Images/axe.png': 'Axe', 'Images/staff.png': 'Staff', 'Images/ring.png': 'Ring', 'Images/gem.png': 'Gem', 'Images/shield.png': 'WILD Shield', 'Images/sword2.png': 'Sword', 'Images/dragon.png': 'Dragon Scatter', 'Images/chest.png': 'Chest Bonus' };
    const symbols = weightedSymbols.map(s => s.src);
    const weightedPool = []; weightedSymbols.forEach(s => { for (let i = 0; i < s.weight; i++) weightedPool.push(s.src); });
    const coinValues = [0.01, 0.05, 0.10, 0.25, 0.50, 1.00, 2.00, 5.00];
    const betLevels = [ { level: 1, linesActive: 5, linesIndices: [0, 1, 2, 3, 4], costMultiplier: 5 }, { level: 2, linesActive: 9, linesIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8], costMultiplier: 9 }, { level: 3, linesActive: 15, linesIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], costMultiplier: 15 } ];
    const maxBetLevelIndex = betLevels.length - 1; const maxCoinValueIndex = coinValues.length - 1;
    const paytableMultipliers = { 'Images/sword2.png': [20, 60, 150], 'Images/shield.png': [0, 0, 250], 'Images/gem.png': [15, 45, 125], 'Images/ring.png': [10, 30, 100], 'Images/staff.png': [8, 20, 75], 'Images/axe.png': [6, 18, 60], 'Images/health_potion.png': [5, 15, 40], 'Images/key.png': [4, 10, 30], 'Images/mana_potion.png': [3, 8, 20], 'Images/coin.png': [1, 4, 10], 'Images/map_scroll.png': [1, 3, 8], 'Images/dragon.png': [0, 0, 0], 'Images/chest.png': [0, 0, 0] };
    const scatterPayouts = { 3: 2, 4: 8, 5: 40 };
    const FREE_SPINS_AWARDED = 10; const FREE_SPINS_MULTIPLIER = 2;
    const AUTO_SPIN_DELAY = 300; // Increased delay slightly for visibility
    const paylines = [ [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2] ];

    // --- Game State Variables ---
    let balance = 100; let currentBetLevelIndex = 0; let currentCoinValueIndex = 2;
    let isSpinning = false; let reelSpinState = [false, false, false, false, false];
    let gridCells = []; let finalGridSymbols = [];
    let freeSpinsRemaining = 0; let autoSpinTimeout = null;
    let animationFrameId = null;

    // --- Initialization ---
    function initializeSlots() { /* ... same ... */
        if (!slotMachineGrid || !spinButton || /* ... other checks ... */ stopButtons.some(b => !b)) { console.error("Init failed: Missing elements."); return; }
        createGridCells(); preloadImages();
        gridCells.forEach(cell => { const s = 'Images/map_scroll.png'; cell.innerHTML = `<img src="${s}" alt="${imageAltText[s] || 'S'}" class="reel-img">`; });
        updateBalanceDisplay(); updateBettingInfo(); updateButtonStates();
        resultMessage.textContent = 'Select Bet Level/Coin Value and Spin.';
        spinButton.addEventListener('click', handleSpinStopClick);
        stopButtons.forEach((button, index) => { button.addEventListener('click', () => handleIndividualStop(index)); });
        decreaseLevelButton.addEventListener('click', decreaseBetLevel); increaseLevelButton.addEventListener('click', increaseBetLevel);
        decreaseCoinButton.addEventListener('click', decreaseCoinValue); increaseCoinButton.addEventListener('click', increaseCoinValue);
        console.log("5x3 Slot machine initialized (Free Spin Fix).");
    }
    function createGridCells() { gridCells = []; for(let r=0;r<ROWS;r++){for(let c=0;c<COLS;c++){const cell=document.getElementById(`cell-${r}-${c}`); if(!cell)console.error(`Cell cell-${r}-${c} not found!`); gridCells.push(cell);}}}
    function preloadImages() { symbols.forEach(src => { if (!src.includes('/')) return; const img = new Image(); img.src = src; }); console.log("RPG Images preloading..."); }

    // --- Betting Functions ---
    function decreaseBetLevel() { if (currentBetLevelIndex > 0 && !isSpinning && freeSpinsRemaining <= 0) { currentBetLevelIndex--; updateBettingInfo(); updateButtonStates(); } }
    function increaseBetLevel() { if (currentBetLevelIndex < maxBetLevelIndex && !isSpinning && freeSpinsRemaining <= 0) { currentBetLevelIndex++; updateBettingInfo(); updateButtonStates(); } }
    function decreaseCoinValue() { if (currentCoinValueIndex > 0 && !isSpinning && freeSpinsRemaining <= 0) { currentCoinValueIndex--; updateBettingInfo(); updateButtonStates(); } }
    function increaseCoinValue() { if (currentCoinValueIndex < maxCoinValueIndex && !isSpinning && freeSpinsRemaining <= 0) { currentCoinValueIndex++; updateBettingInfo(); updateButtonStates(); } }

    // --- Update Betting Info Display ---
    function updateBettingInfo() { /* ... same ... */
        const levelInfo = betLevels[currentBetLevelIndex]; const coinValue = coinValues[currentCoinValueIndex];
        const totalCost = levelInfo.costMultiplier * coinValue; const linesActive = levelInfo.linesActive;
        const betPerLine = linesActive > 0 ? totalCost / linesActive : 0;
        betLevelDisplay.textContent = levelInfo.level; coinValueDisplay.textContent = coinValue.toFixed(2);
        activeLinesDisplay.textContent = linesActive; betPerLineDisplay.textContent = betPerLine.toFixed(2);
        const spinCostSpan = spinButton.querySelector('#spin-cost-display');
        if (spinCostSpan) spinCostSpan.textContent = `$${totalCost.toFixed(2)}`;
        highlightActivePaylines(levelInfo.linesIndices);
    }
    function highlightActivePaylines(activeIndices) { /* ... same ... */ for(let i=0;i<betLevels.length;i++){const p=document.getElementById(`payline-desc-L${i+1}`);if(p)p.classList.remove('active-payline-desc');} activeIndices.forEach(i=>{const p=document.getElementById(`payline-desc-L${i+1}`);if(p)p.classList.add('active-payline-desc');}); }
    function getCurrentSpinCost() { return betLevels[currentBetLevelIndex].costMultiplier * coinValues[currentCoinValueIndex]; }
    function getActivePaylineIndices() { return betLevels[currentBetLevelIndex].linesIndices; }
    function getCoinValue() { return coinValues[currentCoinValueIndex]; }

    // --- Weighted Random Symbol ---
    function getRandomSymbolWeighted() { if (weightedPool.length === 0) return symbols[0]; const i = Math.floor(Math.random() * weightedPool.length); return weightedPool[i]; }

    // --- Consolidated Button State Management ---
    function updateButtonStates() { /* ... same as previous ... */
        const canControlBets = !isSpinning && freeSpinsRemaining <= 0; const totalCost = getCurrentSpinCost(); const canAffordSpin = balance >= totalCost || freeSpinsRemaining > 0;
        spinButton.innerHTML = isSpinning ? `Stop All` : `Spin <span id="spin-cost-display">$${totalCost.toFixed(2)}</span>`;
        spinButton.disabled = (!isSpinning && !canAffordSpin) || (isSpinning && freeSpinsRemaining > 0 && autoSpinTimeout !== null); spinButton.setAttribute('aria-disabled', spinButton.disabled);
        decreaseLevelButton.disabled = (currentBetLevelIndex === 0) || !canControlBets; increaseLevelButton.disabled = (currentBetLevelIndex === maxBetLevelIndex) || !canControlBets;
        decreaseLevelButton.setAttribute('aria-disabled', decreaseLevelButton.disabled); increaseLevelButton.setAttribute('aria-disabled', increaseLevelButton.disabled);
        decreaseCoinButton.disabled = (currentCoinValueIndex === 0) || !canControlBets; increaseCoinButton.disabled = (currentCoinValueIndex === maxCoinValueIndex) || !canControlBets;
        decreaseCoinButton.setAttribute('aria-disabled', decreaseCoinButton.disabled); increaseCoinButton.setAttribute('aria-disabled', increaseCoinButton.disabled);
        stopButtons.forEach((btn, index) => { btn.disabled = !isSpinning || !reelSpinState[index]; btn.setAttribute('aria-disabled', btn.disabled); });
    }

    // --- Spin/Stop Logic ---
    function handleSpinStopClick() { if (isSpinning) { if (freeSpinsRemaining <= 0 || !autoSpinTimeout) { stopAllReels(); } } else { startSpin(); } }

    // --- Start Spin (Modified for Auto-Spin Check) ---
    function startSpin() {
        const currentCost = getCurrentSpinCost();
        // Prevent starting if already spinning OR if waiting for auto-spin timeout
        if (isSpinning || autoSpinTimeout) {
            console.log("Spin prevented: Already spinning or waiting for auto-spin.");
            return;
        }

        let isFreeSpin = freeSpinsRemaining > 0;
        if (!isFreeSpin && balance < currentCost) { resultMessage.textContent = "Not enough balance!"; updateButtonStates(); return; }

        if (isFreeSpin) {
            // Decrement counter only if it's a free spin being initiated
            freeSpinsRemaining--;
            updateFreeSpinsDisplay();
            resultMessage.textContent = `Free Spin! ${freeSpinsRemaining} left.`;
        } else {
            balance -= currentCost; updateBalanceDisplay(); resultMessage.textContent = 'Starting Spin...';
        }

        isSpinning = true; reelSpinState = [true, true, true, true, true]; clearWinHighlight();
        updateButtonStates(); // Set spinning state UI (disables bets, enables stops, changes main btn text)
        resultMessage.textContent = 'Spinning...';

        finalGridSymbols = []; for (let r = 0; r < ROWS; r++) { finalGridSymbols[r] = []; for (let c = 0; c < COLS; c++) { finalGridSymbols[r][c] = getRandomSymbolWeighted(); } }
        console.log("Pre-calculated Final Grid:", finalGridSymbols.map(row => row.map(src => src.split('/').pop() || src)));

        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(spinAnimationLoop);
        console.log("Spin animation started.");
    }

    function stopAllReels() { /* ... same as previous ... */ if (!isSpinning) return; console.log("Stopping all reels."); if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } isSpinning = false; reelSpinState = [false, false, false, false, false]; for (let c = 0; c < COLS; c++) { revealFinalColumn(c); } calculateWinsAndEndSpin(); }
    function handleIndividualStop(reelIndex) { /* ... same as previous ... */ if (!isSpinning || !reelSpinState[reelIndex]) return; console.log(`Stopping reel ${reelIndex}`); reelSpinState[reelIndex] = false; stopButtons[reelIndex].disabled = true; stopButtons[reelIndex].setAttribute('aria-disabled', 'true'); revealFinalColumn(reelIndex); if (reelSpinState.every(state => !state)) { console.log("All reels stopped individually."); isSpinning = false; if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } calculateWinsAndEndSpin(); } else { updateButtonStates(); } }
    function revealFinalColumn(colIndex) { /* ... same as previous ... */ for (let r = 0; r < ROWS; r++) { const cellIndex = r * COLS + colIndex; const cell = gridCells[cellIndex]; if(cell) { cell.classList.remove('is-spinning'); const symbolSrc = finalGridSymbols[r][colIndex]; const imgElement = cell.querySelector('img'); const altText = imageAltText[symbolSrc] || 'Final'; if (imgElement) { imgElement.src = symbolSrc; imgElement.alt = altText; } else { cell.innerHTML = `<img src="${symbolSrc}" alt="${altText}" class="reel-img">`; } } } }

    // --- Spin Animation Loop ---
    function spinAnimationLoop() { /* ... same as previous ... */
        let stillSpinning = false;
        for (let c = 0; c < COLS; c++) { if (reelSpinState[c]) { stillSpinning = true; for (let r = 0; r < ROWS; r++) { const cellIndex = r * COLS + c; const cell = gridCells[cellIndex]; if (cell) { const randomSymbolSrc = getRandomSymbolWeighted(); const imgElement = cell.querySelector('img'); const altText = imageAltText[randomSymbolSrc] || 'Spinning'; if (imgElement) { imgElement.src = randomSymbolSrc; imgElement.alt = altText; } else { cell.innerHTML = `<img src="${randomSymbolSrc}" alt="${altText}" class="reel-img">`; } cell.classList.add('is-spinning'); } } } }
        if (stillSpinning) { animationFrameId = requestAnimationFrame(spinAnimationLoop); } else { animationFrameId = null; console.warn("Animation loop ended unexpectedly."); }
    }


        // --- Calculate Wins & End Spin ---
        function calculateWinsAndEndSpin() {
            console.log("Calculating wins...");
            // ... (Expanding Wilds logic remains the same) ...
            let finalGridAfterWilds = finalGridSymbols.map(row => [...row]); let wildExpanded = false;
            for (let c = 0; c < COLS; c++) { let wildOnReel = false; for (let r = 0; r < ROWS; r++) { if (finalGridSymbols[r][c] === WILD_SYMBOL) { wildOnReel = true; break; } } if (wildOnReel) { wildExpanded = true; for (let r = 0; r < ROWS; r++) { finalGridAfterWilds[r][c] = WILD_SYMBOL; } } }
            if (wildExpanded) { console.log("Applying expanding wilds visually"); /* ... visual update ... */ for (let r = 0; r < ROWS; r++) { for (let c = 0; c < COLS; c++) { const cellIndex = r * COLS + c; const cell = gridCells[cellIndex]; const symbolSrc = finalGridAfterWilds[r][c]; const imgElement = cell.querySelector('img'); const altText = imageAltText[symbolSrc] || 'Final'; if (imgElement) { imgElement.src = symbolSrc; imgElement.alt = altText; } else { cell.innerHTML = `<img src="${symbolSrc}" alt="${altText}" class="reel-img">`; } } } }
    
    
            // ... (Win Calculation logic remains the same) ...
            let totalWinAmount = 0; let winMessages = []; let winningCellIndices = new Set();
            const activeLineIndices = getActivePaylineIndices(); const coinValue = getCoinValue();
            const currentTotalBet = getCurrentSpinCost();
            const wasFreeSpin = freeSpinsRemaining >= 0 && !decreaseLevelButton.disabled;
    
            // Check Paylines ...
            activeLineIndices.forEach(lineIndex => { /* ... payline check ... */
                 const linePattern = paylines[lineIndex]; if (!linePattern) return;
                 for (let winLength = 5; winLength >= 3; winLength--) {
                     const firstSymbolSrc = finalGridAfterWilds[linePattern[0]][0]; let symbolToMatch = (firstSymbolSrc === WILD_SYMBOL || firstSymbolSrc === BONUS_SYMBOL) ? null : firstSymbolSrc;
                     let wildCount = (firstSymbolSrc === WILD_SYMBOL) ? 1 : 0; let match = true; if (firstSymbolSrc === BONUS_SYMBOL) { match = false; break; }
                     for (let col = 1; col < winLength; col++) { const currentSymbolSrc = finalGridAfterWilds[linePattern[col]][col]; if (currentSymbolSrc === BONUS_SYMBOL) { match = false; break; } if (currentSymbolSrc === WILD_SYMBOL) { wildCount++; continue; } if (symbolToMatch === null) { symbolToMatch = currentSymbolSrc; } else if (currentSymbolSrc !== symbolToMatch) { match = false; break; } }
                     if (match) { if (symbolToMatch === null && wildCount === winLength) { symbolToMatch = WILD_SYMBOL; } if (symbolToMatch) { const payoutMultipliers = paytableMultipliers[symbolToMatch]; const multiplierIndex = winLength - 3; if (payoutMultipliers && multiplierIndex >= 0 && multiplierIndex < payoutMultipliers.length && payoutMultipliers[multiplierIndex] > 0) { let winAmount = coinValue * payoutMultipliers[multiplierIndex]; if (wasFreeSpin) winAmount *= FREE_SPINS_MULTIPLIER; totalWinAmount += winAmount; const symbolAlt = imageAltText[symbolToMatch] || 'Item'; winMessages.push(`Line ${lineIndex + 1}: ${winLength} x ${symbolAlt} = +$${winAmount.toFixed(2)} ${wasFreeSpin ? '(x'+FREE_SPINS_MULTIPLIER+'!)' : ''}`); for (let col = 0; col < winLength; col++) { winningCellIndices.add(linePattern[col] * COLS + col); } break; } } }
                 }
             });
    
    
            // Check Scatters ...
            let scatterCount = 0; finalGridAfterWilds.flat().forEach(symbolSrc => { if (symbolSrc === SCATTER_SYMBOL) scatterCount++; });
            let triggeredFreeSpinsThisSpin = false;
            if (scatterCount >= 3 && scatterPayouts[scatterCount]) {
                let scatterWin = currentTotalBet * scatterPayouts[scatterCount]; if (wasFreeSpin) scatterWin *= FREE_SPINS_MULTIPLIER; totalWinAmount += scatterWin; winMessages.push(`${scatterCount} x Scatter = +$${scatterWin.toFixed(2)} ${wasFreeSpin ? '(x'+FREE_SPINS_MULTIPLIER+'!)' : ''}`);
                gridCells.forEach((cell, index) => { if (finalGridAfterWilds[Math.floor(index / COLS)][index % COLS] === SCATTER_SYMBOL) { winningCellIndices.add(index); } });
                if (freeSpinsRemaining >= 0) { freeSpinsRemaining += FREE_SPINS_AWARDED; triggeredFreeSpinsThisSpin = true; winMessages.push(`Retrigger! +${FREE_SPINS_AWARDED} Free Spins!`); updateFreeSpinsDisplay(); }
                else { freeSpinsRemaining = FREE_SPINS_AWARDED; triggeredFreeSpinsThisSpin = true; winMessages.push(`${FREE_SPINS_AWARDED} Auto Free Spins Triggered!`); updateFreeSpinsDisplay(); }
            }
    
            // Check Bonus Trigger ...
            let bonusTriggered = false;
            activeLineIndices.forEach(lineIndex => { /* ... bonus check ... */
                 if (bonusTriggered) return; const linePattern = paylines[lineIndex]; if (!linePattern) return; let bonusCount = 0;
                 for (let col = 0; col < 3; col++) { if (finalGridAfterWilds[linePattern[col]][col] === BONUS_SYMBOL) { bonusCount++; } else { break; } }
                 if (bonusCount >= 3) { bonusTriggered = true; winMessages.push(`💰 Bonus Game Triggered! (Coming Soon)`); for (let col = 0; col < bonusCount; col++) { winningCellIndices.add(linePattern[col] * COLS + col); } triggerBonusGame(); }
            });
    
    
            // Final Update Message/Balance/Highlight
            if (totalWinAmount > 0) { balance += totalWinAmount; resultMessage.innerHTML = winMessages.join('<br>'); highlightWin(Array.from(winningCellIndices)); }
            else { resultMessage.textContent = freeSpinsRemaining > 0 ? `Free Spin! ${freeSpinsRemaining} left.` : `Try Again!`; }
            updateBalanceDisplay();
    
            // --- Handle Auto Free Spin or Enable Controls (Modified) ---
            if (freeSpinsRemaining > 0 && !bonusTriggered) { // Only auto-spin if FS remain AND bonus wasn't triggered
                console.log(`Scheduling next free spin. Remaining: ${freeSpinsRemaining}`);
                // Clear the timeout variable *before* setting the new timeout
                autoSpinTimeout = null;
                autoSpinTimeout = setTimeout(() => {
                    // Clear the reference *inside* the timeout callback before starting spin
                    autoSpinTimeout = null;
                    startSpin();
                }, AUTO_SPIN_DELAY);
            } else {
                // If not starting another free spin (or bonus triggered), clear timeout and hide counter
                if (autoSpinTimeout) clearTimeout(autoSpinTimeout);
                autoSpinTimeout = null;
                if (!bonusTriggered) { // Don't hide if bonus triggered, bonus function handles state
                     updateFreeSpinsDisplay();
                }
            }
            // Update button states AFTER handling potential auto-spin timeout
            updateButtonStates();
        }
    
        // --- Placeholder Bonus Game Function ---
        function triggerBonusGame() { /* ... same as previous ... */
            console.log("BONUS GAME TRIGGERED!"); isSpinning = false; if (animationFrameId) cancelAnimationFrame(animationFrameId); if (autoSpinTimeout) clearTimeout(autoSpinTimeout); autoSpinTimeout = null;
            setTimeout(() => { alert("BONUS FEATURE TRIGGERED!\n(Imagine a cool mini-game here!)"); freeSpinsRemaining = 0; updateFreeSpinsDisplay(); updateButtonStates(); }, 500);
        }
    
        // --- Other Functions (Highlight, Balance, Free Spin Display, Init) ---
        function highlightWin(cellIndices) { cellIndices.forEach(index => { if (gridCells[index]) gridCells[index].classList.add('reel-cell-win'); }); }
        function clearWinHighlight() { gridCells.forEach(cell => { cell.classList.remove('reel-cell-win'); }); }
        function updateBalanceDisplay() { balanceAmountSpan.textContent = Math.floor(balance); if (balance <= 0 && !isSpinning && freeSpinsRemaining <= 0) { resultMessage.textContent = "Game Over!"; updateButtonStates(); } }
        function updateFreeSpinsDisplay() { if (freeSpinsRemaining > 0) { freeSpinsCountSpan.textContent = freeSpinsRemaining; freeSpinsDisplay.style.display = 'block'; } else { freeSpinsDisplay.style.display = 'none'; } }
    
        initializeSlots();
    });