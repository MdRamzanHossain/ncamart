"use client";

import React, { useState, useEffect } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { useRealtimeEvents, RealtimeEventPayload } from "@/hooks/useRealtimeEvents";
import { useAuth } from "@/context/AuthContext";

export interface NotificationItem {
  id: string;
  classification: "CLASS_A" | "CLASS_B" | "CLASS_C";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  orderNumber?: string;
  sealId?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    classification: "CLASS_A",
    title: "Payment Confirmed (SSLCommerz)",
    message: "Order #NCA-2026-8812 confirmed. Holographic seal allocated in Godown Nawabpur.",
    timestamp: "2 mins ago",
    isRead: false,
    orderNumber: "NCA-2026-8812",
  },
  {
    id: "notif-2",
    classification: "CLASS_B",
    title: "Quality Control Passed (QC)",
    message: "Holographic Seal #NC7X-9K2M passed 3-point bench inspection and applied to unit.",
    timestamp: "15 mins ago",
    isRead: false,
    sealId: "NC7X-9K2M",
  },
  {
    id: "notif-3",
    classification: "CLASS_C",
    title: "Back in Stock: TS101 Smart Soldering Iron",
    message: "Fresh batch arrived from authentic distributor. Instant dispatch available.",
    timestamp: "1 hour ago",
    isRead: true,
  },
];

export function NotificationDrawer({
  isOpen,
  onClose,
  onUnreadCountChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState<"ALL" | "CLASS_A" | "CLASS_B" | "CLASS_C">("ALL");
  const { user } = useAuth();

  // Only subscribe to staff SSE channel if authenticated as a staff member
  const staffChannel = user && user.isStaff ? "all-staff" : null;
  const { addListener } = useRealtimeEvents(staffChannel);

  // Listen to incoming SSE realtime events and dynamically insert new notifications
  useEffect(() => {
    const unsub = addListener("*", (event: RealtimeEventPayload) => {
      const isCritical = event.type.includes("payment") || event.type.includes("otp") || event.type.includes("pin");
      const isOperational = event.type.includes("qc") || event.type.includes("runner") || event.type.includes("courier");

      const newNotif: NotificationItem = {
        id: event.eventId || `sse-${Date.now()}`,
        classification: isCritical ? "CLASS_A" : isOperational ? "CLASS_B" : "CLASS_C",
        title: `Realtime Event: ${event.type}`,
        message: typeof event.data === "object" ? JSON.stringify(event.data) : "New update received",
        timestamp: "Just now",
        isRead: false,
      };

      setNotifications((prev) => [newNotif, ...prev]);
    });

    return unsub;
  }, [addListener]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "ALL") return true;
    return n.classification === activeTab;
  });

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Notifications & Alerts" size="440px">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        {/* Header Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "var(--space-xs)" }}>
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              style={{
                padding: "var(--space-2xs) var(--space-sm)",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--font-size-2xs)",
                fontWeight: "var(--font-weight-bold)",
                backgroundColor: activeTab === "ALL" ? "var(--color-brand-primary)" : "var(--bg-surface-elevated)",
                color: activeTab === "ALL" ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CLASS_A")}
              style={{
                padding: "var(--space-2xs) var(--space-sm)",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--font-size-2xs)",
                fontWeight: "var(--font-weight-bold)",
                backgroundColor: activeTab === "CLASS_A" ? "var(--color-destructive)" : "var(--bg-surface-elevated)",
                color: activeTab === "CLASS_A" ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Class A (Critical)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("CLASS_B")}
              style={{
                padding: "var(--space-2xs) var(--space-sm)",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--font-size-2xs)",
                fontWeight: "var(--font-weight-bold)",
                backgroundColor: activeTab === "CLASS_B" ? "var(--color-brand-primary)" : "var(--bg-surface-elevated)",
                color: activeTab === "CLASS_B" ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Class B (Ops)
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              style={{
                fontSize: "var(--font-size-2xs)",
                color: "var(--color-brand-primary)",
                fontWeight: "var(--font-weight-semibold)",
                cursor: "pointer",
              }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {filteredNotifications.length === 0 ? (
            <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>
              No notifications found in this category.
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                style={{
                  backgroundColor: n.isRead ? "var(--bg-surface-elevated)" : "var(--bg-surface-active)",
                  border: `1px solid ${n.isRead ? "var(--border-subtle)" : "var(--border-default)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)",
                  transition: "all var(--duration-fast) ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                    {n.classification === "CLASS_A" && (
                      <Badge variant="destructive" size="sm" pulse>Class A</Badge>
                    )}
                    {n.classification === "CLASS_B" && (
                      <Badge variant="info" size="sm">Class B</Badge>
                    )}
                    {n.classification === "CLASS_C" && (
                      <Badge variant="neutral" size="sm">Class C</Badge>
                    )}
                    <span style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-bold)", color: "var(--text-primary)" }}>
                      {n.title}
                    </span>
                  </div>

                  <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--text-tertiary)" }}>
                    {n.timestamp}
                  </span>
                </div>

                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-secondary)", lineHeight: "var(--line-height-normal)" }}>
                  {n.message}
                </p>

                {n.orderNumber && (
                  <span style={{ fontSize: "11px", fontFamily: "var(--font-family-mono)", color: "var(--color-brand-primary)" }}>
                    Order: {n.orderNumber}
                  </span>
                )}
                {n.sealId && (
                  <span style={{ fontSize: "11px", fontFamily: "var(--font-family-mono)", color: "var(--tier-authentic-gold)" }}>
                    Holographic Seal: {n.sealId}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Drawer>
  );
}
