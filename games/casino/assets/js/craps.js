document.addEventListener('DOMContentLoaded', () => {
  const rollButton = document.getElementById('roll-button');
  const messageDiv = document.getElementById('craps-message');
  const diceDiv = document.getElementById('dice');
  const balanceSpan = document.getElementById('balance-amount');
  const betInput = document.getElementById('bet-amount');

  let balance = 100;
  let point = null;

  function updateBalance() {
    balanceSpan.textContent = balance.toFixed(2);
  }

  function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function renderDice(d1, d2) {
    diceDiv.textContent = `${d1} + ${d2} = ${d1 + d2}`;
  }

  function playRound() {
    const bet = parseFloat(betInput.value);
    if (isNaN(bet) || bet <= 0 || bet > balance) {
      messageDiv.textContent = 'Invalid bet.';
      return;
    }

    const d1 = rollDie();
    const d2 = rollDie();
    const sum = d1 + d2;
    renderDice(d1, d2);

    if (point === null) {
      if (sum === 7 || sum === 11) {
        balance += bet;
        messageDiv.textContent = `You rolled ${sum}. You win!`;
      } else if ([2, 3, 12].includes(sum)) {
        balance -= bet;
        messageDiv.textContent = `You rolled ${sum}. Craps! You lose.`;
      } else {
        point = sum;
        messageDiv.textContent = `Point is ${point}. Roll again.`;
        updateBalance();
        return;
      }
    } else {
      if (sum === point) {
        balance += bet;
        messageDiv.textContent = `You rolled ${sum}. You hit your point!`;
        point = null;
      } else if (sum === 7) {
        balance -= bet;
        messageDiv.textContent = `You rolled 7 before hitting ${point}. You lose.`;
        point = null;
      } else {
        messageDiv.textContent = `You rolled ${sum}. Roll again for ${point}.`;
        updateBalance();
        return;
      }
    }

    updateBalance();
  }

  rollButton.addEventListener('click', playRound);
  updateBalance();
});
