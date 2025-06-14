document.addEventListener('DOMContentLoaded', () => {
  const spinButton = document.getElementById('spin-button');
  const resultDiv = document.getElementById('result');
  const balanceSpan = document.getElementById('balance-amount');
  const betInput = document.getElementById('bet-amount');
  const tableSelect = document.getElementById('table-select');
  const betTypeSelect = document.getElementById('bet-type');
  const numberInput = document.getElementById('number-input');

  let balance = loadCasinoBalance();
  updateBalance();

  tableSelect.addEventListener('change', updatePlaceholder);
  spinButton.addEventListener('click', spin);
  updatePlaceholder();

  function updatePlaceholder() {
    betInput.placeholder = `$${getMinBet()}`;
  }

  function getMinBet() {
    switch (tableSelect.value) {
      case 'high': return 10;
      case 'vip': return 25;
      default: return 1;
    }
  }

  function updateBalance() {
    balanceSpan.textContent = balance.toFixed(2);
  }

  function spin() {
    const bet = parseFloat(betInput.value);
    const minBet = getMinBet();
    if (isNaN(bet) || bet < minBet || bet > balance) {
      resultDiv.textContent = 'Invalid bet.';
      return;
    }

    const betType = betTypeSelect.value;
    const chosenNumber = parseInt(numberInput.value, 10);
    const roll = Math.floor(Math.random() * 37); // 0-36
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const isRed = roll !== 0 && redNumbers.includes(roll);
    let win = false;

    if (betType === 'red') {
      win = isRed;
    } else if (betType === 'black') {
      win = roll !== 0 && !isRed;
    } else if (betType === 'number') {
      win = roll === chosenNumber;
    }

    balance -= bet;
    let payout = 0;
    if (win) {
      payout = betType === 'number' ? bet * 35 : bet * 2;
      balance += payout;
      resultDiv.textContent = `Ball landed on ${roll}. You win $${payout.toFixed(2)}!`;
    } else {
      resultDiv.textContent = `Ball landed on ${roll}. You lose.`;
    }

    saveCasinoBalance(balance);
    updateBalance();
  }
});
