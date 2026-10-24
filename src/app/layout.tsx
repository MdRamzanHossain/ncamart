import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NCAMart — High-Trust Tech Accessories",
  description: "Operations-heavy e-commerce platform in Nawabpur, Dhaka",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
