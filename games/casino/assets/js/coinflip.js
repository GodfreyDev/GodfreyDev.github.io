document.addEventListener('DOMContentLoaded', () => {
  const flipButton = document.getElementById('flip-button');
  const resultDiv = document.getElementById('coin-result');
  const choiceSelect = document.getElementById('choice');
  const balanceSpan = document.getElementById('balance-amount');
  const betInput = document.getElementById('bet-amount');

  let balance = loadCasinoBalance();

  function updateBalance() {
    balanceSpan.textContent = balance.toFixed(2);
  }

  function flipCoin() {
    const bet = parseFloat(betInput.value);
    if (isNaN(bet) || bet <= 0 || bet > balance) {
      resultDiv.textContent = 'Invalid bet.';
      return;
    }

    const choice = choiceSelect.value;
    const result = Math.random() < 0.5 ? 'heads' : 'tails';

    if (choice === result) {
      balance += bet;
      resultDiv.textContent = `It\'s ${result}! You win!`;
    } else {
      balance -= bet;
      resultDiv.textContent = `It\'s ${result}! You lose.`;
    }

    updateBalance();
    saveCasinoBalance(balance);
  }

  flipButton.addEventListener('click', flipCoin);
  updateBalance();
});
