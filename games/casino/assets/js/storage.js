(function(global){
  function loadCasinoBalance(){
    const saved = global.localStorage.getItem('casinoBalance');
    return saved ? parseFloat(saved) : 100;
  }

  function saveCasinoBalance(balance){
    global.localStorage.setItem('casinoBalance', String(balance));
  }

  global.loadCasinoBalance = loadCasinoBalance;
  global.saveCasinoBalance = saveCasinoBalance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadCasinoBalance, saveCasinoBalance };
  }
})(typeof window !== 'undefined' ? window : global);
