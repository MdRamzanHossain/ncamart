"use client";

import React, { useState } from "react";
import {
  Button,
  Input,
  Textarea,
  MoneyInput,
  Badge,
  AuthenticBadge,
  BudgetSmartBadge,
  Dialog,
  Drawer,
  Tooltip,
  useToast,
  Skeleton,
} from "@/components/ui";
import { ThemeToggle, ThemeCycleButton } from "@/lib/theme";

export default function DesignSystemPage() {
  const { toast, toastError } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerPosition, setDrawerPosition] = useState<"right" | "bottom">("right");
  const [testPaisa, setTestPaisa] = useState(1450000); // ৳14,500.00
  const [hasInputError, setHasInputError] = useState(false);
  const [isLoadingBtn, setIsLoadingBtn] = useState(false);

  return (
    <main
      id="main-content"
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "var(--space-3xl) var(--space-xl) var(--space-5xl)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4xl)",
      }}
    >
      {/* Header & Theme Bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-lg)",
          paddingBottom: "var(--space-xl)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
            <AuthenticBadge size="sm" />
            <BudgetSmartBadge size="sm" />
          </div>
          <h1 style={{ fontSize: "var(--font-size-3xl)", fontWeight: "var(--font-weight-extrabold)" }}>
            NCAMart Design System Primitives (F02)
          </h1>
          <p style={{ marginTop: "var(--space-2xs)", fontSize: "var(--font-size-sm)" }}>
            Dark Obsidian & Slate foundation with Champagne Gold & Cyber Teal dual-tier indicators.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <ThemeToggle />
          <ThemeCycleButton />
        </div>
      </header>

      {/* 1. Buttons Section */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <div>
          <h2>1. Interactive Button Primitives</h2>
          <p>Tactile click ripples, 1.02x spring scale hover, and integrated loading spinner cross-fade.</p>
        </div>

        {/* Variants */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)", alignItems: "center" }}>
          <Button variant="primary">Primary Brand</Button>
          <Button variant="authentic-gold">100% Authentic Gold</Button>
          <Button variant="budget-teal">Budget Smart Teal</Button>
          <Button variant="secondary">Secondary Slate</Button>
          <Button variant="outline">Outline Border</Button>
          <Button variant="ghost">Ghost Action</Button>
          <Button variant="destructive">Destructive Action</Button>
          <Button
            variant="primary"
            isLoading={isLoadingBtn}
            onClick={() => {
              setIsLoadingBtn(true);
              setTimeout(() => setIsLoadingBtn(false), 2000);
            }}
          >
            {isLoadingBtn ? "Saving Order..." : "Click For Loading State"}
          </Button>
        </div>

        {/* Sizes */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)", alignItems: "center" }}>
          <Button size="sm" variant="secondary">Small (34px)</Button>
          <Button size="md" variant="secondary">Medium (42px)</Button>
          <Button size="lg" variant="secondary">Large (50px)</Button>
          <Button size="icon" variant="outline" aria-label="Settings icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Button>
        </div>
      </section>

      {/* 2. Inputs & Forms Section */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <div>
          <h2>2. Inputs, Textareas & Money Formatters</h2>
          <p>Floating labels, shake error animations, clear buttons, and integer paisa conversions.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-xl)" }}>
          <Input
            label="Customer Mobile (BD Phone)"
            placeholder="017XXXXXXXX"
            defaultValue="01712345678"
            allowClear
            helperText="11-digit Bangladeshi mobile number"
          />

          <Input
            label="Account Password"
            type="password"
            defaultValue="Secret123!"
            helperText="Toggle eye icon to view"
          />

          <Input
            label="Shake Error State Demo"
            value="Invalid Coupon Code"
            error={hasInputError ? "Coupon 'SUMMER10' has expired or is invalid." : undefined}
            onChange={() => {}}
            rightIcon={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHasInputError(!hasInputError)}
                style={{ height: "28px", padding: "0 var(--space-xs)" }}
              >
                Toggle Error
              </Button>
            }
          />

          <MoneyInput
            label="Pre-Order Deposit Amount"
            paisaValue={testPaisa}
            onPaisaChange={(p) => setTestPaisa(p)}
            helperText={`Stored in DB as: ${testPaisa} integer paisa`}
          />
        </div>

        <Textarea
          label="Godown Thermal Packing Notes / Dispatch Instructions"
          placeholder="E.g. Handle with care, fragile holographic seal attached..."
          rows={3}
        />
      </section>

      {/* 3. Badges Section */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <div>
          <h2>3. Dual-Tier & Functional Status Badges</h2>
          <p>Iridescent gold foil shimmer for 100% Authentic and cyber glow for Budget Smart.</p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)", alignItems: "center" }}>
          <AuthenticBadge pulse />
          <BudgetSmartBadge pulse />
          <Badge variant="success" pulse>DELIVERED (HTTP 200)</Badge>
          <Badge variant="warning">QC_HOLD (Inspection)</Badge>
          <Badge variant="destructive">SEAL_VOID_DISALLOWED</Badge>
          <Badge variant="info">IN_TRANSIT (Courier)</Badge>
          <Badge variant="neutral">DRAFT_CATALOG</Badge>
        </div>
      </section>

      {/* 4. Modals, Drawers & Tooltips */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <div>
          <h2>4. Overlays: Dialog, Drawer & Tooltips</h2>
          <p>Spring physics transitions, backdrop blur, and full focus traps.</p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)", alignItems: "center" }}>
          <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
            Open Sample Dialog Modal
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              setDrawerPosition("right");
              setIsDrawerOpen(true);
            }}
          >
            Open Side Cart Drawer
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              setDrawerPosition("bottom");
              setIsDrawerOpen(true);
            }}
          >
            Open Mobile Bottom Sheet
          </Button>

          <Tooltip content="Verified Crockford Base32 Holographic Seal">
            <Button variant="ghost" style={{ border: "1px dashed var(--border-default)" }}>
              Hover for Tooltip
            </Button>
          </Tooltip>
        </div>

        {/* Dialog Instance */}
        <Dialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          title="Holographic Seal Authentication"
          description="Every authentic unit is sealed with a unique cryptographic Crockford Base32 code."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <p>
              When a unit passes the 3-point QC bench check in Nawabpur Godown, a tamper-evident holographic seal is minted and linked to the customer&apos;s digital chain of custody.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)" }}>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="authentic-gold" onClick={() => setIsDialogOpen(false)}>
                Confirm Seal
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Drawer Instance */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title={drawerPosition === "bottom" ? "Quick Action Sheet" : "Shopping Cart Drawer (15m Lock)"}
          position={drawerPosition}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <p>
              Cart items are locked in Redis for 15 minutes to guarantee physical inventory during high-demand flash clearance drops.
            </p>
            <div
              style={{
                backgroundColor: "var(--bg-surface-elevated)",
                padding: "var(--space-md)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)" }}>
                <span style={{ fontWeight: "var(--font-weight-bold)" }}>UGREEN 65W GaN Fast Charger</span>
                <span style={{ fontFamily: "var(--font-family-mono)" }}>৳3,250.00</span>
              </div>
              <AuthenticBadge size="sm" pulse={false} />
            </div>

            <Button variant="primary" onClick={() => setIsDrawerOpen(false)}>
              Proceed to Checkout
            </Button>
          </div>
        </Drawer>
      </section>

      {/* 5. Toasts Section */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <div>
          <h2>5. Interactive Toast Notifications</h2>
          <p>Auto-dismiss progress indicators, RFC 7807 error translators, and undo callbacks.</p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)" }}>
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: "Added to Cart",
                description: "UGREEN 100W Cable reserved for 15 minutes.",
                variant: "success",
                undoLabel: "Undo Item",
                onUndo: () =>
                  toast({
                    title: "Item Removed",
                    description: "Reservation released back to godown.",
                    variant: "neutral",
                  }),
              })
            }
          >
            Trigger Success Toast with Undo
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              toastError({
                error: {
                  code: "ERR_MIXED_CART_DISALLOWED",
                  message:
                    "Pre-order items cannot be checked out together with in-stock items. Please place separate orders.",
                },
              })
            }
          >
            Trigger RFC 7807 Error Toast
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: "Class A Price Alert",
                description: "Spot price increased by ৳120 from stall. Sourcing Manager review needed.",
                variant: "warning",
              })
            }
          >
            Trigger Warning Toast
          </Button>
        </div>
      </section>

      {/* 6. Skeleton Loaders Section */}
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <div>
          <h2>6. Shimmer Skeleton Loaders</h2>
          <p>Wave animation matching avatars, text lines, table rows, and product cards.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-xl)" }}>
          {/* Card Skeleton */}
          <div
            style={{
              padding: "var(--space-lg)",
              backgroundColor: "var(--bg-surface)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-md)",
            }}
          >
            <Skeleton variant="card" height="160px" />
            <Skeleton variant="text" width="60%" height="20px" />
            <Skeleton variant="text" lines={2} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Skeleton variant="text" width="80px" height="24px" />
              <Skeleton variant="rectangular" width="100px" height="34px" />
            </div>
          </div>

          {/* Profile / Table Skeleton */}
          <div
            style={{
              padding: "var(--space-lg)",
              backgroundColor: "var(--bg-surface)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
              <Skeleton variant="circular" width="48px" height="48px" />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2xs)" }}>
                <Skeleton variant="text" width="50%" height="18px" />
                <Skeleton variant="text" width="30%" height="14px" />
              </div>
            </div>
            <Skeleton variant="table-row" />
            <Skeleton variant="table-row" />
            <Skeleton variant="table-row" />
          </div>
        </div>
      </section>
    </main>
  );
}
