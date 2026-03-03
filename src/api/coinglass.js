const axios = require('axios');

const API_KEY = process.env.CG_API_KEY;
if (!API_KEY) {
  console.warn('[CG] Warning: CG_API_KEY not set. Coinglass endpoints will fail. Set it in .env or environment.');
}
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
async function cgFetch(path, params = {}) {
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
  return cgFetch('/api/futures/open-interest/exchange-list', { symbol });
}

// All coins funding rate by exchange
async function getFundingByExchange(symbol) {
  return cgFetch('/api/futures/funding-rate/exchange-list', { symbol });
}

// All coins liquidation summary
async function getLiquidationCoinList() {
  return cgFetch('/api/futures/liquidation/coin-list');
}

// Liquidation by exchange for specific coin
async function getLiquidationByExchange(symbol, range = '24h') {
  return cgFetch('/api/futures/liquidation/exchange-list', { symbol, range });
}

// On-chain exchange transfers (inflow/outflow)
async function getChainTransfers(coin, limit = 50) {
  return cgFetch('/api/exchange/chain/tx/list', { coin, limit });
}

// Supported coins list
async function getSupportedCoins() {
  return cgFetch('/api/futures/supported-coins');
}

// Fear & Greed Index
async function getFearGreed() {
  return cgFetch('/api/index/fear-greed-history');
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
