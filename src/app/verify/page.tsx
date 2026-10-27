import React from "react";
import { Metadata } from "next";
import { VerifyPortalView } from "@/components/verify";

export const metadata: Metadata = {
  title: "Public Holographic Seal & Serial Verification Engine | NCAMart Nawabpur",
  description:
    "Verify the authenticity, distributor chain of custody, and godown packaging video of your tech accessories using our cryptographic Crockford Base32 Destructive VOID Seal engine.",
  keywords: [
    "Holographic seal verification",
    "NCAMart serial verify",
    "Nawabpur authentic tech accessories",
    "Anti-counterfeit verify Dhaka",
    "Crockford Base32 seal lookup",
  ],
};

export default function VerifyPortalPage() {
  return <VerifyPortalView />;
}
