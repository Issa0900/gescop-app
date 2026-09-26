import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { PLANS, PLAN_LIMITS, canAccess as checkAccess, hasFullAccess as checkFullAccess, getFeaturePermission } from "@/lib/entitlements";
import { useAuth } from "@/lib/AuthContext";

export const ADMIN_EMAILS = [
  "issaouedraogo0900@gmail.com",
];

export const VALID_PILOT_CODES = [
  "PILOTE2026",
  "PILOTE",
  "PILOT2026",
  "GESCOP-VIP",
  "VIP-GESCOP",
  "PILOTE-PRO",
];

export function useSubscription() {
  let authContextUser = null;
  try {
    const auth = useAuth();
    authContextUser = auth?.user || null;
  } catch (_) {}

  // Détection automatique via URL (ex: ?pilot_access=true ou ?code=PILOTE2026)
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const pilotParam = params.get("pilot_access") || params.get("pilot");
      const codeParam = (params.get("code") || "").toUpperCase().trim();
      if (pilotParam === "true" || (codeParam && VALID_PILOT_CODES.includes(codeParam))) {
        localStorage.setItem("gescop_pilot_access", "true");
        localStorage.setItem("gescop_pilot_code", codeParam || "ACCES-PILOTE");
      }
    } catch (_) {}
  }

  const { data: subscription, isLoading, refetch } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      try {
        const list = await base44.entities.Subscription.list("-created_date", 1);
        return list && list[0] ? list[0] : null;
      } catch (err) {
        console.warn("Impossible de charger l'abonnement, fallback sur PLAN_FREE:", err);
        return null;
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });

  const userEmail = (authContextUser?.email || "").toLowerCase().trim();
  const isAdmin = Boolean(userEmail && ADMIN_EMAILS.includes(userEmail));
  const isPilotLocalStorage = typeof window !== "undefined" && localStorage.getItem("gescop_pilot_access") === "true";
  const isPilotActive = isAdmin || isPilotLocalStorage;

  // Détermination du plan effectif
  let planId = "PLAN_FREE";
  let status = "active";

  if (isPilotActive) {
    planId = "PLAN_PRO";
    status = "active";
  } else if (subscription) {
    const isExpired = subscription.current_period_end && new Date(subscription.current_period_end).getTime() < Date.now();
    
    // Si l'abonnement est annulé et que la période est terminée, retour en PLAN_FREE
    if (subscription.status === "canceled" && isExpired) {
      planId = "PLAN_FREE";
      status = "canceled";
    } else if (subscription.status === "active" || subscription.status === "trialing" || (subscription.status === "canceled" && !isExpired)) {
      planId = subscription.plan_id || "PLAN_FREE";
      status = subscription.status;
    } else {
      // past_due, unpaid, incomplete
      planId = "PLAN_FREE";
      status = subscription.status;
    }
  }

  // Trouver l'objet plan correspondant
  const plan = Object.values(PLANS).find((p) => p.id === planId) || PLANS.FREE;
  const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.PLAN_FREE;

  const isPendingCancellation = Boolean(
    subscription?.cancel_at_period_end && 
    planId !== "PLAN_FREE" && 
    subscription?.status !== "canceled"
  );

  const currentPeriodEndFormatted = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("fr-CA")
    : null;

  // Actions d'abonnement
  const cancelSubscription = async ({ reason = "", immediate = false } = {}) => {
    const res = await base44.functions.invoke("cancelSubscription", {
      action: "cancel",
      reason,
      immediate,
    });
    await refetch();
    return res.data || res;
  };

  const resumeSubscription = async () => {
    const res = await base44.functions.invoke("cancelSubscription", {
      action: "resume",
    });
    await refetch();
    return res.data || res;
  };

  const activatePilotCode = async (inputCode) => {
    const cleanCode = String(inputCode || "").trim().toUpperCase();
    if (VALID_PILOT_CODES.includes(cleanCode)) {
      try {
        localStorage.setItem("gescop_pilot_access", "true");
        localStorage.setItem("gescop_pilot_code", cleanCode);
      } catch (_) {}

      // Si l'utilisateur est connecté à Base44, synchroniser son entité Subscription
      try {
        const existing = await base44.entities.Subscription.list("-created_date", 1);
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1); // 1 an d'accès pilote
        const periodEnd = d.toISOString();

        if (existing && existing[0]) {
          await base44.entities.Subscription.update(existing[0].id, {
            plan_id: "PLAN_PRO",
            status: "active",
            provider: "pilot_vip",
            cancel_at_period_end: false,
            current_period_end: periodEnd,
          });
        } else {
          await base44.entities.Subscription.create({
            plan_id: "PLAN_PRO",
            status: "active",
            provider: "pilot_vip",
            cancel_at_period_end: false,
            current_period_end: periodEnd,
          });
        }
      } catch (e) {
        console.warn("Synchronisation Subscription (mode local actif) :", e);
      }

      await refetch();
      return { success: true, message: "Code pilote validé ! Accès GESCOP Pro complet débloqué." };
    } else {
      return { success: false, message: "Code pilote invalide. Veuillez vérifier le code fourni." };
    }
  };

  const deactivatePilot = async () => {
    try {
      localStorage.removeItem("gescop_pilot_access");
      localStorage.removeItem("gescop_pilot_code");
    } catch (_) {}
    await refetch();
  };

  return {
    subscription,
    planId,
    plan,
    status,
    isActive: status === "active" || status === "trialing",
    isPro: planId === "PLAN_PRO",
    isGescop: planId === "PLAN_GESCOP",
    isFree: planId === "PLAN_FREE",
    isPilot: isPilotActive,
    isAdmin,
    pilotCode: typeof window !== "undefined" ? localStorage.getItem("gescop_pilot_code") : null,
    activatePilotCode,
    deactivatePilot,
    isPendingCancellation,
    currentPeriodEndFormatted,
    canCancel: planId !== "PLAN_FREE" && !subscription?.cancel_at_period_end && !isPilotActive,
    canResume: planId !== "PLAN_FREE" && Boolean(subscription?.cancel_at_period_end),
    cancelSubscription,
    resumeSubscription,
    limits,
    canAccess: (feature) => checkAccess(planId, feature),
    hasFullAccess: (feature) => checkFullAccess(planId, feature),
    getPermission: (feature) => getFeaturePermission(planId, feature),
    isLoading,
    refetch,
  };
}
