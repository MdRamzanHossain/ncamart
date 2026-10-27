import { Metadata } from "next";
import { RunnerTaskDashboard } from "@/components/runner";

export const metadata: Metadata = {
  title: "Active Sourcing Tasks | Field Runner PWA",
  description:
    "Drop-and-pack wholesale pickup task queue grouped by Nawabpur markets with spot price negotiation controls.",
};

export default function RunnerTasksPage() {
  return <RunnerTaskDashboard />;
}
