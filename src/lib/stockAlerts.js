import { latestByKey } from "@/lib/periods";

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

const RUPTURE_STATUSES = ["rupture", "proche_rupture"];

/**
 * THE single stock-alert computation for the whole app.
 *
 * The user-defined threshold used to live on the Produits page alone. Every
 * other screen counted shortages straight from the imported `stock_status`, so
 * lowering the threshold changed the Produits list while the KPI "Alertes
 * rupture", the Opérations score and the alert centre kept showing a different
 * number from the same rows. A setting that only moves one screen is worse than
 * no setting: it makes the app contradict itself.
 *
 * A product is in shortage when EITHER the imported status says so, OR its
 * recorded stock is at/under the threshold the user chose. Both signals matter:
 * the status carries what the source system concluded, the threshold carries
 * what this business considers too low.
 */
export function computeStockAlerts(products, inventory, settings) {
  const latestInv = latestByKey(inventory || [], "product_id", "date");
  const invByProduct = {};
  latestInv.forEach((i) => { invByProduct[i.product_id] = i; });

  // Base on the catalogue. When only an inventory file was imported, fall back
  // to the products the snapshots reference so the counts still mean something.
  const base = (products || []).length > 0
    ? products
    : latestInv.map((i) => ({ product_id: i.product_id }));

  const rows = base.map((p) => {
    const snap = invByProduct[p.product_id];
    const stock = snap && snap.closing_stock != null
      ? Number(snap.closing_stock)
      : Number(p.inventory_level) || 0;
    const status = snap?.stock_status || p.status;
    const byStatus = RUPTURE_STATUSES.includes(status);
    const byThreshold = isStockAlert(stock, p.reorder_point, settings);
    return {
      product: p,
      snapshot: snap,
      stock,
      status,
      dormant: status === "dormant",
      // Kept apart so a caller can explain WHY a product is flagged.
      byStatus,
      byThreshold,
      inAlert: byStatus || byThreshold,
    };
  });

  const alerts = rows.filter((r) => r.inAlert);
  return {
    rows,
    byProduct: invByProduct,
    tracked: rows.length,
    alerts,
    alertCount: alerts.length,
    dormantCount: rows.filter((r) => r.dormant).length,
    // Shortage severity, for alerts that need to separate "out" from "nearly out".
    outOfStockCount: rows.filter((r) => r.status === "rupture").length,
    lowStockCount: rows.filter((r) => r.inAlert && r.status !== "rupture").length,
  };
}

/** Threshold that applies to one product, for display. */
export function effectiveThreshold(product, settings) {
  const base = Number(settings.threshold) || 0;
  if (settings.useReorderPoint && Number(product?.reorder_point) > 0) {
    return Math.max(base, Number(product.reorder_point));
  }
  return base;
}
