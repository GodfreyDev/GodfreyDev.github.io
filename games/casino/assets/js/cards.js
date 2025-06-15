// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    console.log("cards.js loaded and DOM ready.");

    // --- Get References to HTML Elements ---
    const dealButton = document.getElementById('deal-button');
    const hitButton = document.getElementById('hit-button');
   const standButton = document.getElementById('stand-button');
    const splitButton = document.getElementById('split-button');
   const dealerHandDiv = document.querySelector('#dealer-hand .cards');
   const playerHandDiv = document.querySelector('#player-hand .cards');
    const splitHandDiv = document.querySelector('#split-hand .cards');
    const playerScoreSpan = document.getElementById('player-score');
    const splitScoreSpan = document.getElementById('split-score');
    const gameStatusDiv = document.getElementById('game-status');
    const balanceAmountSpan = document.getElementById('balance-amount');

    // --- Game State Variables ---
    let deck = [];
    let playerHand = [];
    let splitHand = [];
    let dealerHand = [];
    let playerScore = 0;
    let splitScore = 0;
    let dealerScore = 0;
    let balance = loadCasinoBalance();
    let playerBet = 10; // Example fixed bet - you might want an input for this
    let gameInProgress = false;
    let dealerHiddenCard = null; // To store the dealer's face-down card
    let isSplit = false;
    let currentHandIndex = 0; // 0 for playerHand, 1 for splitHand


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
        if (splitButton) splitButton.addEventListener('click', handleSplit);
    }

    function resetUI() {
        gameStatusDiv.textContent = 'Place your bet (fixed $10) and press Deal.';
        dealerHandDiv.innerHTML = '';
        playerHandDiv.innerHTML = '';
        splitHandDiv.innerHTML = '';
        document.getElementById('split-hand').style.display = 'none';
        hitButton.disabled = true;
        standButton.disabled = true;
        splitButton.disabled = true;
        dealButton.disabled = false;
        isSplit = false;
        currentHandIndex = 0;
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
        splitHand = [];
        dealerHand = [];
        splitScore = 0;
        splitScoreSpan.textContent = '0';

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
        document.getElementById('split-hand').style.display = 'none';

        gameStatusDiv.textContent = `Your score: ${playerScore}. Dealer showing: ${getCardValue(dealerHand[1])}. Hit or Stand?`;

        if (playerHand.length === 2 && getCardValue(playerHand[0]) === getCardValue(playerHand[1]) && balance >= playerBet) {
            splitButton.disabled = false;
        } else {
            splitButton.disabled = true;
        }

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

    function handleSplit() {
        if (!gameInProgress || isSplit) return;
        if (playerHand.length !== 2 || getCardValue(playerHand[0]) !== getCardValue(playerHand[1])) return;
        if (balance < playerBet) {
            gameStatusDiv.textContent = 'Not enough balance to split.';
            return;
        }

        balance -= playerBet; // second bet for split
        updateBalanceDisplay();
        saveCasinoBalance(balance);

        splitHand = [playerHand.pop()];
        dealCard(playerHand);
        dealCard(splitHand);

        playerScore = calculateScore(playerHand);
        splitScore = calculateScore(splitHand);
        playerScoreSpan.textContent = playerScore;
        splitScoreSpan.textContent = splitScore;

        renderHand(playerHand, playerHandDiv);
        renderHand(splitHand, splitHandDiv);

        document.getElementById('split-hand').style.display = 'block';
        splitButton.disabled = true;
        isSplit = true;
        currentHandIndex = 0;
        gameStatusDiv.textContent = `Playing first hand. Score: ${playerScore}. Hit or Stand?`;
    }

    function handleHit() {
        if (!gameInProgress) return;

        const hand = (isSplit && currentHandIndex === 1) ? splitHand : playerHand;
        const div = (isSplit && currentHandIndex === 1) ? splitHandDiv : playerHandDiv;
        const span = (isSplit && currentHandIndex === 1) ? splitScoreSpan : playerScoreSpan;

        dealCard(hand);
        const score = calculateScore(hand);
        span.textContent = score;
        if (isSplit && currentHandIndex === 1) {
            splitScore = score;
        } else {
            playerScore = score;
        }
        renderHand(hand, div);

        if (score > 21) {
            gameStatusDiv.textContent = `Busted with ${score}.`;
            handleStand();
        } else if (score === 21) {
            handleStand();
        } else {
            gameStatusDiv.textContent = `Your score: ${score}. Hit or Stand?`;
        }
    }

    function handleStand() {
        if (!gameInProgress) return;

        if (isSplit && currentHandIndex === 0) {
            currentHandIndex = 1;
            gameStatusDiv.textContent = `First hand stands at ${playerScore}. Now play your split hand.`;
            hitButton.disabled = false;
            standButton.disabled = false;
            return;
        }

        hitButton.disabled = true;
        standButton.disabled = true;
        splitButton.disabled = true;

        renderHand(dealerHand, dealerHandDiv, false);
        dealerScore = calculateScore(dealerHand);
        gameStatusDiv.textContent = `Dealer's turn. Dealer score: ${dealerScore}.`;

        const dealerTurn = setInterval(() => {
            if (dealerScore < 17) {
                dealCard(dealerHand);
                dealerScore = calculateScore(dealerHand);
                renderHand(dealerHand, dealerHandDiv);
                gameStatusDiv.textContent = `Dealer hits. Dealer score: ${dealerScore}.`;
            } else {
                clearInterval(dealerTurn);
                determineWinner();
                endRound();
            }
            if (dealerScore > 21) {
                clearInterval(dealerTurn);
                gameStatusDiv.textContent = `Dealer busts! Dealer score: ${dealerScore}.`;
                determineWinner();
                endRound();
            }
        }, 1000);
    }

    function determineWinner() {
        renderHand(dealerHand, dealerHandDiv, false);
        dealerScore = calculateScore(dealerHand);

        const hands = isSplit ? [playerHand, splitHand] : [playerHand];
        const scores = isSplit ? [playerScore, splitScore] : [playerScore];
        let messages = [];

        hands.forEach((hand, idx) => {
            const score = scores[idx];
            let msg = isSplit ? `Hand ${idx + 1}: ` : '';

            if (score > 21) {
                msg += `Bust.`;
            } else if (dealerScore > 21 || score > dealerScore) {
                msg += `Win $${playerBet}!`;
                balance += playerBet * 2;
            } else if (dealerScore > score) {
                msg += `Lose.`;
            } else {
                msg += `Push.`;
                balance += playerBet;
            }
            messages.push(msg);
        });

        gameStatusDiv.textContent = `Dealer score: ${dealerScore}. ` + messages.join(' ');
        updateBalanceDisplay();
        saveCasinoBalance(balance);
    }


    function endRound() {
        hitButton.disabled = true;
        standButton.disabled = true;
        dealButton.disabled = false; // Allow starting a new game
        gameInProgress = false;
        dealerHiddenCard = null;
        splitButton.disabled = true;
        isSplit = false;
        currentHandIndex = 0;
        document.getElementById('split-hand').style.display = 'none';
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