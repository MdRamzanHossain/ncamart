import { Metadata } from "next";
import { ShowroomPosView } from "@/components/pos";

export const metadata: Metadata = {
  title: "Showroom Counter POS Billing | Nawabpur Complex Accessories",
  description:
    "High-speed touch billing console for Nawabpur Showroom Counter with hardware barcode scanner integration, cash change calculator, and Mushak 6.3 thermal receipts.",
};

export default function PosPage() {
  return <ShowroomPosView />;
}
