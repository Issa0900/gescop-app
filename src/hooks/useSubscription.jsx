import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { PLANS, PLAN_LIMITS, canAccess as checkAccess, hasFullAccess as checkFullAccess, getFeaturePermission } from "@/lib/entitlements";
import { useAuth } from "@/lib/AuthContext";

import {
  ADMIN_EMAILS,
  VALID_PILOT_CODES,
  computePilotExpirationDate,
  checkPilotValidity,
} from "@/lib/pilotAccess";

export { ADMIN_EMAILS, VALID_PILOT_CODES, computePilotExpirationDate, checkPilotValidity };

export function useSubscription() {
  let authContextUser = null;
  try {
    const auth = useAuth();
    authContextUser = auth?.user || null;
  } catch (_) {}

  // Détection automatique via URL (ex: ?pilot_access=true ou ?code=...)
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const pilotParam = params.get("pilot_access") || params.get("pilot");
      const codeParam = (params.get("code") || "").toUpperCase().trim();
      if (pilotParam === "true" || (codeParam && VALID_PILOT_CODES.includes(codeParam))) {
        localStorage.setItem("gescop_pilot_access", "true");
        localStorage.setItem("gescop_pilot_code", codeParam || "ACCES-PILOTE");
        if (!localStorage.getItem("gescop_pilot_expires_at")) {
          const now = new Date();
          const exp = computePilotExpirationDate(now);
          localStorage.setItem("gescop_pilot_activated_at", now.toISOString());
          localStorage.setItem("gescop_pilot_expires_at", exp.toISOString());
        }
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

  // Gestion du statut et de l'expiration du mois gratuit pilote
  let pilotExpiresAt = null;
  let isPilotExpired = false;
  let isPilotLocalStorageValid = false;

  if (typeof window !== "undefined") {
    const hasPilotAccess = localStorage.getItem("gescop_pilot_access") === "true";
    const expiresAtStr = localStorage.getItem("gescop_pilot_expires_at");

    if (hasPilotAccess) {
      if (expiresAtStr) {
        pilotExpiresAt = expiresAtStr;
        const expTime = new Date(expiresAtStr).getTime();
        if (!isNaN(expTime)) {
          if (expTime > Date.now()) {
            isPilotLocalStorageValid = true;
          } else {
            isPilotLocalStorageValid = false;
            isPilotExpired = true;
          }
        }
      } else {
        // Fallback pour sessions existantes : 1 mois à partir d'aujourd'hui
        const now = new Date();
        const exp = computePilotExpirationDate(now);
        pilotExpiresAt = exp.toISOString();
        localStorage.setItem("gescop_pilot_activated_at", now.toISOString());
        localStorage.setItem("gescop_pilot_expires_at", pilotExpiresAt);
        isPilotLocalStorageValid = true;
      }
    }
  }

  // Synchronisation avec l'entité Base44 Subscription si provider === "pilot_vip"
  if (subscription?.provider === "pilot_vip") {
    if (subscription.current_period_end) {
      const subExpTime = new Date(subscription.current_period_end).getTime();
      if (!isNaN(subExpTime)) {
        pilotExpiresAt = subscription.current_period_end;
        if (subExpTime > Date.now()) {
          isPilotLocalStorageValid = true;
          isPilotExpired = false;
        } else {
          isPilotLocalStorageValid = false;
          isPilotExpired = true;
        }
      }
    }
  }

  // L'administrateur principal conserve son statut illimité permanent sans expiration
  const isPilotActive = isAdmin || isPilotLocalStorageValid;

  let pilotDaysRemaining = null;
  if (pilotExpiresAt && isPilotActive && !isAdmin) {
    const diffMs = new Date(pilotExpiresAt).getTime() - Date.now();
    pilotDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Détermination du plan effectif
  let planId = "PLAN_FREE";
  let status = "active";

  if (isPilotActive) {
    planId = "PLAN_PRO";
    status = "active";
  } else if (isPilotExpired && (!subscription || subscription.plan_id === "PLAN_FREE" || subscription.provider === "pilot_vip")) {
    planId = "PLAN_FREE";
    status = "expired";
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

  const effectivePeriodEnd = !isAdmin && pilotExpiresAt ? pilotExpiresAt : subscription?.current_period_end;
  const currentPeriodEndFormatted = effectivePeriodEnd
    ? new Date(effectivePeriodEnd).toLocaleDateString("fr-CA")
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
      const now = new Date();
      const expires = computePilotExpirationDate(now);
      const periodEnd = expires.toISOString();

      try {
        localStorage.setItem("gescop_pilot_access", "true");
        localStorage.setItem("gescop_pilot_code", cleanCode);
        localStorage.setItem("gescop_pilot_activated_at", now.toISOString());
        localStorage.setItem("gescop_pilot_expires_at", periodEnd);
      } catch (_) {}

      // Si l'utilisateur est connecté à Base44, synchroniser son entité Subscription
      try {
        const existing = await base44.entities.Subscription.list("-created_date", 1);
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
      const formattedDate = expires.toLocaleDateString("fr-CA");
      return { 
        success: true, 
        message: `Code pilote validé ! Accès GESCOP Pro offert pour 1 mois (valable jusqu'au ${formattedDate}).` 
      };
    } else {
      return { success: false, message: "Code pilote invalide. Veuillez vérifier le code fourni." };
    }
  };

  const deactivatePilot = async () => {
    try {
      localStorage.removeItem("gescop_pilot_access");
      localStorage.removeItem("gescop_pilot_code");
      localStorage.removeItem("gescop_pilot_activated_at");
      localStorage.removeItem("gescop_pilot_expires_at");
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
    isPilotExpired,
    pilotExpiresAt,
    pilotDaysRemaining,
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
