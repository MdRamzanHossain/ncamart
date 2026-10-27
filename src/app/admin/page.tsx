import type { Metadata } from "next";
import { ExecutiveOverviewView } from "@/components/admin/ExecutiveOverviewView";

export const metadata: Metadata = {
  title: "Executive Overview & Operations Hub | NCAMart Admin",
  description:
    "Real-time revenue metrics, drop-and-pack fulfillment tracking, and live Nawabpur activity feed.",
};

export default function AdminOverviewPage() {
  return <ExecutiveOverviewView />;
}
