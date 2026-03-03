const express = require('express');
const cors = require('cors');
const path = require('path');
const { Binance, OKX, Hyperliquid, Aster } = require('./api/exchanges');
const cg = require('./api/coinglass');
const { analyzeSymbol } = require('./analysis/whale-detector');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Cache
const cache = {};
const CACHE_TTL = 30_000;
async function cached(key, fn) {
  const now = Date.now();
  if (cache[key] && now - cache[key].ts < CACHE_TTL) return cache[key].data;
  try {
    const data = await fn();
    cache[key] = { data, ts: now };
    return data;
  } catch (e) {
    console.error(`[cache] ${key}:`, e.message);
    return cache[key]?.data || null;
  }
}

const TOP_SYMBOLS = [
  'BTC','ETH','SOL','XRP','BNB','DOGE','ADA','AVAX','LINK','SUI',
  'DOT','PEPE','NEAR','WIF','FIL','ARB','OP','APT','TIA','AAVE',
  'UNI','TON','ATOM','INJ','SEI','JUP','PENDLE','RENDER','WLD','FET',
];

// === Main dashboard (Coinglass aggregated view) ===
app.get('/api/dashboard', async (req, res) => {
  try {
    const [binanceTickers, liquidations, fearGreed] = await Promise.all([
      cached('bn-tickers', Binance.getAll24h),
      cached('liquidations', cg.getLiquidationCoinList),
      cached('fearGreed', cg.getFearGreed),
    ]);

    // Coinglass OI + Funding per exchange (sequential for rate limit)
    const cgData = {};
    for (const sym of TOP_SYMBOLS.slice(0, 20)) {
      const [oi, funding] = await Promise.all([
        cached(`cg-oi-${sym}`, () => cg.getOIByExchange(sym)),
        cached(`cg-fr-${sym}`, () => cg.getFundingByExchange(sym)),
      ]);
      cgData[sym] = { oi, funding };
    }

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
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// === Deep analysis: per-exchange breakdown ===
app.get('/api/analyze/:symbol', async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase();

    // Fetch from each exchange in parallel
    const [bnData, okxData, hlData, asterData, cgLiqs, cgTransfers] = await Promise.all([
      // Binance
      (async () => {
        const [oiHist, frHist, klines, ls, taker, ticker] = await Promise.all([
          cached(`bn-oi-${sym}`, () => Binance.getOIHistory(sym, '1h', 48)),
          cached(`bn-fr-${sym}`, () => Binance.getFundingHistory(sym, 30)),
          cached(`bn-kl-${sym}`, () => Binance.getKlines(sym, '1h', 48)),
          cached(`bn-ls-${sym}`, () => Binance.getLSRatio(sym, '1h', 24)),
          cached(`bn-tk-${sym}`, () => Binance.getTakerVolume(sym, '1h', 24)),
          cached(`bn-24h-${sym}`, () => Binance.get24hTicker(sym)),
        ]);
        return { oiHistory: oiHist, fundingHistory: frHist, klines, lsRatio: ls, takerVolume: taker, ticker };
      })(),
      // OKX
      (async () => {
        const [oi, oiHist, fr, frHist, liqs, ls, taker] = await Promise.all([
          cached(`okx-oi-${sym}`, () => OKX.getOI(sym)),
          cached(`okx-oih-${sym}`, () => OKX.getOIHistory(sym)),
          cached(`okx-fr-${sym}`, () => OKX.getFundingRate(sym)),
          cached(`okx-frh-${sym}`, () => OKX.getFundingHistory(sym, 30)),
          cached(`okx-liq-${sym}`, () => OKX.getLiquidations(sym)),
          cached(`okx-ls-${sym}`, () => OKX.getLSRatio(sym)),
          cached(`okx-tk-${sym}`, () => OKX.getTakerVolume(sym)),
        ]);
        return { oi, oiHistory: oiHist, funding: fr, fundingHistory: frHist, liquidations: liqs?.slice(0, 30), lsRatio: ls, takerVolume: taker };
      })(),
      // Hyperliquid
      (async () => {
        const [market, frHist, trades] = await Promise.all([
          cached(`hl-market-${sym}`, () => Hyperliquid.getMarket(sym)),
          cached(`hl-fr-${sym}`, () => Hyperliquid.getFundingHistory(sym).catch(() => null)),
          cached(`hl-trades-${sym}`, () => Hyperliquid.getRecentTrades(sym).catch(() => null)),
        ]);
        return { market, fundingHistory: frHist?.slice(-30), recentTrades: trades };
      })(),
      // Aster
      (async () => {
        const [oi, frHist, ticker] = await Promise.all([
          cached(`ast-oi-${sym}`, () => Aster.getOI(sym).catch(() => null)),
          cached(`ast-fr-${sym}`, () => Aster.getFundingHistory(sym, 30).catch(() => null)),
          cached(`ast-24h-${sym}`, () => Aster.get24hTicker(sym).catch(() => null)),
        ]);
        return { oi, fundingHistory: frHist, ticker };
      })(),
      // Coinglass aggregated
      cached('liquidations', cg.getLiquidationCoinList),
      cached(`transfers-${sym}`, () => cg.getChainTransfers(sym, 100).catch(() => null)),
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
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// === Quick scan ===
app.get('/api/scan', async (req, res) => {
  try {
    const allSignals = [];
    for (const sym of TOP_SYMBOLS.slice(0, 15)) {
      try {
        const pair = sym + 'USDT';
        const [oiHist, frHist, klines, ls, taker] = await Promise.all([
          cached(`bn-oi-${sym}`, () => Binance.getOIHistory(sym, '1h', 48)),
          cached(`bn-fr-${sym}`, () => Binance.getFundingHistory(sym, 30)),
          cached(`bn-kl-${sym}`, () => Binance.getKlines(sym, '1h', 48)),
          cached(`bn-ls-${sym}`, () => Binance.getLSRatio(sym, '1h', 12)),
          cached(`bn-tk-${sym}`, () => Binance.getTakerVolume(sym, '1h', 12)),
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

// CG endpoints
app.get('/api/cg/oi/:symbol', async (req, res) => { res.json({ ok: true, data: await cg.getOIByExchange(req.params.symbol.toUpperCase()) }); });
app.get('/api/cg/funding/:symbol', async (req, res) => { res.json({ ok: true, data: await cg.getFundingByExchange(req.params.symbol.toUpperCase()) }); });
app.get('/api/transfers/:symbol', async (req, res) => { res.json({ ok: true, data: await cg.getChainTransfers(req.params.symbol.toUpperCase(), 100) }); });

const PORT = process.env.PORT || 3456;
app.listen(PORT, '0.0.0.0', () => console.log(`🐋 Whale Dashboard running on http://localhost:${PORT}`));
