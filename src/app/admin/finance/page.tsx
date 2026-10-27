import type { Metadata } from "next";
import { DoubleEntryLedgerView } from "@/components/admin/finance/DoubleEntryLedgerView";

export const metadata: Metadata = {
  title: "Double-Entry Financial Ledger & Settlements | NCAMart Admin",
  description:
    "Explore immutable general journal, courier COD bank remittances, and NBR Mushak 6.3 VAT sales registers.",
};

export default function AdminFinancePage() {
  return <DoubleEntryLedgerView />;
}
