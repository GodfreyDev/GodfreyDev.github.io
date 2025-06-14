const { loadCasinoBalance, saveCasinoBalance } = require('../games/casino/assets/js/storage.js');

global.localStorage = {
  _data: {},
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
  },
  setItem(key, value) {
    this._data[key] = String(value);
  },
  removeItem(key) {
    delete this._data[key];
  },
  clear() {
    this._data = {};
  }
};

let balance = loadCasinoBalance();
if (balance !== 100) {
  throw new Error(`Expected default balance 100, got ${balance}`);
}

saveCasinoBalance(250);

balance = loadCasinoBalance();
if (balance !== 250) {
  throw new Error(`Expected saved balance 250, got ${balance}`);
}

console.log('All tests passed.');
