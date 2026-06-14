/**
 * Admin-only reference: maps each verifier algo to indicator blocks / setups from the implementation guide.
 * Used on Algo Performance page — not shown to non-admin users.
 */
export const ALGO_PLAYBOOK = {
  ALGO1: {
    title: 'CPR Trend Continuation',
    timeframe: 'Daily',
    indicatorBlocks: [
      'Multi-Timeframe CPR — Week_High_Mid_Low.txt (Daily CPR width, TC/BC)',
      'B1_B2_B3_S1_S2_S3_SQZ_PSAR.txt — B1/B2/S1/S2 + SuperTrend',
      'SQZ_Momentum.txt — squeeze firing confirmation',
    ],
    whenToUse:
      'Swing continuation after narrow CPR; price clears TC (long) or BC (short) with EMA stack and momentum.',
    whereItExcels:
      'Trending names with clean CPR breaks and sustained momentum; narrow CPR days with aligned weekly bias.',
    whereItStruggles:
      'Choppy ranges, wide CPR, gaps through SL, or weak sector drift when TC/BC signals flip intraday.',
  },
  ALGO2: {
    title: 'Virgin CPR Retest',
    timeframe: 'Daily',
    indicatorBlocks: [
      'Week_High_Mid_Low.txt — Virgin CPR zones',
      'B1_B2_B3… bundle — B1/B2 inside zone',
      'RSI + weekly bias from same bundle',
    ],
    whenToUse: 'Price revisits untouched prior-day CPR; retest long bias with virgin zone rules.',
    whereItExcels:
      'Strong trends where virgin zones stay respected; symbols that rotate back to CPR cleanly.',
    whereItStruggles:
      'False breaks into the zone, news gaps, or when prior CPR is quickly violated (no longer “virgin”).',
  },
  ALGO3: {
    title: 'Intraday Breakout (proxy)',
    timeframe: '15m ideal — verifier uses daily Donchian unless SYMBOL_5m.csv exists',
    indicatorBlocks: [
      'Donchian + EMA cross + volume (daily proxy in batch mode)',
      'With 5m file: intraday bars next to daily CSV',
    ],
    whenToUse: 'Narrow CPR day + breakout above OR / Donchian with volume.',
    whereItExcels:
      'High-beta names on trend days with volume confirmation; best when true 5m data is available beside daily.',
    whereItStruggles:
      'Daily-only proxy misses session timing; range days and late reversals; low-liquidity stocks.',
  },
  ALGO4: {
    title: 'B3 / S3 Momentum',
    timeframe: 'Daily',
    indicatorBlocks: ['B1_B2_B3… bundle — B3 / S3 signals', 'SQZ_Momentum histogram', 'ADX/DI + RSI/CCI in bundle'],
    whenToUse: 'Strong stacked EMA trend + explosive B3 or capitulation S3 with volume.',
    whereItExcels:
      'Sector leaders in clear bull/bear runs with expanding volume; continuation after B3/S3 confirmation.',
    whereItStruggles:
      'Late-stage exhaustion, false explosions in ranges, or thin stocks where volume spike fades.',
  },
  ALGO5: {
    title: 'Reversal (hourly-style rules, daily bar sim)',
    timeframe: 'Daily bars in verifier',
    indicatorBlocks: ['Bollinger + RSI + squeeze + B1/S1 from bundle'],
    whenToUse: 'Oversold bounce or overbought fade with reversal candle + squeeze turn.',
    whereItExcels:
      'Mean-reverting large caps and clear RSI/Bollinger extremes with squeeze confirmation.',
    whereItStruggles:
      'Strong one-way trends (knife/catch); simulator uses daily bars so intraday reversal timing is approximate.',
  },
};

/** India cash-market tax / compliance toggles — informational checklist for admins (not tax advice). */
export const TAX_CHECKLIST_ITEMS = [
  {
    key: 'stt_delivery',
    label: 'STT — delivery (cash equity)',
    detail:
      'Typically STT on sell side for delivery trades. Confirm current rates with your CA / broker circular.',
  },
  {
    key: 'stt_intraday',
    label: 'STT — intraday',
    detail: 'Algo 3 when traded as intraday uses intraday STT rules; simulator here is mostly daily unless 5m file is used.',
  },
  {
    key: 'brokerage_gst',
    label: 'Brokerage + GST',
    detail: 'Enable in your ledger export from Dhan / broker for net P&L.',
  },
  {
    key: 'capital_gains',
    label: 'Holdings period → STCG / LTCG',
    detail:
      'Swing algos (1–5) are modeled as daily exits; map holding period from Entry Date → Exit Date for schedule reporting.',
  },
];
