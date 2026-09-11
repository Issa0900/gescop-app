export const DEFAULT_STOCK_THRESHOLD = 10;

export function getStockAlertSettings(company) {
  return {
    threshold: company?.stock_alert_threshold != null ? Number(company.stock_alert_threshold) : DEFAULT_STOCK_THRESHOLD,
    useReorderPoint: company?.stock_alert_use_reorder_point !== false,
  };
}

// A product is in alert when its stock falls at or under the user-defined
// threshold, or (optionally) at or under its own reorder point.
export function isStockAlert(stock, reorderPoint, settings) {
  const s = Number(stock) || 0;
  if (s <= (Number(settings.threshold) || 0)) return true;
  if (settings.useReorderPoint && Number(reorderPoint) > 0 && s <= Number(reorderPoint)) return true;
  return false;
}