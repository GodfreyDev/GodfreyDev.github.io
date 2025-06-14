document.addEventListener('DOMContentLoaded', () => {
  const cells = Array.from(document.querySelectorAll('.classic-cell'));
  const resultDiv = document.getElementById('classic-result');
  const balanceSpan = document.getElementById('balance-amount');
  const spinButton = document.getElementById('classic-spin-button');
  let balance = loadCasinoBalance();
  updateBalance();

  const symbols = ['🍒','🔔','🍋','7️⃣','💎'];
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  spinButton.addEventListener('click', () => {
    const bet = 1;
    if (balance < bet) {
      resultDiv.textContent = 'Not enough balance.';
      return;
    }
    balance -= bet;
    const results = [];
    cells.forEach(cell => {
      cell.classList.remove('classic-win');
      const sym = symbols[Math.floor(Math.random()*symbols.length)];
      cell.textContent = sym;
      results.push(sym);
    });
    let win = false;
    lines.forEach(line => {
      if (results[line[0]] === results[line[1]] && results[line[1]] === results[line[2]]) {
        win = true;
        line.forEach(i => cells[i].classList.add('classic-win'));
      }
    });
    if (win) {
      const prize = bet * 10;
      balance += prize;
      resultDiv.textContent = `You won $${prize}!`;
    } else {
      resultDiv.textContent = 'Try again!';
    }
    updateBalance();
    saveCasinoBalance(balance);
  });

  function updateBalance() {
    balanceSpan.textContent = balance.toFixed(2);
  }
});
