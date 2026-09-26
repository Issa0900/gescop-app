import { latestByKey, currentMonthKey, dateReferenceInventaire } from "@/lib/periods";
import { isValidOrderForStock } from "@/lib/transactionClassifier";

export const DEFAULT_STOCK_THRESHOLD = 10;
export const DEFAULT_DORMANT_MONTHS = 3;

export function getStockAlertSettings(company) {
  return {
    threshold: company?.stock_alert_threshold != null ? Number(company.stock_alert_threshold) : DEFAULT_STOCK_THRESHOLD,
    useReorderPoint: company?.stock_alert_use_reorder_point !== false,
    dormantMonths: company?.stock_dormant_months != null
      ? Math.max(1, Number(company.stock_dormant_months))
      : DEFAULT_DORMANT_MONTHS,
  };
}

/** "2026-09" moved back n months. */
function shiftMonth(key, n) {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Products that recorded at least one sale within the last n COMPLETE months.
 * Excludes the in-progress month when measuring from the wall clock,
 * or measures up to referenceDateOrMonth when a reference/closing period is provided.
 */
function soldRecently(orders, months, referenceDateOrMonth) {
  let ref;
  let isOngoingMonth = false;
  if (referenceDateOrMonth) {
    ref = referenceDateOrMonth.slice(0, 7);
  } else {
    ref = currentMonthKey();
    isOngoingMonth = true;
  }
  const cutoff = isOngoingMonth ? shiftMonth(ref, -Math.max(1, months)) : shiftMonth(ref, -Math.max(1, months) + 1);
  const maxMonth = isOngoingMonth ? shiftMonth(ref, -1) : ref;

  const sold = new Set();
  (orders || []).forEach((o) => {
    const m = (o.date || "").slice(0, 7);
    if (!o.product_id || !m) return;
    if (m < cutoff || m > maxMonth) return;
    if ((Number(o.quantity) || 0) <= 0 && (Number(o.total_revenue) || Number(o.total) || 0) <= 0) return;
    sold.add(o.product_id);
  });
  return sold;
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
/**
 * Agrémente l'inventaire multi-entrepôts :
 * Pour chaque couple (produit, entrepôt/localisation), retient le relevé le plus récent,
 * puis somme le stock de clôture et la valeur d'inventaire sur l'ensemble des entrepôts par SKU.
 */
export function aggregateLatestInventory(inventory) {
  const dernierParEntrepot = new Map();
  for (const i of inventory || []) {
    const pid = i.product_id || i.id_product || i.sku || i.product_code;
    if (!pid) continue;
    const wid = i.warehouse_id || i.warehouse || i.location_id || i.location || i.succursale || i.store || "default";
    const cle = `${pid}|${wid}`;
    const d = dateReferenceInventaire ? dateReferenceInventaire(i) : (i.date || i.reference_date || "");
    const prec = dernierParEntrepot.get(cle);
    if (!prec || d >= prec.d) {
      dernierParEntrepot.set(cle, { d, row: i });
    }
  }

  const parProduit = new Map();
  for (const { row, d } of dernierParEntrepot.values()) {
    const pid = row.product_id || row.id_product || row.sku || row.product_code;
    const stockVal = Number(row.closing_stock != null ? row.closing_stock : (row.qte_en_stock != null ? row.qte_en_stock : (row.inventory_level != null ? row.inventory_level : 0))) || 0;
    const invVal = Number(row.inventory_value) || 0;

    if (!parProduit.has(pid)) {
      parProduit.set(pid, {
        ...row,
        product_id: pid,
        closing_stock: stockVal,
        inventory_value: invVal,
        _dateRef: d,
        _warehouses: [row],
      });
    } else {
      const agg = parProduit.get(pid);
      agg.closing_stock += stockVal;
      agg.inventory_value += invVal;
      agg._warehouses.push(row);
      if (d > agg._dateRef) {
        agg._dateRef = d;
        agg.date = row.date;
      }
      if (row.stock_status === "rupture") agg.stock_status = "rupture";
      else if (row.stock_status === "faible" && agg.stock_status !== "rupture") agg.stock_status = "faible";
    }
  }

  return Array.from(parProduit.values());
}

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
export function computeStockAlerts(products, inventory, settings, orders, referenceDateOrMonth) {
  const latestInv = aggregateLatestInventory(inventory || []);
  const invByProduct = {};
  latestInv.forEach((i) => { invByProduct[i.product_id] = i; });

  // Base on the catalogue. When only an inventory file was imported, fall back
  // to the products the snapshots reference so the counts still mean something.
  const base = (products || []).length > 0
    ? products
    : latestInv.map((i) => ({ product_id: i.product_id }));

  // Dormancy measured from ACTUAL rotation, not from the imported label.
  // A real file had stock_status = "optimal" on all 500 rows, so the dormant
  // count was structurally stuck at 0 while stock genuinely sat unsold. A
  // product holding stock that recorded no sale over the chosen window is
  // dormant, whatever the label says. Only applied when order history exists -
  // without it every product would look dormant.
  const months = Math.max(1, Number(settings?.dormantMonths) || DEFAULT_DORMANT_MONTHS);
  const hasOrderHistory = (orders || []).some((o) => o.product_id && o.date);
  const recentlySold = hasOrderHistory ? soldRecently(orders, months, referenceDateOrMonth) : null;

  const rows = base.map((p) => {
    const snap = invByProduct[p.product_id];
    let stock = snap && snap.closing_stock != null
      ? Number(snap.closing_stock)
      : Number(p.inventory_level) || 0;

    // GESCOP Phase 4 SSOT : Déduction temps réel des Ventes VALIDÉES analytiquement
    if (snap && snap.date && orders) {
      const qtySoldAfter = orders
        .filter(o => o.product_id === p.product_id && o.date > snap.date && isValidOrderForStock(o))
        .reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
      stock -= qtySoldAfter;
    }

    const status = snap?.stock_status || p.status;
    const byStatus = RUPTURE_STATUSES.includes(status);
    const byThreshold = isStockAlert(stock, p.reorder_point, settings);
    const dormantByStatus = status === "dormant";
    const dormantByRotation = recentlySold !== null
      && stock > 0
      && !recentlySold.has(p.product_id);
    return {
      product: p,
      snapshot: snap,
      stock,
      status,
      dormant: dormantByStatus || dormantByRotation,
      // Kept apart so a caller can explain WHY a product is flagged.
      dormantByStatus,
      dormantByRotation,
      byStatus,
      byThreshold,
      inAlert: byStatus || byThreshold,
    };
  });

  const alerts = rows.filter((r) => r.inAlert);
  const dormants = rows.filter((r) => r.dormant);
  return {
    rows,
    byProduct: invByProduct,
    tracked: rows.length,
    alerts,
    alertCount: alerts.length,
    dormants,
    dormantCount: dormants.length,
    dormantMonths: months,
    // Tells the UI whether dormancy could be measured at all.
    dormancyFromRotation: recentlySold !== null,
    // Shortage severity, for alerts that need to separate "out" from "nearly out".
    outOfStockCount: rows.filter((r) => r.status === "rupture" || (Number.isFinite(r.stock) && r.stock <= 0)).length,
    lowStockCount: rows.filter((r) => r.inAlert && r.status !== "rupture" && (!Number.isFinite(r.stock) || r.stock > 0)).length,
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
