document.addEventListener('DOMContentLoaded', () => {
  const balanceSpan = document.getElementById('balance-amount');
  let balance = loadCasinoBalance();
  if (balanceSpan) balanceSpan.textContent = balance.toFixed(2);
});
