/**
 * 统一交易所数据接口
 * Binance + OKX + Hyperliquid + Aster
 */
const axios = require('axios');

const binanceApi = axios.create({ baseURL: 'https://fapi.binance.com', timeout: 10000 });
const okxApi = axios.create({ baseURL: 'https://www.okx.com', timeout: 10000 });
const hlApi = axios.create({ baseURL: 'https://api.hyperliquid.xyz', timeout: 10000 });
const asterApi = axios.create({ baseURL: 'https://www.asterdex.com', timeout: 10000 });

// ============ BINANCE ============
const Binance = {
  name: 'Binance',
  async getOIHistory(symbol, period = '1h', limit = 48) {
    const { data } = await binanceApi.get('/futures/data/openInterestHist', { params: { symbol: symbol+'USDT', period, limit } });
    return data.map(d => ({ oi: +d.sumOpenInterest, oiValue: +d.sumOpenInterestValue, ts: d.timestamp }));
  },
  async getFundingHistory(symbol, limit = 30) {
    const { data } = await binanceApi.get('/fapi/v1/fundingRate', { params: { symbol: symbol+'USDT', limit } });
    return data.map(d => ({ rate: +d.fundingRate, markPrice: +d.markPrice, ts: d.fundingTime }));
  },
  async getKlines(symbol, interval = '1h', limit = 48) {
    const { data } = await binanceApi.get('/fapi/v1/klines', { params: { symbol: symbol+'USDT', interval, limit } });
    return data.map(k => ({ ts: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
  },
  async getLSRatio(symbol, period = '1h', limit = 24) {
    const { data } = await binanceApi.get('/futures/data/topLongShortAccountRatio', { params: { symbol: symbol+'USDT', period, limit } });
    return data.map(d => ({ longRatio: +d.longAccount, shortRatio: +d.shortAccount, lsRatio: +d.longShortRatio, ts: d.timestamp }));
  },
  async getTakerVolume(symbol, period = '1h', limit = 24) {
    const { data } = await binanceApi.get('/futures/data/takerlongshortRatio', { params: { symbol: symbol+'USDT', period, limit } });
    return data.map(d => ({ buySellRatio: +d.buySellRatio, buyVol: +d.buyVol, sellVol: +d.sellVol, ts: d.timestamp }));
  },
  async get24hTicker(symbol) {
    const { data } = await binanceApi.get('/fapi/v1/ticker/24hr', { params: { symbol: symbol+'USDT' } });
    return { price: +data.lastPrice, change24h: +data.priceChangePercent, volume24h: +data.quoteVolume };
  },
  async getAll24h() {
    const { data } = await binanceApi.get('/fapi/v1/ticker/24hr');
    return data.filter(t => t.symbol.endsWith('USDT')).map(t => ({
      symbol: t.symbol.replace('USDT', ''), price: +t.lastPrice, change24h: +t.priceChangePercent, volume24h: +t.quoteVolume,
    }));
  },
};

// ============ OKX ============
const OKX = {
  name: 'OKX',
  async getOI(symbol) {
    const { data } = await okxApi.get('/api/v5/public/open-interest', { params: { instType: 'SWAP', instFamily: `${symbol}-USDT` } });
    const i = data.data?.[0];
    return i ? { oi: +i.oi, oiUsd: +i.oiUsd, ts: +i.ts } : null;
  },
  async getOIHistory(symbol) {
    const { data } = await okxApi.get('/api/v5/rubik/stat/contracts/open-interest-volume', { params: { ccy: symbol, period: '1H' } });
    return (data.data || []).map(d => ({ oi: +d[1], volume: +d[2], ts: +d[0] }));
  },
  async getFundingRate(symbol) {
    const { data } = await okxApi.get('/api/v5/public/funding-rate', { params: { instId: `${symbol}-USDT-SWAP` } });
    const i = data.data?.[0];
    return i ? { rate: +i.fundingRate, settledRate: +i.settFundingRate, ts: +i.ts } : null;
  },
  async getFundingHistory(symbol, limit = 30) {
    const { data } = await okxApi.get('/api/v5/public/funding-rate-history', { params: { instId: `${symbol}-USDT-SWAP`, limit } });
    return (data.data || []).map(d => ({ rate: +d.fundingRate, ts: +d.fundingTime }));
  },
  async getLiquidations(symbol) {
    const { data } = await okxApi.get('/api/v5/public/liquidation-orders', { params: { instType: 'SWAP', instFamily: `${symbol}-USDT`, state: 'filled', limit: 100 } });
    const orders = [];
    (data.data || []).forEach(b => (b.details || []).forEach(d => {
      orders.push({ side: d.posSide, price: +d.bkPx, size: +d.sz, ts: +d.ts });
    }));
    return orders;
  },
  async getLSRatio(symbol) {
    const { data } = await okxApi.get('/api/v5/rubik/stat/contracts/long-short-account-ratio', { params: { ccy: symbol, period: '1H' } });
    return (data.data || []).map(d => ({ ratio: +d[1], ts: +d[0] }));
  },
  async getTakerVolume(symbol) {
    const { data } = await okxApi.get('/api/v5/rubik/stat/taker-volume', { params: { ccy: symbol, instType: 'CONTRACTS', period: '1H' } });
    return (data.data || []).map(d => ({ buyVol: +d[1], sellVol: +d[2], ts: +d[0] }));
  },
};

// ============ HYPERLIQUID ============
let hlMetaCache = null;
let hlMetaCacheTs = 0;

const Hyperliquid = {
  name: 'Hyperliquid',

  // Get all market data at once (very efficient - single call)
  async getAllMarkets() {
    const now = Date.now();
    if (hlMetaCache && now - hlMetaCacheTs < 15000) return hlMetaCache;
    const { data } = await hlApi.post('/info', { type: 'metaAndAssetCtxs' });
    const meta = data[0].universe;
    const ctxs = data[1];
    const result = {};
    meta.forEach((m, i) => {
      const c = ctxs[i];
      result[m.name] = {
        symbol: m.name,
        price: +c.markPx,
        funding: +c.funding,
        openInterest: +c.openInterest,
        oiUsd: +c.openInterest * +c.markPx,
        volume24h: +c.dayNtlVlm,
        premium: +(c.premium || 0),
      };
    });
    hlMetaCache = result;
    hlMetaCacheTs = now;
    return result;
  },

  async getMarket(symbol) {
    const all = await this.getAllMarkets();
    return all[symbol] || null;
  },

  async getFundingHistory(symbol, startTime) {
    const params = { type: 'fundingHistory', coin: symbol };
    if (startTime) params.startTime = startTime;
    const { data } = await hlApi.post('/info', params);
    return data.map(d => ({ rate: +d.fundingRate, premium: +d.premium, ts: d.time }));
  },

  async getRecentTrades(symbol) {
    const { data } = await hlApi.post('/info', { type: 'recentTrades', coin: symbol });
    return data.map(d => ({
      side: d.side, price: +d.px, size: +d.sz, ts: d.time,
      usd: +d.px * +d.sz,
    }));
  },

  // Get large positions (whale positions visible on-chain)
  async getClearinghouseState(address) {
    const { data } = await hlApi.post('/info', { type: 'clearinghouseState', user: address });
    return data;
  },
};

// ============ ASTER (BNB Chain DEX) ============
const Aster = {
  name: 'Aster',

  async getOI(symbol) {
    const { data } = await asterApi.get('/fapi/v1/openInterest', { params: { symbol: symbol+'USDT' } });
    return { oi: +data.openInterest, ts: data.time };
  },

  async getFundingHistory(symbol, limit = 100) {
    const { data } = await asterApi.get('/fapi/v1/fundingRate', { params: { symbol: symbol+'USDT', limit } });
    return data.map(d => ({ rate: +d.fundingRate, ts: d.fundingTime }));
  },

  async get24hTicker(symbol) {
    const { data } = await asterApi.get('/fapi/v1/ticker/24hr', { params: { symbol: symbol+'USDT' } });
    return {
      price: +data.lastPrice, change24h: +data.priceChangePercent,
      volume24h: +data.quoteVolume, high24h: +data.highPrice, low24h: +data.lowPrice,
    };
  },

  async getAllTickers() {
    const { data } = await asterApi.get('/fapi/v1/ticker/24hr');
    return data.map(t => ({
      symbol: t.symbol.replace('USDT', ''), pair: t.symbol,
      price: +t.lastPrice, change24h: +t.priceChangePercent, volume24h: +t.quoteVolume,
    }));
  },

  async getKlines(symbol, interval = '1h', limit = 48) {
    const { data } = await asterApi.get('/fapi/v1/klines', { params: { symbol: symbol+'USDT', interval, limit } });
    return data.map(k => ({ ts: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
  },
};

module.exports = { Binance, OKX, Hyperliquid, Aster };
