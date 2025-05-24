document.addEventListener('DOMContentLoaded', () => {
    console.log("slots.js 5x3 Free Spin Fix loaded with updated paths.");

    const spinButton = document.getElementById('spin-button');
    const decreaseLevelButton = document.getElementById('decrease-level');
    const increaseLevelButton = document.getElementById('increase-level');
    const decreaseCoinButton = document.getElementById('decrease-coin');
    const increaseCoinButton = document.getElementById('increase-coin');
    const betLevelDisplay = document.getElementById('bet-level-display');
    const coinValueDisplay = document.getElementById('coin-value-display');
    const activeLinesDisplay = document.getElementById('active-lines-display');
    const betPerLineDisplay = document.getElementById('bet-per-line-display');
    const slotMachineGrid = document.getElementById('slot-machine');
    const resultMessage = document.getElementById('result-message');
    const balanceAmountSpan = document.getElementById('balance-amount');
    const freeSpinsDisplay = document.getElementById('free-spins-display');
    const freeSpinsCountSpan = document.getElementById('free-spins-count');
    const stopButtons = [];
    for (let i = 0; i < 5; i++) { stopButtons.push(document.getElementById(`stop-reel-${i}`)); }

    const ROWS = 3; const COLS = 5;
    const IMAGE_BASE_PATH = 'assets/images/'; // Base path for casino game images

    const WILD_SYMBOL = IMAGE_BASE_PATH + 'shield.png';
    const SCATTER_SYMBOL = IMAGE_BASE_PATH + 'dragon.png';
    const BONUS_SYMBOL = IMAGE_BASE_PATH + 'chest.png';

    const weightedSymbols = [
        { src: IMAGE_BASE_PATH + 'map_scroll.png', weight: 10 },
        { src: IMAGE_BASE_PATH + 'coin.png', weight: 10 },
        // { src: IMAGE_BASE_PATH + 'map_scroll.png', weight: 10 }, // Duplicate map_scroll, assuming one is for a different "Map" symbol
        { src: IMAGE_BASE_PATH + 'mana_potion.png', weight: 9 },
        { src: IMAGE_BASE_PATH + 'key.png', weight: 9 },
        { src: IMAGE_BASE_PATH + 'health_potion.png', weight: 8 },
        { src: IMAGE_BASE_PATH + 'axe.png', weight: 7 },
        { src: IMAGE_BASE_PATH + 'staff.png', weight: 6 },
        { src: IMAGE_BASE_PATH + 'ring.png', weight: 6 },
        { src: IMAGE_BASE_PATH + 'gem.png', weight: 4 },
        { src: WILD_SYMBOL, weight: 3 },
        { src: IMAGE_BASE_PATH + 'sword2.png', weight: 2 },
        { src: SCATTER_SYMBOL, weight: 8 },
        { src: BONUS_SYMBOL, weight: 3 }
    ];

    const imageAltText = {
        [IMAGE_BASE_PATH + 'map_scroll.png']: 'Map/Scroll',
        [IMAGE_BASE_PATH + 'coin.png']: 'Coin',
        [IMAGE_BASE_PATH + 'mana_potion.png']: 'MP Potion',
        [IMAGE_BASE_PATH + 'key.png']: 'Key',
        [IMAGE_BASE_PATH + 'health_potion.png']: 'HP Potion',
        [IMAGE_BASE_PATH + 'axe.png']: 'Axe',
        [IMAGE_BASE_PATH + 'staff.png']: 'Staff',
        [IMAGE_BASE_PATH + 'ring.png']: 'Ring',
        [IMAGE_BASE_PATH + 'gem.png']: 'Gem',
        [WILD_SYMBOL]: 'WILD Shield',
        [IMAGE_BASE_PATH + 'sword2.png']: 'Sword',
        [SCATTER_SYMBOL]: 'Dragon Scatter',
        [BONUS_SYMBOL]: 'Chest Bonus'
    };
    const symbols = weightedSymbols.map(s => s.src);
    const weightedPool = [];
    weightedSymbols.forEach(s => { for (let i = 0; i < s.weight; i++) weightedPool.push(s.src); });

    const coinValues = [0.01, 0.05, 0.10, 0.25, 0.50, 1.00, 2.00, 5.00];
    const betLevels = [
        { level: 1, linesActive: 5, linesIndices: [0, 1, 2, 3, 4], costMultiplier: 5 },
        { level: 2, linesActive: 9, linesIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8], costMultiplier: 9 },
        { level: 3, linesActive: 15, linesIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], costMultiplier: 15 }
    ];
    const maxBetLevelIndex = betLevels.length - 1;
    const maxCoinValueIndex = coinValues.length - 1;

    const paytableMultipliers = {
        [IMAGE_BASE_PATH + 'sword2.png']: [20, 60, 150],
        [WILD_SYMBOL]: [0, 0, 250], // Shield
        [IMAGE_BASE_PATH + 'gem.png']: [15, 45, 125],
        [IMAGE_BASE_PATH + 'ring.png']: [10, 30, 100],
        [IMAGE_BASE_PATH + 'staff.png']: [8, 20, 75],
        [IMAGE_BASE_PATH + 'axe.png']: [6, 18, 60],
        [IMAGE_BASE_PATH + 'health_potion.png']: [5, 15, 40],
        [IMAGE_BASE_PATH + 'key.png']: [4, 10, 30],
        [IMAGE_BASE_PATH + 'mana_potion.png']: [3, 8, 20],
        [IMAGE_BASE_PATH + 'coin.png']: [1, 4, 10],
        [IMAGE_BASE_PATH + 'map_scroll.png']: [1, 3, 8], // Assuming this is for the "Map" symbol with lower payout
        // SCATTER_SYMBOL and BONUS_SYMBOL typically don't have line payouts, handled separately.
    };
    const scatterPayouts = { 3: 2, 4: 8, 5: 40 };
    const FREE_SPINS_AWARDED = 10;
    const FREE_SPINS_MULTIPLIER = 2;
    const AUTO_SPIN_DELAY = 300;
    const paylines = [
        [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
        [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
        [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2]
    ];

    let balance = 100;
    let currentBetLevelIndex = 0;
    let currentCoinValueIndex = 2;
    let isSpinning = false;
    let reelSpinState = [false, false, false, false, false];
    let gridCells = [];
    let finalGridSymbols = [];
    let freeSpinsRemaining = 0;
    let autoSpinTimeout = null;
    let animationFrameId = null;

    function initializeSlots() {
        if (!slotMachineGrid || !spinButton || !decreaseLevelButton || !increaseLevelButton || !decreaseCoinButton || !increaseCoinButton || !betLevelDisplay || !coinValueDisplay || !activeLinesDisplay || !betPerLineDisplay || !resultMessage || !balanceAmountSpan || !freeSpinsDisplay || !freeSpinsCountSpan || stopButtons.some(b => !b)) {
            console.error("Init failed: Missing one or more essential slot machine elements!");
            if (resultMessage) resultMessage.textContent = "Error: Slot machine elements missing.";
            return;
        }
        createGridCells();
        preloadImages();
        // Set default images in grid cells
        gridCells.forEach(cell => {
            const defaultSymbolSrc = IMAGE_BASE_PATH + 'map_scroll.png'; // Or any default symbol
            cell.innerHTML = `<img src="${defaultSymbolSrc}" alt="${imageAltText[defaultSymbolSrc] || 'Slot Symbol'}" class="reel-img">`;
        });
        updateBalanceDisplay();
        updateBettingInfo();
        updateButtonStates();
        resultMessage.textContent = 'Select Bet Level/Coin Value and Spin.';
        spinButton.addEventListener('click', handleSpinStopClick);
        stopButtons.forEach((button, index) => { button.addEventListener('click', () => handleIndividualStop(index)); });
        decreaseLevelButton.addEventListener('click', decreaseBetLevel);
        increaseLevelButton.addEventListener('click', increaseBetLevel);
        decreaseCoinButton.addEventListener('click', decreaseCoinValue);
        increaseCoinButton.addEventListener('click', increaseCoinValue);
        console.log("5x3 Slot machine initialized (Free Spin Fix with updated paths).");
    }

    function createGridCells() {
        gridCells = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = document.getElementById(`cell-${r}-${c}`);
                if (!cell) console.error(`Cell cell-${r}-${c} not found!`);
                gridCells.push(cell);
            }
        }
    }

    function preloadImages() {
        symbols.forEach(src => { // `symbols` array already has full paths like 'assets/images/...'
            const img = new Image();
            img.src = src;
        });
        console.log("RPG Images preloading...");
    }

    function decreaseBetLevel() { if (currentBetLevelIndex > 0 && !isSpinning && freeSpinsRemaining <= 0) { currentBetLevelIndex--; updateBettingInfo(); updateButtonStates(); } }
    function increaseBetLevel() { if (currentBetLevelIndex < maxBetLevelIndex && !isSpinning && freeSpinsRemaining <= 0) { currentBetLevelIndex++; updateBettingInfo(); updateButtonStates(); } }
    function decreaseCoinValue() { if (currentCoinValueIndex > 0 && !isSpinning && freeSpinsRemaining <= 0) { currentCoinValueIndex--; updateBettingInfo(); updateButtonStates(); } }
    function increaseCoinValue() { if (currentCoinValueIndex < maxCoinValueIndex && !isSpinning && freeSpinsRemaining <= 0) { currentCoinValueIndex++; updateBettingInfo(); updateButtonStates(); } }

    function updateBettingInfo() {
        const levelInfo = betLevels[currentBetLevelIndex];
        const coinValue = coinValues[currentCoinValueIndex];
        const totalCost = levelInfo.costMultiplier * coinValue;
        const linesActive = levelInfo.linesActive;
        const betPerLine = linesActive > 0 ? totalCost / linesActive : 0;

        betLevelDisplay.textContent = levelInfo.level;
        coinValueDisplay.textContent = coinValue.toFixed(2);
        activeLinesDisplay.textContent = linesActive;
        betPerLineDisplay.textContent = betPerLine.toFixed(2);

        const spinCostSpan = spinButton.querySelector('#spin-cost-display');
        if (spinCostSpan) spinCostSpan.textContent = `$${totalCost.toFixed(2)}`;
        highlightActivePaylines(levelInfo.linesIndices);
    }

    function highlightActivePaylines(activeIndices) {
        // This function seems to try and highlight based on payline-desc-L1, L2, L3
        // but your betLevels are defined with linesIndices [0,1,2,3,4], [0..8], [0..14]
        // This highlighting logic might need adjustment if you intend to show specific lines.
        // For now, it highlights the level description.
        for (let i = 0; i < betLevels.length; i++) {
            const p = document.getElementById(`payline-desc-L${i + 1}`);
            if (p) p.classList.remove('active-payline-desc');
        }
        // Highlight the current bet level's description
        const currentLevelP = document.getElementById(`payline-desc-L${betLevels[currentBetLevelIndex].level}`);
        if (currentLevelP) currentLevelP.classList.add('active-payline-desc');
    }

    function getCurrentSpinCost() { return betLevels[currentBetLevelIndex].costMultiplier * coinValues[currentCoinValueIndex]; }
    function getActivePaylineIndices() { return betLevels[currentBetLevelIndex].linesIndices; } // These are indices for the `paylines` array
    function getCoinValue() { return coinValues[currentCoinValueIndex]; }

    function getRandomSymbolWeighted() {
        if (weightedPool.length === 0) return symbols[0]; // Fallback
        const i = Math.floor(Math.random() * weightedPool.length);
        return weightedPool[i];
    }

    function updateButtonStates() {
        const canControlBets = !isSpinning && freeSpinsRemaining <= 0;
        const totalCost = getCurrentSpinCost();
        const canAffordSpin = balance >= totalCost || freeSpinsRemaining > 0;

        spinButton.innerHTML = isSpinning ? `Stop All` : `Spin <span id="spin-cost-display">$${totalCost.toFixed(2)}</span>`;
        spinButton.disabled = (!isSpinning && !canAffordSpin) || (isSpinning && freeSpinsRemaining > 0 && autoSpinTimeout !== null);
        spinButton.setAttribute('aria-disabled', String(spinButton.disabled));

        decreaseLevelButton.disabled = (currentBetLevelIndex === 0) || !canControlBets;
        increaseLevelButton.disabled = (currentBetLevelIndex === maxBetLevelIndex) || !canControlBets;
        decreaseLevelButton.setAttribute('aria-disabled', String(decreaseLevelButton.disabled));
        increaseLevelButton.setAttribute('aria-disabled', String(increaseLevelButton.disabled));

        decreaseCoinButton.disabled = (currentCoinValueIndex === 0) || !canControlBets;
        increaseCoinButton.disabled = (currentCoinValueIndex === maxCoinValueIndex) || !canControlBets;
        decreaseCoinButton.setAttribute('aria-disabled', String(decreaseCoinButton.disabled));
        increaseCoinButton.setAttribute('aria-disabled', String(increaseCoinButton.disabled));

        stopButtons.forEach((btn, index) => {
            btn.disabled = !isSpinning || !reelSpinState[index];
            btn.setAttribute('aria-disabled', String(btn.disabled));
        });
    }

    function handleSpinStopClick() {
        if (isSpinning) {
            if (freeSpinsRemaining <= 0 || !autoSpinTimeout) { // Allow stopping if not in auto free spin
                stopAllReels();
            }
        } else {
            startSpin();
        }
    }

    function startSpin() {
        const currentCost = getCurrentSpinCost();
        if (isSpinning || autoSpinTimeout) {
            console.log("Spin prevented: Already spinning or waiting for auto-spin.");
            return;
        }

        let isFreeSpin = freeSpinsRemaining > 0;
        if (!isFreeSpin && balance < currentCost) {
            resultMessage.textContent = "Not enough balance!";
            updateButtonStates();
            return;
        }

        if (isFreeSpin) {
            freeSpinsRemaining--;
            updateFreeSpinsDisplay();
            resultMessage.textContent = `Free Spin! ${freeSpinsRemaining} left.`;
        } else {
            balance -= currentCost;
            updateBalanceDisplay();
            resultMessage.textContent = 'Starting Spin...';
        }

        isSpinning = true;
        reelSpinState = [true, true, true, true, true];
        clearWinHighlight();
        updateButtonStates();
        resultMessage.textContent = 'Spinning...';

        finalGridSymbols = [];
        for (let r = 0; r < ROWS; r++) {
            finalGridSymbols[r] = [];
            for (let c = 0; c < COLS; c++) {
                finalGridSymbols[r][c] = getRandomSymbolWeighted();
            }
        }
        // console.log("Pre-calculated Final Grid:", finalGridSymbols.map(row => row.map(src => src.split('/').pop() || src)));

        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(spinAnimationLoop);
        // console.log("Spin animation started.");
    }

    function stopAllReels() {
        if (!isSpinning) return;
        // console.log("Stopping all reels.");
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        isSpinning = false;
        reelSpinState = [false, false, false, false, false];
        for (let c = 0; c < COLS; c++) {
            revealFinalColumn(c);
        }
        calculateWinsAndEndSpin();
    }

    function handleIndividualStop(reelIndex) {
        if (!isSpinning || !reelSpinState[reelIndex]) return;
        // console.log(`Stopping reel ${reelIndex}`);
        reelSpinState[reelIndex] = false;
        stopButtons[reelIndex].disabled = true;
        stopButtons[reelIndex].setAttribute('aria-disabled', 'true');
        revealFinalColumn(reelIndex);

        if (reelSpinState.every(state => !state)) {
            // console.log("All reels stopped individually.");
            isSpinning = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            calculateWinsAndEndSpin();
        } else {
            updateButtonStates();
        }
    }

    function revealFinalColumn(colIndex) {
        for (let r = 0; r < ROWS; r++) {
            const cellIndex = r * COLS + colIndex;
            const cell = gridCells[cellIndex];
            if (cell) {
                cell.classList.remove('is-spinning');
                const symbolSrc = finalGridSymbols[r][colIndex];
                const imgElement = cell.querySelector('img');
                const altText = imageAltText[symbolSrc] || 'Final Symbol';
                if (imgElement) {
                    imgElement.src = symbolSrc;
                    imgElement.alt = altText;
                } else { // Should not happen if initialized correctly
                    cell.innerHTML = `<img src="${symbolSrc}" alt="${altText}" class="reel-img">`;
                }
            }
        }
    }

    function spinAnimationLoop() {
        let stillSpinning = false;
        for (let c = 0; c < COLS; c++) {
            if (reelSpinState[c]) {
                stillSpinning = true;
                for (let r = 0; r < ROWS; r++) {
                    const cellIndex = r * COLS + c;
                    const cell = gridCells[cellIndex];
                    if (cell) {
                        const randomSymbolSrc = getRandomSymbolWeighted();
                        const imgElement = cell.querySelector('img');
                        const altText = imageAltText[randomSymbolSrc] || 'Spinning Symbol';
                        if (imgElement) {
                            imgElement.src = randomSymbolSrc;
                            imgElement.alt = altText;
                        } else {
                            cell.innerHTML = `<img src="${randomSymbolSrc}" alt="${altText}" class="reel-img">`;
                        }
                        cell.classList.add('is-spinning');
                    }
                }
            }
        }
        if (stillSpinning) {
            animationFrameId = requestAnimationFrame(spinAnimationLoop);
        } else {
            animationFrameId = null;
            // console.warn("Animation loop ended because all reels requested stop.");
            // This case is handled by individual stop or stopAllReels
        }
    }

    function calculateWinsAndEndSpin() {
        // console.log("Calculating wins...");
        let finalGridAfterWilds = finalGridSymbols.map(row => [...row]);
        let wildExpandedOnAnyReel = false; // Track if any wild expansion happened

        for (let c = 0; c < COLS; c++) {
            let wildOnThisReel = false;
            for (let r = 0; r < ROWS; r++) {
                if (finalGridSymbols[r][c] === WILD_SYMBOL) {
                    wildOnThisReel = true;
                    break;
                }
            }
            if (wildOnThisReel) {
                wildExpandedOnAnyReel = true;
                for (let r = 0; r < ROWS; r++) {
                    finalGridAfterWilds[r][c] = WILD_SYMBOL; // Expand wild for logic
                }
            }
        }

        if (wildExpandedOnAnyReel) {
            // console.log("Applying expanding wilds visually");
            for (let r_vis = 0; r_vis < ROWS; r_vis++) {
                for (let c_vis = 0; c_vis < COLS; c_vis++) {
                    // Only update visual if this column actually had a wild that expanded
                    let wildActuallyExpandedOnThisVisualColumn = false;
                     for (let r_check = 0; r_check < ROWS; r_check++) {
                         if (finalGridSymbols[r_check][c_vis] === WILD_SYMBOL) {
                             wildActuallyExpandedOnThisVisualColumn = true;
                             break;
                         }
                     }
                     if (wildActuallyExpandedOnThisVisualColumn) {
                        const cellIndex = r_vis * COLS + c_vis;
                        const cell = gridCells[cellIndex];
                        const symbolSrc = WILD_SYMBOL; // Force visual to wild
                        const imgElement = cell.querySelector('img');
                        const altText = imageAltText[symbolSrc] || 'Expanded Wild';
                        if (imgElement) {
                            imgElement.src = symbolSrc;
                            imgElement.alt = altText;
                        } else {
                            cell.innerHTML = `<img src="${symbolSrc}" alt="${altText}" class="reel-img">`;
                        }
                     }
                }
            }
        }

        let totalWinAmount = 0;
        let winMessages = [];
        let winningCellIndices = new Set();
        const activeLineIndices = getActivePaylineIndices(); // These are indices for `paylines` array.
        const coinVal = getCoinValue();
        const currentTotalBet = getCurrentSpinCost(); // For scatter payout calculation
        const wasThisSpinAFreeSpin = freeSpinsRemaining >=0 && !decreaseLevelButton.disabled; // Check if betting controls were disabled

        activeLineIndices.forEach(paylineDefinitionIndex => {
            const linePattern = paylines[paylineDefinitionIndex]; // e.g., [1,1,1,1,1] refers to middle row.
            if (!linePattern) return;

            for (let winLength = COLS; winLength >= 3; winLength--) { // Check for 5, then 4, then 3 of a kind
                const firstSymbolOnLine = finalGridAfterWilds[linePattern[0]][0]; // Symbol in the first column of this payline
                let symbolToMatchForThisWin = (firstSymbolOnLine === WILD_SYMBOL || firstSymbolOnLine === BONUS_SYMBOL) ? null : firstSymbolOnLine;
                let wildsInThisPotentialWin = (firstSymbolOnLine === WILD_SYMBOL) ? 1 : 0;
                let isPotentialWin = true;

                if (firstSymbolOnLine === BONUS_SYMBOL) { // Bonus symbol doesn't form regular line wins with others
                    isPotentialWin = false;
                    // Bonus check is separate
                } else {
                    for (let col = 1; col < winLength; col++) { // Check subsequent symbols in the winLength
                        const currentSymbolOnLine = finalGridAfterWilds[linePattern[col]][col];
                        if (currentSymbolOnLine === BONUS_SYMBOL) {
                            isPotentialWin = false;
                            break;
                        }
                        if (currentSymbolOnLine === WILD_SYMBOL) {
                            wildsInThisPotentialWin++;
                            continue;
                        }
                        if (symbolToMatchForThisWin === null) { // First non-wild symbol encountered
                            symbolToMatchForThisWin = currentSymbolOnLine;
                        } else if (currentSymbolOnLine !== symbolToMatchForThisWin) {
                            isPotentialWin = false;
                            break;
                        }
                    }
                }

                if (isPotentialWin) {
                    if (symbolToMatchForThisWin === null && wildsInThisPotentialWin === winLength) { // All wilds
                        symbolToMatchForThisWin = WILD_SYMBOL;
                    }

                    if (symbolToMatchForThisWin) {
                        const payoutMultipliersForSymbol = paytableMultipliers[symbolToMatchForThisWin];
                        const multiplierIndexForWinLength = winLength - 3; // 0 for 3-of-kind, 1 for 4, 2 for 5

                        if (payoutMultipliersForSymbol &&
                            multiplierIndexForWinLength >= 0 &&
                            multiplierIndexForWinLength < payoutMultipliersForSymbol.length &&
                            payoutMultipliersForSymbol[multiplierIndexForWinLength] > 0) {

                            let winAmountForThisLine = coinVal * payoutMultipliersForSymbol[multiplierIndexForWinLength];
                            if (wasThisSpinAFreeSpin) {
                                winAmountForThisLine *= FREE_SPINS_MULTIPLIER;
                            }
                            totalWinAmount += winAmountForThisLine;
                            const symbolAlt = imageAltText[symbolToMatchForThisWin] || 'Symbol';
                            winMessages.push(`Line ${paylineDefinitionIndex + 1}: ${winLength} x ${symbolAlt} = +$${winAmountForThisLine.toFixed(2)} ${wasThisSpinAFreeSpin ? `(x${FREE_SPINS_MULTIPLIER}!)` : ''}`);

                            for (let col = 0; col < winLength; col++) {
                                winningCellIndices.add(linePattern[col] * COLS + col);
                            }
                            break; // Found the longest win on this payline, move to next payline
                        }
                    }
                }
            }
        });

        let scatterCount = 0;
        finalGridAfterWilds.flat().forEach(symbolSrc => { if (symbolSrc === SCATTER_SYMBOL) scatterCount++; });
        let triggeredFreeSpinsThisSpin = false;

        if (scatterCount >= 3 && scatterPayouts[scatterCount]) {
            let scatterWin = currentTotalBet * scatterPayouts[scatterCount]; // Scatter pays on total bet
            if (wasThisSpinAFreeSpin) {
                scatterWin *= FREE_SPINS_MULTIPLIER;
            }
            totalWinAmount += scatterWin;
            winMessages.push(`${scatterCount} x Scatter = +$${scatterWin.toFixed(2)} ${wasThisSpinAFreeSpin ? `(x${FREE_SPINS_MULTIPLIER}!)` : ''}`);
            finalGridAfterWilds.forEach((row, r_idx) => {
                row.forEach((symbolSrc, c_idx) => {
                    if (symbolSrc === SCATTER_SYMBOL) winningCellIndices.add(r_idx * COLS + c_idx);
                });
            });

            // Award free spins only if not already in a free spin session retriggering
            // OR if it's the first trigger from a normal spin
            if (!wasThisSpinAFreeSpin || (wasThisSpinAFreeSpin && freeSpinsRemaining >= 0) ) {
                freeSpinsRemaining += FREE_SPINS_AWARDED;
                triggeredFreeSpinsThisSpin = true;
                winMessages.push((wasThisSpinAFreeSpin ? `Retrigger! ` : ``) + `+${FREE_SPINS_AWARDED} Free Spins!`);
                updateFreeSpinsDisplay();
            }
        }

        let bonusTriggeredThisSpin = false;
        activeLineIndices.forEach(paylineDefinitionIndex => {
            if (bonusTriggeredThisSpin) return;
            const linePattern = paylines[paylineDefinitionIndex];
            if (!linePattern) return;
            let bonusSymbolCountOnLine = 0;
            for (let col = 0; col < 3; col++) { // Bonus typically needs 3 from left
                if (finalGridAfterWilds[linePattern[col]][col] === BONUS_SYMBOL) {
                    bonusSymbolCountOnLine++;
                } else {
                    break; // Must be consecutive from left
                }
            }
            if (bonusSymbolCountOnLine >= 3) {
                bonusTriggeredThisSpin = true;
                winMessages.push(`💰 Bonus Game Triggered! (Coming Soon)`);
                for (let col = 0; col < bonusSymbolCountOnLine; col++) {
                    winningCellIndices.add(linePattern[col] * COLS + col);
                }
                triggerBonusGame(); // This function will handle game state changes
            }
        });


        if (totalWinAmount > 0) {
            balance += totalWinAmount;
            resultMessage.innerHTML = winMessages.join('<br>');
            highlightWin(Array.from(winningCellIndices));
        } else {
            resultMessage.textContent = freeSpinsRemaining > 0 && !bonusTriggeredThisSpin ? `Free Spin! ${freeSpinsRemaining} left.` : (bonusTriggeredThisSpin ? resultMessage.textContent : `Try Again!`);
        }
        updateBalanceDisplay();

        if (freeSpinsRemaining > 0 && !bonusTriggeredThisSpin) {
            // console.log(`Scheduling next free spin. Remaining: ${freeSpinsRemaining}`);
            if(autoSpinTimeout) clearTimeout(autoSpinTimeout); // Clear previous if any
            autoSpinTimeout = setTimeout(() => {
                autoSpinTimeout = null;
                startSpin();
            }, AUTO_SPIN_DELAY);
        } else {
            if (autoSpinTimeout) clearTimeout(autoSpinTimeout);
            autoSpinTimeout = null;
            if (!bonusTriggeredThisSpin) { // Don't hide free spins counter if bonus is active
                updateFreeSpinsDisplay(); // Ensures it hides if freeSpinsRemaining became 0
            }
        }
        updateButtonStates(); // Always update buttons at the end
    }

    function triggerBonusGame() {
        // console.log("BONUS GAME TRIGGERED!");
        isSpinning = false; // Ensure main spin stops
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (autoSpinTimeout) clearTimeout(autoSpinTimeout); // Stop any pending auto free spins
        autoSpinTimeout = null;

        // Disable most controls during bonus
        // spinButton.disabled = true; // etc. - or handle in updateButtonStates

        setTimeout(() => {
            alert("BONUS FEATURE TRIGGERED!\n(Imagine a cool mini-game here!)");
            // After bonus, reset free spins and update UI
            freeSpinsRemaining = 0;
            updateFreeSpinsDisplay();
            updateButtonStates(); // Re-enable controls
            resultMessage.textContent = "Bonus ended. Spin again!";
        }, 500);
    }

    function highlightWin(cellIndices) { cellIndices.forEach(index => { if (gridCells[index]) gridCells[index].classList.add('reel-cell-win'); }); }
    function clearWinHighlight() { gridCells.forEach(cell => { cell.classList.remove('reel-cell-win'); }); }
    function updateBalanceDisplay() {
        balanceAmountSpan.textContent = Math.floor(balance); // Show whole numbers for currency
        if (balance <= 0 && !isSpinning && freeSpinsRemaining <= 0) {
            resultMessage.textContent = "Game Over!";
            updateButtonStates(); // Will disable spin if cannot afford
        }
    }
    function updateFreeSpinsDisplay() {
        if (freeSpinsRemaining > 0) {
            freeSpinsCountSpan.textContent = freeSpinsRemaining;
            freeSpinsDisplay.style.display = 'block';
        } else {
            freeSpinsDisplay.style.display = 'none';
        }
    }

    initializeSlots();
});