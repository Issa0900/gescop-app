import { createClient } from "@base44/sdk";

const base44 = createClient({ appId: "6aa428eadfaf8d99d50d10b7" });

async function run() {
  const before = await base44.entities.Goal.filter({ import_id: "6aaae363f96df5befe51f0c9" }, "-created_date", 1);
  console.log("sample before:", JSON.stringify(before));
  const result = await base44.entities.Goal.deleteMany({ import_id: "6aaae363f96df5befe51f0c9" });
  console.log("delete result:", JSON.stringify(result));
  const after = await base44.entities.Goal.filter({ import_id: "6aaae363f96df5befe51f0c9" }, "-created_date", 1);
  console.log("sample after (should be empty):", JSON.stringify(after));
}
run().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
