document.addEventListener('DOMContentLoaded', () => {
  const higherButton = document.getElementById('higher-button');
  const lowerButton = document.getElementById('lower-button');
  const cardDiv = document.getElementById('current-card');
  const resultDiv = document.getElementById('result');
  const balanceSpan = document.getElementById('balance-amount');
  const betInput = document.getElementById('bet-amount');

  let balance = loadCasinoBalance();
  let currentCard = drawCard();
  renderCard(currentCard);
  updateBalance();

  function drawCard(){
    return Math.floor(Math.random() * 13) + 1; //1-13
  }

  function cardName(value){
    const names = {11:'J',12:'Q',13:'K',1:'A'};
    return names[value] || String(value);
  }

  function renderCard(value){
    cardDiv.textContent = cardName(value);
  }

  function updateBalance(){
    balanceSpan.textContent = balance.toFixed(2);
    saveCasinoBalance(balance);
  }

  function play(guess){
    const bet = parseFloat(betInput.value);
    if(isNaN(bet) || bet <=0 || bet > balance){
      resultDiv.textContent = 'Invalid bet.';
      return;
    }
    const nextCard = drawCard();
    renderCard(nextCard);
    let win = false;
    if(guess === 'higher') win = nextCard > currentCard;
    else if(guess === 'lower') win = nextCard < currentCard;
    if(nextCard === currentCard) win = false;
    if(win){
      balance += bet;
      resultDiv.textContent = `You win! ${cardName(currentCard)} -> ${cardName(nextCard)}`;
    } else {
      balance -= bet;
      resultDiv.textContent = `You lose! ${cardName(currentCard)} -> ${cardName(nextCard)}`;
    }
    currentCard = nextCard;
    updateBalance();
  }

  higherButton.addEventListener('click', () => play('higher'));
  lowerButton.addEventListener('click', () => play('lower'));
});
