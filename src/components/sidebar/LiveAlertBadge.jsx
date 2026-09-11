import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLiveAlerts } from "@/lib/liveAlerts";

// Counts only what needs attention now: unread stored alerts plus live
// critical/important ones computed from current data.
export default function LiveAlertBadge({ compact }) {
  const { data: stored } = useQuery({
    queryKey: ["alerts-badge"],
    queryFn: async () => (await base44.entities.Alert.list("-created_date", 100)) || [],
  });
  const { data: transactions } = useQuery({
    queryKey: ["transactions-summary"],
    queryFn: async () => (await base44.entities.Transaction.list("-date", 500)) || [],
  });
  const { data: orders } = useQuery({
    queryKey: ["orders-summary"],
    queryFn: async () => (await base44.entities.Order.list("-date", 500)) || [],
  });
  const { data: customers } = useQuery({
    queryKey: ["customers-summary"],
    queryFn: async () => (await base44.entities.Customer.list()) || [],
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory-badge"],
    queryFn: async () => (await base44.entities.Inventory.list("-date", 500)) || [],
  });
  const { data: cashflow } = useQuery({
    queryKey: ["cashflow-summary"],
    queryFn: async () => (await base44.entities.Cashflow.list("-date", 100)) || [],
  });
  const { data: campaignDaily } = useQuery({
    queryKey: ["campaign-daily-badge"],
    queryFn: async () => (await base44.entities.CampaignDaily.list("-date", 500)) || [],
  });

  const live = computeLiveAlerts({ transactions, orders, customers, campaignDaily, inventory, cashflow });
  const liveCount = live.filter((a) => a.level === "critique" || a.level === "important").length;
  const unreadStored = (stored || []).filter((a) => a.status !== "lue").length;
  const count = liveCount + unreadStored;

  if (!count) return null;

  if (compact) {
    return <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-red-500" />;
  }
  return (
    <span className="ml-auto rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}