import type { Metadata } from "next";
import { GodownQcView } from "@/components/admin/qc/GodownQcView";

export const metadata: Metadata = {
  title: "Godown QC Station & Thermal Seal Printer | NCAMart Admin",
  description:
    "Quality control intake queue, 4-point electrical inspection test bench, and 50x25mm holographic seal printer.",
};

export default function AdminQcPage() {
  return <GodownQcView />;
}
