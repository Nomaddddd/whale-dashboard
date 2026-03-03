/**
 * 庄家行为分析引擎 v2
 * 
 * 数据源：Binance(免费) + Coinglass(免费端点)
 * 通过OI变化、费率、爆仓、多空比、买卖量、链上转账交叉分析
 */

const ALERT_LEVELS = { INFO: 'info', WARNING: 'warning', DANGER: 'danger' };

function analyzeSymbol(symbol, { oiHistory, fundingHistory, klines, lsRatio, takerRatio, liquidation, transfers }) {
  const signals = [];

  // === 1. OI 变化分析 ===
  if (oiHistory && oiHistory.length >= 4) {
    const latest = oiHistory[oiHistory.length - 1];
    const prev1h = oiHistory[oiHistory.length - 2];
    const prev4h = oiHistory[Math.max(0, oiHistory.length - 5)];
    const prev24h = oiHistory[0];

    const change1h = prev1h?.oiValue ? ((latest.oiValue - prev1h.oiValue) / prev1h.oiValue * 100) : 0;
    const change4h = prev4h?.oiValue ? ((latest.oiValue - prev4h.oiValue) / prev4h.oiValue * 100) : 0;
    const change24h = prev24h?.oiValue ? ((latest.oiValue - prev24h.oiValue) / prev24h.oiValue * 100) : 0;

    if (Math.abs(change1h) > 3) {
      signals.push({
        level: ALERT_LEVELS.DANGER,
        type: 'oi_spike_1h',
        title: `${symbol} OI 1h ${change1h > 0 ? '暴涨' : '暴跌'} ${change1h.toFixed(2)}%`,
        detail: `OI: $${fmtUsd(latest.oiValue)} | 1h: ${fmtPct(change1h)} | 4h: ${fmtPct(change4h)}`,
        interpretation: change1h > 0
          ? '大量新仓位进场。如果价格没有同步大涨，庄家可能在准备方向性行情'
          : '大规模平仓发生，行情可能已经走完一波',
      });
    }

    if (change4h > 5 && change24h > 8) {
      signals.push({
        level: ALERT_LEVELS.WARNING,
        type: 'oi_sustained_buildup',
        title: `${symbol} OI 持续累积`,
        detail: `4h: ${fmtPct(change4h)} | 24h: ${fmtPct(change24h)} | OI: $${fmtUsd(latest.oiValue)}`,
        interpretation: '庄家在持续建仓，大行情可能即将到来',
      });
    }

    // OI涨但价格不动 = 隐性建仓
    if (klines && klines.length >= 2 && Math.abs(change4h) > 3) {
      const priceChange = ((klines[klines.length-1].close - klines[Math.max(0, klines.length-5)].close) / klines[Math.max(0, klines.length-5)].close * 100);
      if (Math.abs(change4h) > 3 && Math.abs(priceChange) < 1) {
        signals.push({
          level: ALERT_LEVELS.DANGER,
          type: 'oi_price_divergence',
          title: `${symbol} OI与价格背离`,
          detail: `OI变化 ${fmtPct(change4h)} 但价格仅 ${fmtPct(priceChange)}`,
          interpretation: 'OI大幅变化但价格没动，庄家在悄悄建仓。方向看费率和多空比',
        });
      }
    }
  }

  // === 2. 费率分析 ===
  if (fundingHistory && fundingHistory.length >= 3) {
    const latest = fundingHistory[fundingHistory.length - 1];
    const recent3 = fundingHistory.slice(-3);
    const avgRate = recent3.reduce((s, f) => s + f.rate, 0) / recent3.length;

    if (avgRate > 0.0005) {
      signals.push({
        level: avgRate > 0.001 ? ALERT_LEVELS.DANGER : ALERT_LEVELS.WARNING,
        type: 'funding_high_positive',
        title: `${symbol} 费率持续高正值`,
        detail: `最新: ${(latest.rate * 100).toFixed(4)}% | 近3期均值: ${(avgRate * 100).toFixed(4)}%`,
        interpretation: '多头拥挤，做多成本高。庄家可能准备砸盘收割多头',
      });
    }

    if (avgRate < -0.0005) {
      signals.push({
        level: avgRate < -0.001 ? ALERT_LEVELS.DANGER : ALERT_LEVELS.WARNING,
        type: 'funding_high_negative',
        title: `${symbol} 费率持续高负值`,
        detail: `最新: ${(latest.rate * 100).toFixed(4)}% | 近3期均值: ${(avgRate * 100).toFixed(4)}%`,
        interpretation: '空头拥挤，做空成本高。庄家可能准备拉盘逼空',
      });
    }

    // 费率翻转
    if (fundingHistory.length >= 6) {
      const prev3 = fundingHistory.slice(-6, -3);
      const prevAvg = prev3.reduce((s, f) => s + f.rate, 0) / prev3.length;
      if ((prevAvg > 0.0003 && avgRate < -0.0001) || (prevAvg < -0.0003 && avgRate > 0.0001)) {
        signals.push({
          level: ALERT_LEVELS.WARNING,
          type: 'funding_flip',
          title: `${symbol} 费率方向翻转`,
          detail: `前期: ${(prevAvg * 100).toFixed(4)}% → 当前: ${(avgRate * 100).toFixed(4)}%`,
          interpretation: '市场情绪发生转变，多空力量正在切换',
        });
      }
    }
  }

  // === 3. 多空比分析 ===
  if (lsRatio && lsRatio.length >= 2) {
    const latest = lsRatio[lsRatio.length - 1];
    if (latest.longRatio > 0.75) {
      signals.push({
        level: ALERT_LEVELS.WARNING,
        type: 'ls_extreme_long',
        title: `${symbol} 多头极度拥挤 ${(latest.longRatio * 100).toFixed(1)}%`,
        detail: `多空比: ${latest.lsRatio.toFixed(2)}`,
        interpretation: '散户过度看多，庄家可能反向操作。注意回调风险',
      });
    }
    if (latest.shortRatio > 0.65) {
      signals.push({
        level: ALERT_LEVELS.WARNING,
        type: 'ls_extreme_short',
        title: `${symbol} 空头异常密集 ${(latest.shortRatio * 100).toFixed(1)}%`,
        detail: `多空比: ${latest.lsRatio.toFixed(2)}`,
        interpretation: '散户过度看空，庄家可能拉盘逼空',
      });
    }
  }

  // === 4. 主动买卖量分析 ===
  if (takerRatio && takerRatio.length >= 3) {
    const recent = takerRatio.slice(-3);
    const avgRatio = recent.reduce((s, t) => s + t.buySellRatio, 0) / recent.length;
    const totalBuy = recent.reduce((s, t) => s + t.buyVol, 0);
    const totalSell = recent.reduce((s, t) => s + t.sellVol, 0);

    if (avgRatio > 1.3) {
      signals.push({
        level: ALERT_LEVELS.WARNING,
        type: 'taker_buy_surge',
        title: `${symbol} 主动买入量激增`,
        detail: `买卖比: ${avgRatio.toFixed(2)} | 买: ${totalBuy.toFixed(0)} 卖: ${totalSell.toFixed(0)}`,
        interpretation: '大量主动买入，可能有大资金在吸筹或FOMO入场',
      });
    }
    if (avgRatio < 0.7) {
      signals.push({
        level: ALERT_LEVELS.WARNING,
        type: 'taker_sell_surge',
        title: `${symbol} 主动卖出量激增`,
        detail: `买卖比: ${avgRatio.toFixed(2)} | 买: ${totalBuy.toFixed(0)} 卖: ${totalSell.toFixed(0)}`,
        interpretation: '大量主动卖出，可能有大资金在出货',
      });
    }
  }

  // === 5. 爆仓分析 (Coinglass) ===
  if (liquidation) {
    const liq1h = liquidation.liquidation_usd_1h || 0;
    const liq24h = liquidation.liquidation_usd_24h || 0;
    const longLiq = liquidation.long_liquidation_usd_24h || 0;
    const shortLiq = liquidation.short_liquidation_usd_24h || 0;

    if (liq1h > 10_000_000) {
      const longDom = (liquidation.long_liquidation_usd_1h || 0) > (liquidation.short_liquidation_usd_1h || 0);
      signals.push({
        level: liq1h > 50_000_000 ? ALERT_LEVELS.DANGER : ALERT_LEVELS.WARNING,
        type: 'liquidation_spike',
        title: `${symbol} 1h爆仓 $${fmtUsd(liq1h)}`,
        detail: `多头爆: $${fmtUsd(liquidation.long_liquidation_usd_1h||0)} | 空头爆: $${fmtUsd(liquidation.short_liquidation_usd_1h||0)}`,
        interpretation: longDom
          ? '多头被大量清算，庄家完成一波砸盘。如果价格企稳可能是抄底机会'
          : '空头被逼空，追高风险大',
      });
    }

    if (liq24h > 50_000_000) {
      const ratio = longLiq / liq24h;
      if (ratio > 0.75 || ratio < 0.25) {
        signals.push({
          level: ALERT_LEVELS.WARNING,
          type: 'liquidation_imbalance',
          title: `${symbol} 24h爆仓严重偏${ratio > 0.5 ? '多' : '空'}`,
          detail: `多头占比: ${(ratio*100).toFixed(0)}% | 总: $${fmtUsd(liq24h)}`,
          interpretation: ratio > 0.5
            ? '多头单方面被收割，市场可能过度恐慌'
            : '空头单方面被收割，注意回调',
        });
      }
    }
  }

  // === 6. 链上转账 (Coinglass) ===
  if (transfers && transfers.length > 0) {
    const recent = transfers.filter(t => Date.now()/1000 - t.transaction_time < 3600);
    const largeIn = recent.filter(t => t.transfer_type === 1 && t.amount_usd > 1_000_000);
    const largeOut = recent.filter(t => t.transfer_type === 2 && t.amount_usd > 1_000_000);

    if (largeIn.length >= 3) {
      const total = largeIn.reduce((s,t) => s + t.amount_usd, 0);
      signals.push({
        level: ALERT_LEVELS.DANGER,
        type: 'sustained_inflow',
        title: `${symbol} 持续大额转入交易所`,
        detail: `1h内 ${largeIn.length} 笔，合计 $${fmtUsd(total)}`,
        interpretation: '大量转入交易所，准备抛售。砸盘风险高',
      });
    }
    if (largeOut.length >= 3) {
      const total = largeOut.reduce((s,t) => s + t.amount_usd, 0);
      signals.push({
        level: ALERT_LEVELS.WARNING,
        type: 'sustained_outflow',
        title: `${symbol} 持续大额转出交易所`,
        detail: `1h内 ${largeOut.length} 笔，合计 $${fmtUsd(total)}`,
        interpretation: '大量从交易所提出，囤货看多',
      });
    }
  }

  // === 7. 复合信号 ===
  const hasOiSpike = signals.some(s => s.type.startsWith('oi_'));
  const hasExtremeFunding = signals.some(s => s.type.startsWith('funding_high'));
  const hasInflow = signals.some(s => s.type === 'sustained_inflow');
  const hasLiqSpike = signals.some(s => s.type === 'liquidation_spike');

  if (hasOiSpike && hasExtremeFunding) {
    signals.push({
      level: ALERT_LEVELS.DANGER,
      type: 'composite_reversal',
      title: `⚠️ ${symbol} 复合反转信号`,
      detail: 'OI异常 + 费率极端',
      interpretation: '庄家在极端费率下大量建仓，很可能准备反向收割。高概率剧烈行情',
    });
  }
  if (hasOiSpike && hasInflow) {
    signals.push({
      level: ALERT_LEVELS.DANGER,
      type: 'composite_dump',
      title: `⚠️ ${symbol} 砸盘风险`,
      detail: 'OI异常 + 大额转入交易所',
      interpretation: '庄家可能建空仓+现货砸盘双重获利。极高风险',
    });
  }
  if (hasLiqSpike && hasOiSpike) {
    signals.push({
      level: ALERT_LEVELS.DANGER,
      type: 'composite_post_harvest',
      title: `⚠️ ${symbol} 收割后重新建仓`,
      detail: '大额爆仓 + OI重新上升',
      interpretation: '庄家刚完成收割后马上重新建仓，可能准备第二波行情',
    });
  }

  return signals;
}

function fmtUsd(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}
function fmtPct(n) { return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`; }

module.exports = { analyzeSymbol, ALERT_LEVELS };
