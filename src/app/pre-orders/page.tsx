import React from "react";
import { Metadata } from "next";
import { PreOrdersHubView } from "@/components/preorder";

export const metadata: Metadata = {
  title: "Direct Import Pre-Orders & Engineering Gear Showcase | NCAMart Nawabpur",
  description:
    "Direct weekly air-freight import of specialized engineering gear, micro-soldering stations, and Fluke thermal cameras. Lock your reservation with a 10%–20% deposit with 100% money-back SLA guarantee.",
  keywords: [
    "Pre-order electronics Bangladesh",
    "Fluke thermal camera Dhaka",
    "Micro soldering station Nawabpur",
    "FNIRSI oscilloscope Bangladesh",
    "Air freight import tech tools",
  ],
};

export default function PreOrdersPage() {
  return <PreOrdersHubView />;
}
