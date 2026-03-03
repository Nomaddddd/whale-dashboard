const axios = require('axios');

const API_KEY = process.env.CG_API_KEY || 'eec6cf803b404ec59ce59261f9879f0c';
const BASE = 'https://open-api-v4.coinglass.com';

const cg = axios.create({
  baseURL: BASE,
  headers: { 'CG-API-KEY': API_KEY },
  timeout: 10000,
});

// Rate limiter: max 2 req/sec
let lastReqTime = 0;
async function rateLimit() {
  const now = Date.now();
  const wait = Math.max(0, 500 - (now - lastReqTime));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReqTime = Date.now();
}

// Retry wrapper
async function fetch(path, params = {}) {
  await rateLimit();
  try {
    const { data } = await cg.get(path, { params });
    if (data.code === '0') return data.data;
    if (data.msg === 'Too Many Requests') {
      await new Promise(r => setTimeout(r, 2000));
      const { data: retry } = await cg.get(path, { params });
      if (retry.code === '0') return retry.data;
    }
    console.error(`[CG] ${path}: ${data.msg}`);
    return null;
  } catch (e) {
    console.error(`[CG] ${path}: ${e.message}`);
    return null;
  }
}

// === Core Data Fetchers ===

// All coins OI by exchange (with % changes)
async function getOIByExchange(symbol) {
  return fetch('/api/futures/open-interest/exchange-list', { symbol });
}

// All coins funding rate by exchange
async function getFundingByExchange(symbol) {
  return fetch('/api/futures/funding-rate/exchange-list', { symbol });
}

// All coins liquidation summary
async function getLiquidationCoinList() {
  return fetch('/api/futures/liquidation/coin-list');
}

// Liquidation by exchange for specific coin
async function getLiquidationByExchange(symbol, range = '24h') {
  return fetch('/api/futures/liquidation/exchange-list', { symbol, range });
}

// On-chain exchange transfers (inflow/outflow)
async function getChainTransfers(coin, limit = 50) {
  return fetch('/api/exchange/chain/tx/list', { coin, limit });
}

// Supported coins list
async function getSupportedCoins() {
  return fetch('/api/futures/supported-coins');
}

// Fear & Greed Index
async function getFearGreed() {
  return fetch('/api/index/fear-greed-history');
}

// === Batch: get all major data for dashboard ===
async function getDashboardData(symbols = ['BTC', 'ETH', 'SOL']) {
  const [liquidations, fearGreed, ...oiAndFunding] = await Promise.all([
    getLiquidationCoinList(),
    getFearGreed(),
    ...symbols.flatMap(s => [
      getOIByExchange(s),
      getFundingByExchange(s),
    ]),
  ]);

  const coins = {};
  symbols.forEach((s, i) => {
    coins[s] = {
      oi: oiAndFunding[i * 2],
      funding: oiAndFunding[i * 2 + 1],
      liquidation: liquidations?.find(l => l.symbol === s) || null,
    };
  });

  return { coins, liquidations, fearGreed };
}

module.exports = {
  getOIByExchange,
  getFundingByExchange,
  getLiquidationCoinList,
  getLiquidationByExchange,
  getChainTransfers,
  getSupportedCoins,
  getFearGreed,
  getDashboardData,
};
