import { Metadata } from "next";
import { WishlistView } from "@/components/wishlist";

export const metadata: Metadata = {
  title: "My Wishlist & Price Alerts | Nawabpur Complex Accessories",
  description:
    "Track saved industrial tech, bench instruments, and high-spec chargers with automated WhatsApp/SMS price-drop and arrival notifications.",
};

export default function WishlistPage() {
  return <WishlistView />;
}
