const axios = require('axios');

const api = axios.create({
  baseURL: 'https://www.okx.com',
  timeout: 10000,
});

// OI for a swap instrument
async function getOI(symbol = 'BTC') {
  const { data } = await api.get('/api/v5/public/open-interest', {
    params: { instType: 'SWAP', instFamily: `${symbol}-USDT` },
  });
  const item = data.data?.[0];
  return item ? { symbol, oi: +item.oi, oiUsd: +item.oiUsd, ts: +item.ts } : null;
}

// OI + Volume history (hourly)
async function getOIHistory(symbol = 'BTC', period = '1H') {
  const { data } = await api.get('/api/v5/rubik/stat/contracts/open-interest-volume', {
    params: { ccy: symbol, period },
  });
  return (data.data || []).map(d => ({
    ts: +d[0], oi: +d[1], volume: +d[2],
  }));
}

// Current funding rate
async function getFundingRate(symbol = 'BTC') {
  const { data } = await api.get('/api/v5/public/funding-rate', {
    params: { instId: `${symbol}-USDT-SWAP` },
  });
  const item = data.data?.[0];
  return item ? {
    symbol,
    rate: +item.fundingRate,
    nextRate: item.nextFundingRate ? +item.nextFundingRate : null,
    settledRate: +item.settFundingRate,
    ts: +item.ts,
  } : null;
}

// Funding rate history
async function getFundingHistory(symbol = 'BTC', limit = 50) {
  const { data } = await api.get('/api/v5/public/funding-rate-history', {
    params: { instId: `${symbol}-USDT-SWAP`, limit },
  });
  return (data.data || []).map(d => ({
    rate: +d.fundingRate, realizedRate: +d.realizedRate, ts: +d.fundingTime,
  }));
}

// Liquidation orders (real-time, filled)
async function getLiquidations(symbol = 'BTC', limit = 100) {
  const { data } = await api.get('/api/v5/public/liquidation-orders', {
    params: { instType: 'SWAP', instFamily: `${symbol}-USDT`, state: 'filled', limit },
  });
  const orders = [];
  (data.data || []).forEach(batch => {
    (batch.details || []).forEach(d => {
      orders.push({
        symbol,
        side: d.posSide, // long or short
        price: +d.bkPx,
        size: +d.sz,
        ts: +d.ts,
      });
    });
  });
  return orders;
}

// Long/Short account ratio
async function getLSRatio(symbol = 'BTC', period = '1H') {
  const { data } = await api.get('/api/v5/rubik/stat/contracts/long-short-account-ratio', {
    params: { ccy: symbol, period },
  });
  return (data.data || []).map(d => ({
    ts: +d[0], ratio: +d[1],
  }));
}

// Taker buy/sell volume
async function getTakerVolume(symbol = 'BTC', period = '1H') {
  const { data } = await api.get('/api/v5/rubik/stat/taker-volume', {
    params: { ccy: symbol, instType: 'CONTRACTS', period },
  });
  return (data.data || []).map(d => ({
    ts: +d[0], buyVol: +d[1], sellVol: +d[2],
  }));
}

// Top trader sentiment (long/short position ratio)
async function getTopTraderRatio(symbol = 'BTC', period = '1H') {
  const { data } = await api.get('/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader', {
    params: { ccy: symbol, period },
  });
  return (data.data || []).map(d => ({
    ts: +d[0], ratio: +d[1],
  }));
}

module.exports = {
  getOI, getOIHistory, getFundingRate, getFundingHistory,
  getLiquidations, getLSRatio, getTakerVolume, getTopTraderRatio,
};
