require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Binance, OKX, Hyperliquid, Aster } = require('./api/exchanges');
const cg = require('./api/coinglass');
const { analyzeSymbol } = require('./analysis/whale-detector');

const app = express();
app.use(cors());

// --- Basic Auth middleware ---
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'cCm0X0EUPAFlak/w';

app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Whale Dashboard"');
    return res.status(401).send('Authentication required');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === AUTH_USER && pass === AUTH_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Whale Dashboard"');
  return res.status(401).send('Invalid credentials');
});

app.use(express.static(path.join(__dirname, '../public')));

// --- Cache with TTL and max-size eviction ---
const cache = new Map();
const CACHE_TTL = 30_000;
const CACHE_MAX_SIZE = 500;

async function cached(key, fn) {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && now - entry.ts < CACHE_TTL) return entry.data;
  try {
    const data = await fn();
    // Evict oldest entries when cache exceeds max size
    if (cache.size >= CACHE_MAX_SIZE) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(key, { data, ts: now });
    return data;
  } catch (e) {
    console.error(`[cache] ${key}:`, e.message);
    return entry?.data || null;
  }
}

const TOP_SYMBOLS = [
  'BTC','ETH','SOL','XRP','BNB','DOGE','ADA','AVAX','LINK','SUI',
  'DOT','PEPE','NEAR','WIF','FIL','ARB','OP','APT','TIA','AAVE',
  'UNI','TON','ATOM','INJ','SEI','JUP','PENDLE','RENDER','WLD','FET',
];

const TIME_RANGE_CONFIG = {
  '15m': { bnOiPeriod: '5m', bnOiLimit: 3, klInterval: '1m', klLimit: 15, lsPeriod: '5m', lsLimit: 3, takerPeriod: '5m', takerLimit: 3, fundingLimit: 5 },
  '30m': { bnOiPeriod: '5m', bnOiLimit: 6, klInterval: '1m', klLimit: 30, lsPeriod: '5m', lsLimit: 6, takerPeriod: '5m', takerLimit: 6, fundingLimit: 5 },
  '1h':  { bnOiPeriod: '5m', bnOiLimit: 12, klInterval: '5m', klLimit: 12, lsPeriod: '5m', lsLimit: 12, takerPeriod: '5m', takerLimit: 12, fundingLimit: 5 },
  '4h':  { bnOiPeriod: '15m', bnOiLimit: 16, klInterval: '15m', klLimit: 16, lsPeriod: '15m', lsLimit: 16, takerPeriod: '15m', takerLimit: 16, fundingLimit: 10 },
  '12h': { bnOiPeriod: '30m', bnOiLimit: 24, klInterval: '30m', klLimit: 24, lsPeriod: '30m', lsLimit: 24, takerPeriod: '30m', takerLimit: 24, fundingLimit: 15 },
  '24h': { bnOiPeriod: '1h', bnOiLimit: 24, klInterval: '1h', klLimit: 24, lsPeriod: '1h', lsLimit: 24, takerPeriod: '1h', takerLimit: 24, fundingLimit: 20 },
  '3d':  { bnOiPeriod: '4h', bnOiLimit: 18, klInterval: '4h', klLimit: 18, lsPeriod: '4h', lsLimit: 18, takerPeriod: '4h', takerLimit: 18, fundingLimit: 30 },
  '7d':  { bnOiPeriod: '4h', bnOiLimit: 42, klInterval: '4h', klLimit: 42, lsPeriod: '4h', lsLimit: 42, takerPeriod: '4h', takerLimit: 42, fundingLimit: 30 },
};

// --- Input validation helper ---
function validateSymbol(sym) {
  return /^[A-Z0-9]{1,20}$/.test(sym);
}

function timeRangeToMs(range) {
  const value = Number.parseInt(range, 10);
  if (range.endsWith('m')) return value * 60 * 1000;
  if (range.endsWith('h')) return value * 60 * 60 * 1000;
  if (range.endsWith('d')) return value * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

// === Main dashboard (Coinglass aggregated view) ===
app.get('/api/dashboard', async (req, res) => {
  try {
    const [binanceTickers, liquidations, fearGreed] = await Promise.all([
      cached('bn-tickers', Binance.getAll24h),
      cached('liquidations', cg.getLiquidationCoinList),
      cached('fearGreed', cg.getFearGreed),
    ]);

    // Coinglass OI + Funding — batched parallel with concurrency limit
    const symbols = TOP_SYMBOLS.slice(0, 20);
    const cgResults = await Promise.all(
      symbols.map(sym => Promise.all([
        cached(`cg-oi-${sym}`, () => cg.getOIByExchange(sym)),
        cached(`cg-fr-${sym}`, () => cg.getFundingByExchange(sym)),
      ]))
    );
    const cgData = {};
    symbols.forEach((sym, i) => {
      cgData[sym] = { oi: cgResults[i][0], funding: cgResults[i][1] };
    });

    const coins = {};
    for (const sym of TOP_SYMBOLS) {
      const ticker = binanceTickers?.find(t => t.symbol === sym);
      const liq = liquidations?.find(l => l.symbol === sym);
      const oiAll = cgData[sym]?.oi?.find(e => e.exchange === 'All');
      const oiByExchange = cgData[sym]?.oi?.filter(e => e.exchange !== 'All') || [];
      const fundingData = cgData[sym]?.funding?.[0];

      let avgFR = null;
      const frByExchange = [];
      if (fundingData?.stablecoin_margin_list?.length) {
        const list = fundingData.stablecoin_margin_list;
        avgFR = list.reduce((s, e) => s + (e.funding_rate || 0), 0) / list.length;
        list.forEach(e => frByExchange.push({
          exchange: e.exchange, rate: e.funding_rate, interval: e.funding_rate_interval,
        }));
      }

      coins[sym] = {
        price: ticker?.price, change24h: ticker?.change24h, volume24h: ticker?.volume24h,
        oi: oiAll ? {
          usd: oiAll.open_interest_usd,
          change5m: oiAll.open_interest_change_percent_5m,
          change15m: oiAll.open_interest_change_percent_15m,
          change1h: oiAll.open_interest_change_percent_1h,
          change4h: oiAll.open_interest_change_percent_4h,
          change24h: oiAll.open_interest_change_percent_24h,
        } : null,
        oiByExchange: oiByExchange.slice(0, 10).map(e => ({
          exchange: e.exchange, usd: e.open_interest_usd,
          change1h: e.open_interest_change_percent_1h,
          change24h: e.open_interest_change_percent_24h,
        })),
        fundingRate: avgFR,
        fundingByExchange: frByExchange,
        liquidation: liq,
      };
    }

    res.json({ ok: true, ts: Date.now(), coins, fearGreed });
  } catch (e) {
    console.error('[dashboard]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// === Deep analysis: per-exchange breakdown ===
app.get('/api/analyze/:symbol', async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    if (!validateSymbol(sym)) {
      return res.status(400).json({ ok: false, error: 'Invalid symbol' });
    }
    const queryTimeRange = typeof req.query.timeRange === 'string' ? req.query.timeRange : '24h';
    const timeRange = Object.prototype.hasOwnProperty.call(TIME_RANGE_CONFIG, queryTimeRange) ? queryTimeRange : '24h';
    const cfg = TIME_RANGE_CONFIG[timeRange];

    // Fetch from each exchange in parallel
    const [bnData, okxData, hlData, asterData, cgLiqs, cgTransfers] = await Promise.all([
      // Binance
      (async () => {
        const [oiHist, frHist, klines, ls, taker, ticker] = await Promise.all([
          cached(`bn-oi-${sym}-${timeRange}`, () => Binance.getOIHistory(sym, cfg.bnOiPeriod, cfg.bnOiLimit)),
          cached(`bn-fr-${sym}-${timeRange}`, () => Binance.getFundingHistory(sym, cfg.fundingLimit)),
          cached(`bn-kl-${sym}-${timeRange}`, () => Binance.getKlines(sym, cfg.klInterval, cfg.klLimit)),
          cached(`bn-ls-${sym}-${timeRange}`, () => Binance.getLSRatio(sym, cfg.lsPeriod, cfg.lsLimit)),
          cached(`bn-tk-${sym}-${timeRange}`, () => Binance.getTakerVolume(sym, cfg.takerPeriod, cfg.takerLimit)),
          cached(`bn-24h-${sym}-${timeRange}`, () => Binance.get24hTicker(sym)),
        ]);
        return { oiHistory: oiHist, fundingHistory: frHist, klines, lsRatio: ls, takerVolume: taker, ticker };
      })(),
      // OKX
      (async () => {
        const [oi, oiHist, fr, frHist, liqs, ls, taker] = await Promise.all([
          cached(`okx-oi-${sym}-${timeRange}`, () => OKX.getOI(sym)),
          cached(`okx-oih-${sym}-${timeRange}`, () => OKX.getOIHistory(sym)),
          cached(`okx-fr-${sym}-${timeRange}`, () => OKX.getFundingRate(sym)),
          cached(`okx-frh-${sym}-${timeRange}`, () => OKX.getFundingHistory(sym, cfg.fundingLimit)),
          cached(`okx-liq-${sym}-${timeRange}`, () => OKX.getLiquidations(sym)),
          cached(`okx-ls-${sym}-${timeRange}`, () => OKX.getLSRatio(sym)),
          cached(`okx-tk-${sym}-${timeRange}`, () => OKX.getTakerVolume(sym)),
        ]);
        return { oi, oiHistory: oiHist, funding: fr, fundingHistory: frHist, liquidations: liqs?.slice(0, 30), lsRatio: ls, takerVolume: taker };
      })(),
      // Hyperliquid
      (async () => {
        const hlFundingStartTime = Date.now() - timeRangeToMs(timeRange);
        const [market, frHist, trades] = await Promise.all([
          cached(`hl-market-${sym}-${timeRange}`, () => Hyperliquid.getMarket(sym)),
          cached(`hl-fr-${sym}-${timeRange}`, () => Hyperliquid.getFundingHistory(sym, hlFundingStartTime).catch(() => null)),
          cached(`hl-trades-${sym}-${timeRange}`, () => Hyperliquid.getRecentTrades(sym).catch(() => null)),
        ]);
        return { market, fundingHistory: frHist, recentTrades: trades };
      })(),
      // Aster
      (async () => {
        const [oi, frHist, ticker] = await Promise.all([
          cached(`ast-oi-${sym}-${timeRange}`, () => Aster.getOI(sym).catch(() => null)),
          cached(`ast-fr-${sym}-${timeRange}`, () => Aster.getFundingHistory(sym, cfg.fundingLimit).catch(() => null)),
          cached(`ast-24h-${sym}-${timeRange}`, () => Aster.get24hTicker(sym).catch(() => null)),
        ]);
        return { oi, fundingHistory: frHist, ticker };
      })(),
      // Coinglass aggregated
      cached(`liquidations-${timeRange}`, cg.getLiquidationCoinList),
      cached(`transfers-${sym}-${timeRange}`, () => cg.getChainTransfers(sym, 100).catch(() => null)),
    ]);

    const cgLiq = cgLiqs?.find(l => l.symbol === sym);

    // Run analysis using all data
    const signals = analyzeSymbol(sym, {
      oiHistory: bnData.oiHistory,
      fundingHistory: bnData.fundingHistory,
      klines: bnData.klines,
      lsRatio: bnData.lsRatio,
      takerRatio: bnData.takerVolume,
      liquidation: cgLiq,
      transfers: cgTransfers,
    });

    // Cross-exchange funding rate comparison for arbitrage detection
    const fundingComparison = {};
    const bnLatestFR = bnData.fundingHistory?.slice(-1)[0]?.rate;
    const okxLatestFR = okxData.funding?.rate;
    const hlFR = hlData.market?.funding;
    const asterLatestFR = asterData.fundingHistory?.slice(-1)[0]?.rate;
    
    if (bnLatestFR != null) fundingComparison.binance = bnLatestFR;
    if (okxLatestFR != null) fundingComparison.okx = okxLatestFR;
    if (hlFR != null) fundingComparison.hyperliquid = hlFR;
    if (asterLatestFR != null) fundingComparison.aster = asterLatestFR;

    // Detect funding arbitrage traps
    const rates = Object.values(fundingComparison).filter(r => r != null);
    if (rates.length >= 2) {
      const maxRate = Math.max(...rates);
      const minRate = Math.min(...rates);
      const maxExchange = Object.entries(fundingComparison).find(([,r]) => r === maxRate)?.[0];
      const minExchange = Object.entries(fundingComparison).find(([,r]) => r === minRate)?.[0];
      
      if (maxRate - minRate > 0.0005) {
        signals.push({
          level: maxRate - minRate > 0.002 ? 'danger' : 'warning',
          type: 'cross_exchange_funding_gap',
          title: `${sym} 跨所费率差异巨大`,
          detail: `${maxExchange}: ${(maxRate*100).toFixed(4)}% vs ${minExchange}: ${(minRate*100).toFixed(4)}% (差 ${((maxRate-minRate)*100).toFixed(4)}%)`,
          interpretation: `${maxExchange}费率远高于${minExchange}。如果是链上DEX(HL/Aster)费率异常高，可能是庄家故意拉高费率吸引套利者进场，然后反向收割`,
        });
      }
    }

    res.json({
      ok: true, symbol: sym, signals,
      exchanges: {
        binance: bnData,
        okx: okxData,
        hyperliquid: hlData,
        aster: asterData,
      },
      fundingComparison,
      aggregated: { liquidation: cgLiq, transfers: cgTransfers?.slice(0, 30) },
    });
  } catch (e) {
    console.error('[analyze]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// === Quick scan ===
app.get('/api/scan', async (req, res) => {
  try {
    const scanCfg = TIME_RANGE_CONFIG['24h'];
    const allSignals = [];
    for (const sym of TOP_SYMBOLS.slice(0, 15)) {
      try {
        const [oiHist, frHist, klines, ls, taker] = await Promise.all([
          cached(`bn-oi-${sym}`, () => Binance.getOIHistory(sym, scanCfg.bnOiPeriod, scanCfg.bnOiLimit)),
          cached(`bn-fr-${sym}`, () => Binance.getFundingHistory(sym, scanCfg.fundingLimit)),
          cached(`bn-kl-${sym}`, () => Binance.getKlines(sym, scanCfg.klInterval, scanCfg.klLimit)),
          cached(`bn-ls-${sym}`, () => Binance.getLSRatio(sym, scanCfg.lsPeriod, scanCfg.lsLimit)),
          cached(`bn-tk-${sym}`, () => Binance.getTakerVolume(sym, scanCfg.takerPeriod, scanCfg.takerLimit)),
        ]);
        const liquidations = await cached('liquidations', cg.getLiquidationCoinList);
        const liq = liquidations?.find(l => l.symbol === sym);
        const sigs = analyzeSymbol(sym, { oiHistory: oiHist, fundingHistory: frHist, klines, lsRatio: ls, takerRatio: taker, liquidation: liq });
        sigs.forEach(s => allSignals.push({ ...s, symbol: sym }));
      } catch (e) { console.error(`[scan] ${sym}:`, e.message); }
    }
    allSignals.sort((a, b) => ({ danger: 0, warning: 1, info: 2 }[a.level] || 3) - ({ danger: 0, warning: 1, info: 2 }[b.level] || 3));
    res.json({ ok: true, ts: Date.now(), signals: allSignals });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// CG endpoints — with error handling
app.get('/api/cg/oi/:symbol', async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    if (!validateSymbol(sym)) return res.status(400).json({ ok: false, error: 'Invalid symbol' });
    res.json({ ok: true, data: await cg.getOIByExchange(sym) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/cg/funding/:symbol', async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    if (!validateSymbol(sym)) return res.status(400).json({ ok: false, error: 'Invalid symbol' });
    res.json({ ok: true, data: await cg.getFundingByExchange(sym) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/transfers/:symbol', async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    if (!validateSymbol(sym)) return res.status(400).json({ ok: false, error: 'Invalid symbol' });
    res.json({ ok: true, data: await cg.getChainTransfers(sym, 100) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// --- Graceful shutdown ---
const PORT = process.env.PORT || 3456;
const server = app.listen(PORT, '0.0.0.0', () => console.log(`🐋 Whale Dashboard running on http://localhost:${PORT}`));

function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force exit after 5s if connections hang
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
