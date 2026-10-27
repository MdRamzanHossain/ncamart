import { Metadata } from "next";
import { RunnerTaskDashboard } from "@/components/runner";

export const metadata: Metadata = {
  title: "Field-Runner PWA Task Hub | Nawabpur Complex Accessories",
  description:
    "Mobile PWA Sourcing Task Queue for Nawabpur Field Runners with real-time wholesale stall routing and spot-price threshold guards.",
};

export default function RunnerPage() {
  return <RunnerTaskDashboard />;
}
