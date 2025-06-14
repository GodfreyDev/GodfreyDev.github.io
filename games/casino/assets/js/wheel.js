document.addEventListener('DOMContentLoaded', () => {
  const spinButton = document.getElementById('spin-button');
  const resultDiv = document.getElementById('wheel-result');
  const balanceSpan = document.getElementById('balance-amount');
  const betInput = document.getElementById('bet-amount');

  let balance = loadCasinoBalance();
  const segments = [1,2,3,4,5,6,7,8];

  function updateBalance() {
    balanceSpan.textContent = balance.toFixed(2);
  }

  function spinWheel() {
    const bet = parseFloat(betInput.value);
    if (isNaN(bet) || bet <= 0 || bet > balance) {
      resultDiv.textContent = 'Invalid bet.';
      return;
    }
    const result = segments[Math.floor(Math.random() * segments.length)];
    if (result === 8) {
      balance += bet * 5;
      resultDiv.textContent = `Wheel landed on ${result}! Jackpot!`;
    } else {
      balance -= bet;
      resultDiv.textContent = `Wheel landed on ${result}. You lose.`;
    }
    updateBalance();
    saveCasinoBalance(balance);
  }

  spinButton.addEventListener('click', spinWheel);
  updateBalance();
});
