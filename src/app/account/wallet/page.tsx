"use client";

import React, { useState, useEffect } from "react";
import { StoreCreditWalletView } from "@/components/account/StoreCreditWalletView";
import type { StoreCreditWalletData } from "@/components/account/types";

export default function StoreCreditWalletPage() {
  const [walletData, setWalletData] = useState<StoreCreditWalletData>({
    balancePaisa: 0,
    pendingWithdrawalPaisa: 0,
    transactions: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchWallet() {
      try {
        const res = await fetch("/api/v1/customer/store-credit");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data) {
            const balancePaisa = data.balance?.totalBalancePaisa ?? 0;
            const transactions = Array.isArray(data.history)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? data.history.map((tx: any, idx: number) => ({
                  id: tx.id || `tx_${idx}`,
                  amountPaisa: tx.amountPaisa || tx.amount_paisa || 0,
                  type: tx.type || "REFUND_RMA",
                  reference: tx.reference || tx.orderNumber || "LEDGER",
                  notes: tx.notes || tx.description || "NCA Store Credit Adjustment",
                  createdAt: tx.createdAt || tx.created_at || new Date().toISOString(),
                  balanceAfterPaisa: tx.balanceAfterPaisa || tx.balance_after_paisa || balancePaisa,
                }))
              : [];

            setWalletData({
              balancePaisa,
              pendingWithdrawalPaisa: 0,
              transactions,
            });
          }
        }
      } catch {
        // Safe 0 balance fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchWallet();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>💳</div>
        <p>Loading your store credit wallet...</p>
      </div>
    );
  }

  return <StoreCreditWalletView initialData={walletData} />;
}
