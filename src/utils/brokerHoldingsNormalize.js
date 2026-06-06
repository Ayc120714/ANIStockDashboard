const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const isNormalizedBrokerRow = (row) => Boolean(
  row
  && String(row.symbol || '').trim()
  && Number.isFinite(Number(row.net_qty)),
);

const pickArrayRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.positions)) return payload.positions;
  if (Array.isArray(payload?.holdings)) return payload.holdings;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.open_positions)) return payload.open_positions;
  return [];
};

export const normalizeBrokerRows = (payload) => {
  const rows = pickArrayRows(payload);
  const normalized = rows
    .map((row) => {
      const symbol = String(
        row?.tradingSymbol
        || row?.tradingsymbol
        || row?.symbol
        || row?.symbolName
        || row?.symbol_name
        || row?.scripName
        || row?.scrip_name
        || row?.securityId
        || '',
      ).trim().toUpperCase();
      const buyQty = toNumber(row?.buyQty ?? row?.buy_qty ?? row?.buyQuantity);
      const sellQty = toNumber(row?.sellQty ?? row?.sell_qty ?? row?.sellQuantity);
      const computedHoldingQty = toNumber(
        (row?.dpQty ?? row?.dp_qty ?? row?.dpQuantity ?? 0)
        + (row?.t1Qty ?? row?.t1_qty ?? row?.t1Quantity ?? 0)
        + (row?.availableQty ?? row?.available_qty ?? row?.availableQuantity ?? 0),
      );
      const netQty = toNumber(
        row?.netQty
        ?? row?.net_qty
        ?? row?.netQuantity
        ?? row?.authorisedquantity
        ?? row?.authorisedQuantity
        ?? row?.quantity
        ?? row?.qty
        ?? row?.availableQty
        ?? row?.available_qty
        ?? row?.availableQuantity
        ?? row?.holdingQty
        ?? row?.holding_qty
        ?? row?.holdingQuantity
        ?? row?.totalQty
        ?? row?.total_qty
        ?? row?.totalQuantity
        ?? computedHoldingQty
        ?? (buyQty - sellQty),
      );
      if (!symbol || netQty === 0) return null;
      const avgPrice = toNumber(
        row?.buyAvg
        ?? row?.buyavg
        ?? row?.buyAvgPrice
        ?? row?.buyavgprice
        ?? row?.buyaverageprice
        ?? row?.avgPrice
        ?? row?.averagePrice
        ?? row?.averageprice
        ?? row?.avg_price
        ?? row?.costPrice
        ?? row?.avgCostPrice
        ?? row?.avg_cost_price,
      );
      const ltp = toNumber(
        row?.ltp
        ?? row?.Ltp
        ?? row?.lastPrice
        ?? row?.lastTradedPrice
        ?? row?.last_traded_price
        ?? row?.close
        ?? row?.price,
      );
      const unrealized = toNumber(
        row?.pnl
        ?? row?.unrealizedPnl
        ?? row?.unrealized_pnl
        ?? row?.unrealizedProfit
        ?? row?.unrealized_profit
        ?? row?.holdingPnl
        ?? row?.holding_pnl
        ?? row?.profitandloss
        ?? row?.profitAndLoss
        ?? row?.profit_and_loss
        ?? row?.mtm
        ?? row?.m2m,
      );
      const computedUnrealized = avgPrice > 0 && ltp > 0 ? (ltp - avgPrice) * netQty : 0;
      const isDeliveryHolding = toNumber(
        row?.dpQty ?? row?.dp_qty ?? row?.dpQuantity ?? row?.totalQty ?? row?.total_qty ?? row?.totalQuantity,
      ) > 0
        || toNumber(row?.t1Qty ?? row?.t1_qty ?? row?.t1Quantity) > 0
        || String(row?.productType || row?.product_type || row?.product || '').toUpperCase() === 'CNC';
      return {
        symbol,
        product_type: String(
          row?.productType || row?.product_type || row?.product || (isDeliveryHolding ? 'DELIVERY' : 'INTRADAY'),
        ).toUpperCase(),
        net_qty: netQty,
        avg_price: avgPrice,
        ltp,
        unrealized_pnl: unrealized || computedUnrealized,
        realized_pnl: toNumber(row?.realizedPnl ?? row?.realized_pnl ?? row?.realizedProfit ?? row?.realized_profit),
        day_pnl: toNumber(row?.day_pnl ?? row?.dayPnl ?? row?.mtm ?? row?.m2m),
        state: 'OPEN',
      };
    })
    .filter(Boolean);

  const unique = new Map();
  normalized.forEach((row) => {
    unique.set(`${row.symbol}_${row.product_type}`, row);
  });
  return [...unique.values()];
};

/** Re-shape cached/raw broker rows (tradingSymbol, netQty, etc.) for dashboard tables. */
export const ensureNormalizedBrokerRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (rows.every(isNormalizedBrokerRow)) return rows;
  return normalizeBrokerRows(rows);
};
