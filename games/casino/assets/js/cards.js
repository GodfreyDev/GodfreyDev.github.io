// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    console.log("cards.js loaded and DOM ready.");

    // --- Get References to HTML Elements ---
    const dealButton = document.getElementById('deal-button');
    const hitButton = document.getElementById('hit-button');
    const standButton = document.getElementById('stand-button');
    const dealerHandDiv = document.querySelector('#dealer-hand .cards');
    const playerHandDiv = document.querySelector('#player-hand .cards');
    const gameStatusDiv = document.getElementById('game-status');
    const balanceAmountSpan = document.getElementById('balance-amount');

    // --- Game State Variables ---
    let deck = [];
    let playerHand = [];
    let dealerHand = [];
    let playerScore = 0;
    let dealerScore = 0;
    let balance = loadCasinoBalance();
    let playerBet = 10; // Example fixed bet - you might want an input for this
    let gameInProgress = false;
    let dealerHiddenCard = null; // To store the dealer's face-down card


    // --- Constants ---
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    // --- Initialization ---
    function initializeCardGame() {
        updateBalanceDisplay();
        saveCasinoBalance(balance);
        setupButtonListeners();
        resetUI();
        console.log("Card game initialized (Blackjack structure).");
    }

    function setupButtonListeners() {
         if (!dealButton || !hitButton || !standButton || !gameStatusDiv || !dealerHandDiv || !playerHandDiv) {
            console.error("One or more essential card game elements not found!");
            if(gameStatusDiv) gameStatusDiv.textContent = "Error: Missing required elements.";
            return;
        }
        dealButton.addEventListener('click', handleDeal);
        hitButton.addEventListener('click', handleHit);
        standButton.addEventListener('click', handleStand);
    }

    function resetUI() {
        gameStatusDiv.textContent = 'Place your bet (fixed $10) and press Deal.';
        dealerHandDiv.innerHTML = ''; // Clear hands visually
        playerHandDiv.innerHTML = '';
        hitButton.disabled = true;
        standButton.disabled = true;
        dealButton.disabled = false;
        gameInProgress = false;
    }


    // --- Core Game Functions (Blackjack Example) ---

    function createDeck() {
        deck = []; // Start with an empty deck
        for (const suit of suits) {
            for (const value of values) {
                deck.push({ suit, value });
            }
        }
        console.log("Deck created:", deck.length, "cards");
    }

    function shuffleDeck() {
        // Fisher-Yates (Knuth) Shuffle Algorithm
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap elements
        }
        console.log("Deck shuffled.");
    }

    function dealCard(hand) {
        if (deck.length === 0) {
            console.warn("Deck is empty!");
            // Optionally recreate and reshuffle here
            return null;
        }
        const card = deck.pop();
        hand.push(card);
        return card;
    }

     function getCardValue(card) {
        if (!card) return 0;
        const value = card.value;
        if (value === 'A') return 11; // Ace initially counts as 11
        if (['K', 'Q', 'J'].includes(value)) return 10;
        return parseInt(value, 10); // Numeric cards
    }

    function calculateScore(hand) {
        let score = 0;
        let aceCount = 0;
        for (const card of hand) {
            score += getCardValue(card);
            if (card.value === 'A') {
                aceCount++;
            }
        }
        // Adjust for Aces: if score > 21 and there are Aces, count them as 1 instead of 11
        while (score > 21 && aceCount > 0) {
            score -= 10;
            aceCount--;
        }
        return score;
    }

    function renderHand(hand, displayDiv, hideFirstCard = false) {
        displayDiv.innerHTML = ''; // Clear previous cards
        hand.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card');
             if (hideFirstCard && index === 0) {
                 cardElement.classList.add('hidden'); // Add class for styling face-down card
                 cardElement.textContent = '?'; // Simple text for hidden card
             } else {
                 cardElement.textContent = `${card.value} ${getSuitSymbol(card.suit)}`;
                 cardElement.classList.add(card.suit.toLowerCase()); // Add class for color (hearts/diamonds red)
            }
            displayDiv.appendChild(cardElement);
        });
    }

    function getSuitSymbol(suit) {
        switch(suit) {
            case 'Hearts': return '♥';
            case 'Diamonds': return '♦';
            case 'Clubs': return '♣';
            case 'Spades': return '♠';
            default: return '';
        }
    }

    function handleDeal() {
        if (gameInProgress) return;
        if (balance < playerBet) {
            gameStatusDiv.textContent = "Not enough balance to bet!";
            return;
        }

        gameInProgress = true;
        balance -= playerBet; // Deduct bet
        updateBalanceDisplay();

        createDeck();
        shuffleDeck();

        playerHand = [];
        dealerHand = [];

        // Deal initial hands
        dealCard(playerHand);
        dealerHiddenCard = dealCard(dealerHand); // Deal dealer's hidden card
        dealCard(playerHand);
        dealCard(dealerHand);             // Deal dealer's visible card


        playerScore = calculateScore(playerHand);
        dealerScore = calculateScore(dealerHand); // Includes hidden card for logic, but won't show yet

        // Render hands (hide dealer's first card)
        renderHand(playerHand, playerHandDiv);
        renderHand(dealerHand, dealerHandDiv, true); // Pass true to hide first card

        gameStatusDiv.textContent = `Your score: ${playerScore}. Dealer showing: ${getCardValue(dealerHand[1])}. Hit or Stand?`;

        // Update button states
        dealButton.disabled = true;
        hitButton.disabled = false;
        standButton.disabled = false;

        // Check for immediate Blackjack
        if (playerScore === 21) {
            gameStatusDiv.textContent = "Blackjack! You win!";
            balance += playerBet * 2.5; // Blackjack typically pays 3:2
             updateBalanceDisplay();
            saveCasinoBalance(balance);
            endRound();
        }
    }

    function handleHit() {
        if (!gameInProgress) return;

        dealCard(playerHand);
        playerScore = calculateScore(playerHand);
        renderHand(playerHand, playerHandDiv);

        gameStatusDiv.textContent = `Your score: ${playerScore}. Hit or Stand?`;

        if (playerScore > 21) {
            gameStatusDiv.textContent = `Busted! Your score: ${playerScore}. You lose $${playerBet}.`;
            // Balance already deducted, no win.
            endRound();
        } else if (playerScore === 21) {
            // Player reached 21, automatically stand
            handleStand();
        }
    }

    function handleStand() {
        if (!gameInProgress) return;

        hitButton.disabled = true; // Disable buttons during dealer's turn
        standButton.disabled = true;

        // Reveal dealer's hidden card
        renderHand(dealerHand, dealerHandDiv, false); // Show all dealer cards
        dealerScore = calculateScore(dealerHand);
        gameStatusDiv.textContent = `Dealer's turn. Dealer score: ${dealerScore}.`;

        // Dealer hits until score is 17 or higher (standard rule)
        const dealerTurn = setInterval(() => {
            if (dealerScore < 17) {
                dealCard(dealerHand);
                dealerScore = calculateScore(dealerHand);
                renderHand(dealerHand, dealerHandDiv);
                gameStatusDiv.textContent = `Dealer hits. Dealer score: ${dealerScore}.`;
            } else {
                clearInterval(dealerTurn); // Stop dealer's turn
                determineWinner();
                endRound();
            }
             // Check if dealer busts during their turn
             if(dealerScore > 21) {
                 clearInterval(dealerTurn);
                 gameStatusDiv.textContent = `Dealer busts! Dealer score: ${dealerScore}. You win $${playerBet}!`;
                 balance += playerBet * 2; // Win original bet + winnings
                updateBalanceDisplay();
                saveCasinoBalance(balance);
                endRound();
             }
        }, 1000); // Delay between dealer hits for visibility
    }

    function determineWinner() {
         // This is called if neither player nor dealer busted immediately
        renderHand(dealerHand, dealerHandDiv, false); // Ensure dealer hand is fully visible
        dealerScore = calculateScore(dealerHand); // Recalculate final score just in case
        playerScore = calculateScore(playerHand); // Recalculate final score just in case


        let finalMessage = `Your score: ${playerScore}. Dealer score: ${dealerScore}. `;

        if (dealerScore > 21) { // Should have been caught earlier, but double check
            finalMessage += `Dealer busted! You win $${playerBet}!`;
            balance += playerBet * 2;
        } else if (playerScore > dealerScore) {
            finalMessage += `You win $${playerBet}!`;
            balance += playerBet * 2;
        } else if (dealerScore > playerScore) {
            finalMessage += `Dealer wins. You lose $${playerBet}.`;
            // Balance already deducted
        } else { // Scores are equal
            finalMessage += `Push (Tie). Bet returned.`;
            balance += playerBet; // Return the bet
        }

        gameStatusDiv.textContent = finalMessage;
        updateBalanceDisplay();
        saveCasinoBalance(balance);
    }


    function endRound() {
        hitButton.disabled = true;
        standButton.disabled = true;
        dealButton.disabled = false; // Allow starting a new game
        gameInProgress = false;
        dealerHiddenCard = null;
        console.log("Round ended. Final Balance:", balance);
    }

    function updateBalanceDisplay() {
        if (balanceAmountSpan) {
            balanceAmountSpan.textContent = balance;
        } else {
             console.error("Balance display span not found!");
        }
    }

    // --- Start the Game ---
    initializeCardGame();

}); // End DOMContentLoaded