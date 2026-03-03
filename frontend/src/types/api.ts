export interface DashboardResponse {
  ok: boolean;
  ts: number;
  coins: Record<string, DashboardCoin>;
  fearGreed?: FearGreed;
}

export interface DashboardCoin {
  price?: number;
  change24h?: number;
  volume24h?: number;
  oi: DashboardOi | null;
  oiByExchange: OiByExchangeEntry[];
  fundingRate?: number | null;
  fundingByExchange: FundingByExchangeEntry[];
  liquidation?: LiquidationData | null;
}

export interface DashboardOi {
  usd?: number;
  change5m?: number;
  change15m?: number;
  change1h?: number;
  change4h?: number;
  change24h?: number;
}

export interface OiByExchangeEntry {
  exchange: string;
  usd?: number;
  change1h?: number;
  change24h?: number;
}

export interface FundingByExchangeEntry {
  exchange: string;
  rate?: number;
  interval?: number;
}

export interface FearGreed {
  data_list?: number[];
}

export interface AnalysisResponse {
  ok: boolean;
  symbol: string;
  signals: Signal[];
  exchanges: ExchangeData;
  fundingComparison: FundingComparison;
  aggregated: AggregatedData;
}

export interface Signal {
  level: 'danger' | 'warning' | 'info';
  type: string;
  title: string;
  detail: string;
  interpretation: string;
  symbol?: string;
}

export interface ExchangeData {
  binance?: BinanceExchangeData;
  okx?: OkxExchangeData;
  hyperliquid?: HyperliquidExchangeData;
  aster?: AsterExchangeData;
}

export interface BinanceExchangeData {
  oiHistory?: OiHistoryEntry[];
  fundingHistory?: FundingHistoryEntry[];
  klines?: KlineEntry[];
  lsRatio?: LsRatioEntry[];
  takerVolume?: TakerVolumeEntry[];
  ticker?: Ticker;
}

export interface OkxExchangeData {
  oi?: OkxOi;
  oiHistory?: OiHistoryEntry[];
  funding?: FundingRateEntry;
  fundingHistory?: FundingHistoryEntry[];
  liquidations?: OkxLiquidationEntry[];
  lsRatio?: OkxLsRatioEntry[];
  takerVolume?: TakerVolumeEntry[];
}

export interface HyperliquidExchangeData {
  market?: HyperliquidMarket;
  fundingHistory?: FundingHistoryEntry[];
  recentTrades?: HyperliquidTrade[];
}

export interface AsterExchangeData {
  oi?: AsterOi;
  fundingHistory?: FundingHistoryEntry[];
  ticker?: Ticker;
}

export interface OiHistoryEntry {
  oi?: number;
  oiValue?: number;
  ts: number;
}

export interface FundingHistoryEntry {
  rate: number;
  markPrice?: number;
  ts: number;
}

export interface KlineEntry {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LsRatioEntry {
  longRatio: number;
  shortRatio: number;
  lsRatio?: number;
  ts: number;
}

export interface TakerVolumeEntry {
  buySellRatio: number;
  buyVol?: number;
  sellVol?: number;
  ts: number;
}

export interface Ticker {
  price: number;
  change24h: number;
  volume24h: number;
}

export interface OkxOi {
  oi?: number;
  oiUsd?: number;
  ts?: number;
}

export interface FundingRateEntry {
  rate?: number;
  ts?: number;
}

export interface OkxLiquidationEntry {
  side: 'long' | 'short';
  price: number;
  size: number;
  ts: number;
}

export interface OkxLsRatioEntry {
  ratio: number;
  ts: number;
}

export interface HyperliquidMarket {
  symbol: string;
  price: number;
  funding: number;
  openInterest?: number;
  oiUsd?: number;
  volume24h?: number;
}

export interface HyperliquidTrade {
  side: 'B' | 'S';
  price: number;
  size: number;
  ts: number;
  usd: number;
}

export interface AsterOi {
  oi: number;
  ts: number;
}

export interface FundingComparison {
  binance?: number;
  okx?: number;
  hyperliquid?: number;
  aster?: number;
}

export interface AggregatedData {
  liquidation?: LiquidationData | null;
  transfers?: TransferEntry[];
}

export interface LiquidationData {
  symbol?: string;
  liquidation_usd_24h?: number;
  long_liquidation_usd_24h?: number;
  short_liquidation_usd_24h?: number;
  liquidation_usd_1h?: number;
  liquidation_usd_4h?: number;
  long_liquidation_usd_1h?: number;
  short_liquidation_usd_1h?: number;
}

export interface TransferEntry {
  transaction_time: number;
  transfer_type: number;
  amount_usd: number;
  exchange_name?: string;
}
