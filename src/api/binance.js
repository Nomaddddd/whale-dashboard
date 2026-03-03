const axios = require('axios');

const spot = axios.create({ baseURL: 'https://api.binance.com', timeout: 10000 });
const futures = axios.create({ baseURL: 'https://fapi.binance.com', timeout: 10000 });

// === Spot ===
async function getSpotPrices() {
  const { data } = await spot.get('/api/v3/ticker/24hr');
  return data.filter(t => t.symbol.endsWith('USDT')).map(t => ({
    symbol: t.symbol.replace('USDT', ''),
    price: +t.lastPrice,
    change24h: +t.priceChangePercent,
    volume24h: +t.quoteVolume,
    high24h: +t.highPrice,
    low24h: +t.lowPrice,
  }));
}

// === Futures ===

// Current OI for a symbol
async function getOI(symbol = 'BTCUSDT') {
  const { data } = await futures.get('/fapi/v1/openInterest', { params: { symbol } });
  return { symbol, openInterest: +data.openInterest, time: data.time };
}

// OI history (free, 1h/2h/4h/6h/12h/1d)
async function getOIHistory(symbol = 'BTCUSDT', period = '1h', limit = 48) {
  const { data } = await futures.get('/futures/data/openInterestHist', {
    params: { symbol, period, limit },
  });
  return data.map(d => ({
    symbol: d.symbol,
    oi: +d.sumOpenInterest,
    oiValue: +d.sumOpenInterestValue,
    ts: d.timestamp,
  }));
}

// Funding rate history
async function getFundingHistory(symbol = 'BTCUSDT', limit = 100) {
  const { data } = await futures.get('/fapi/v1/fundingRate', {
    params: { symbol, limit },
  });
  return data.map(d => ({
    symbol: d.symbol,
    rate: +d.fundingRate,
    markPrice: +d.markPrice,
    ts: d.fundingTime,
  }));
}

// Price klines
async function getKlines(symbol = 'BTCUSDT', interval = '1h', limit = 100) {
  const { data } = await futures.get('/fapi/v1/klines', {
    params: { symbol, interval, limit },
  });
  return data.map(k => ({
    ts: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4],
    volume: +k[5], quoteVolume: +k[7],
  }));
}

// Top trader long/short ratio
async function getTopLSRatio(symbol = 'BTCUSDT', period = '1h', limit = 30) {
  const { data } = await futures.get('/futures/data/topLongShortAccountRatio', {
    params: { symbol, period, limit },
  });
  return data.map(d => ({
    longRatio: +d.longAccount,
    shortRatio: +d.shortAccount,
    lsRatio: +d.longShortRatio,
    ts: d.timestamp,
  }));
}

// Taker buy/sell volume ratio
async function getTakerRatio(symbol = 'BTCUSDT', period = '1h', limit = 30) {
  const { data } = await futures.get('/futures/data/takerlongshortRatio', {
    params: { symbol, period, limit },
  });
  return data.map(d => ({
    buySellRatio: +d.buySellRatio,
    buyVol: +d.buyVol,
    sellVol: +d.sellVol,
    ts: d.timestamp,
  }));
}

// 24h ticker for all futures
async function getFutures24h() {
  const { data } = await futures.get('/fapi/v1/ticker/24hr');
  return data.filter(t => t.symbol.endsWith('USDT')).map(t => ({
    symbol: t.symbol.replace('USDT', ''),
    pair: t.symbol,
    price: +t.lastPrice,
    change24h: +t.priceChangePercent,
    volume24h: +t.quoteVolume,
    high24h: +t.highPrice,
    low24h: +t.lowPrice,
  }));
}

// Get all futures symbols
async function getFuturesSymbols() {
  const { data } = await futures.get('/fapi/v1/exchangeInfo');
  return data.symbols
    .filter(s => s.status === 'TRADING' && s.contractType === 'PERPETUAL' && s.quoteAsset === 'USDT')
    .map(s => s.symbol);
}

module.exports = {
  getSpotPrices, getOI, getOIHistory, getFundingHistory,
  getKlines, getTopLSRatio, getTakerRatio, getFutures24h, getFuturesSymbols,
};
