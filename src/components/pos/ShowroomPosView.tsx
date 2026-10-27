"use client";

import React, { useState, useMemo } from "react";
import type {
  PosProduct,
  PosCartItem,
  PosCustomer,
  PosPaymentMethod,
  PosSessionInfo,
  PosSaleReceipt,
} from "./types";
import { formatPaisa } from "@/lib/money";
import { useBarcodeScanner, playPosBeep } from "./useBarcodeScanner";
import { useToast } from "@/components/ui/toast";

const INITIAL_SESSION: PosSessionInfo = {
  counterId: "COUNTER_NAWABPUR_01",
  counterName: "Showroom Counter #1",
  drawerSessionId: "DRW-2026-1028-01",
  drawerOpenPaisa: 1000000, // ৳10,000 opening float
  staffName: "Rashid Alam",
  staffRole: "SHOWROOM_AGENT",
  location: "Nawabpur Complex Ground Floor",
};

const SAMPLE_PRODUCTS: PosProduct[] = [
  {
    id: "pos_prod_01",
    skuId: "sku_anker_65w_blk",
    skuCode: "ANK-735-65W",
    barcode: "8901001",
    title: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
    category: "Fast Chargers",
    pricePaisa: 485000,
    showroomStock: 14,
    tier: "AUTHENTIC",
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "pos_prod_02",
    skuId: "sku_rigol_50mhz",
    skuCode: "RGL-DS1054Z",
    barcode: "8901002",
    title: "Rigol DS1054Z 50MHz 4-Ch Digital Oscilloscope",
    category: "Oscilloscopes",
    pricePaisa: 4250000,
    showroomStock: 4,
    tier: "AUTHENTIC",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "pos_prod_03",
    skuId: "sku_ts101_grey",
    skuCode: "MNW-TS101",
    barcode: "8901003",
    title: "MINIWARE TS101 65W USB-C Smart Soldering Iron",
    category: "Soldering",
    pricePaisa: 780000,
    showroomStock: 9,
    tier: "BUDGET_SMART",
    image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "pos_prod_04",
    skuId: "sku_baseus_240w",
    skuCode: "BAS-240W-CBL",
    barcode: "8901004",
    title: "Baseus Tungsten Gold 240W Type-C Braided Cable (2m)",
    category: "Cables",
    pricePaisa: 125000,
    showroomStock: 28,
    tier: "AUTHENTIC",
    image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "pos_prod_05",
    skuId: "sku_fluke_101",
    skuCode: "FLK-101-DMM",
    barcode: "8901005",
    title: "Fluke 101 Pocket Digital Multimeter with CAT III",
    category: "Lab Instruments",
    pricePaisa: 580000,
    showroomStock: 6,
    tier: "AUTHENTIC",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "pos_prod_06",
    skuId: "sku_quick_861dw",
    skuCode: "QCK-861DW",
    barcode: "8901006",
    title: "Quick 861DW 1000W Hot Air Rework Station",
    category: "Soldering",
    pricePaisa: 2850000,
    showroomStock: 3,
    tier: "AUTHENTIC",
    image: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80",
  },
];

const GUEST_CUSTOMER: PosCustomer = {
  phone: "01700000000",
  name: "Walk-in Guest",
  isGuest: true,
};

export function ShowroomPosView() {
  const [products] = useState<PosProduct[]>(SAMPLE_PRODUCTS);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [barcodeInput, setBarcodeInput] = useState<string>("");

  const [customer, setCustomer] = useState<PosCustomer>(GUEST_CUSTOMER);
  const [customerPhoneInput, setCustomerPhoneInput] = useState<string>("");

  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("CASH");
  const [cashTenderedInput, setCashTenderedInput] = useState<string>("");

  const [lastReceipt, setLastReceipt] = useState<PosSaleReceipt | null>(null);
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  const { addToast } = useToast();

  // Cart calculations
  const subtotalPaisa = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.pricePaisa * item.quantity, 0);
  }, [cart]);

  // VAT (included in wholesale price per Bangladesh Mushak 6.3)
  const vatPaisa = useMemo(() => {
    return Math.round(subtotalPaisa * 0.075);
  }, [subtotalPaisa]);

  const totalPaisa = subtotalPaisa;

  // Tendered calculation
  const tenderedPaisa = useMemo(() => {
    if (paymentMethod !== "CASH") return totalPaisa;
    const parsed = parseFloat(cashTenderedInput);
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 100);
  }, [paymentMethod, cashTenderedInput, totalPaisa]);

  const changeDuePaisa = Math.max(0, tenderedPaisa - totalPaisa);
  const remainingDuePaisa = Math.max(0, totalPaisa - tenderedPaisa);

  // Add SKU to cart helper
  const addProductToCart = (prod: PosProduct) => {
    playPosBeep();
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === prod.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === prod.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product: prod,
          quantity: 1,
          assignedSealId: `NCA-SEAL-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        },
      ];
    });

    addToast({
      title: "Item Scanned",
      description: `Added "${prod.title}" to POS cart.`,
      variant: "success",
    });
  };

  // Hardware barcode scanner hook
  useBarcodeScanner({
    onScan: (barcode) => {
      const match = products.find(
        (p) => p.barcode === barcode || p.skuCode.toLowerCase() === barcode.toLowerCase()
      );
      if (match) {
        addProductToCart(match);
      } else {
        addToast({
          title: "Unknown Barcode",
          description: `No SKU found in Nawabpur inventory matching barcode "${barcode}".`,
          variant: "error",
        });
      }
    },
  });

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim();
    const match = products.find(
      (p) => p.barcode === query || p.skuCode.toLowerCase() === query.toLowerCase()
    );

    if (match) {
      addProductToCart(match);
      setBarcodeInput("");
    } else {
      addToast({
        title: "Barcode Not Found",
        description: `No item matched barcode or SKU "${query}".`,
        variant: "error",
      });
    }
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as PosCartItem[]
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setCashTenderedInput("");
  };

  // Quick cash buttons
  const setExactCash = () => {
    setCashTenderedInput((totalPaisa / 100).toFixed(0));
  };

  const addCashAmount = (amountBdt: number) => {
    const current = parseFloat(cashTenderedInput) || 0;
    setCashTenderedInput((current + amountBdt).toFixed(0));
  };

  // Customer search / attach
  const handleAttachCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerPhoneInput.length < 11) {
      addToast({
        title: "Invalid Phone",
        description: "Please enter an 11-digit Bangladesh phone number (+8801...).",
        variant: "error",
      });
      return;
    }

    setCustomer({
      phone: customerPhoneInput,
      name: "Engr. Tanvir Ahmed",
      loyaltyTier: "PRO_ENGINEER",
      storeCreditPaisa: 245000,
      isGuest: false,
    });

    addToast({
      title: "Customer Attached",
      description: "Attached Engr. Tanvir Ahmed (+8801711223344) with Pro Tier benefits.",
      variant: "success",
    });
  };

  const handleSetGuestCustomer = () => {
    setCustomer(GUEST_CUSTOMER);
    setCustomerPhoneInput("");
  };

  // Complete walk-in sale
  const handleCompleteSale = () => {
    if (cart.length === 0) {
      addToast({
        title: "Cart is Empty",
        description: "Scan or select at least 1 product to complete sale.",
        variant: "error",
      });
      return;
    }

    if (paymentMethod === "CASH" && tenderedPaisa < totalPaisa) {
      addToast({
        title: "Insufficient Cash Tendered",
        description: `Remaining due: ${formatPaisa(remainingDuePaisa)}. Enter full cash amount.`,
        variant: "error",
      });
      return;
    }

    setIsProcessingSale(true);

    setTimeout(() => {
      const invoiceNum = `POS-${Date.now().toString().slice(-6)}`;
      const mushakSerial = `M6.3-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      const receipt: PosSaleReceipt = {
        invoiceNumber: invoiceNum,
        mushak63Serial: mushakSerial,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        cashierName: INITIAL_SESSION.staffName,
        counterName: INITIAL_SESSION.counterName,
        customer,
        items: [...cart],
        subtotalPaisa,
        vatPaisa,
        totalPaisa,
        tenderedPaisa,
        changeDuePaisa,
        paymentMethod,
        sealIds: cart.map((i) => i.assignedSealId || "NCA-GEN-SEAL"),
      };

      setLastReceipt(receipt);
      setIsProcessingSale(false);
      setCart([]);
      setCashTenderedInput("");

      addToast({
        title: "Sale Completed!",
        description: `Invoice ${invoiceNum} generated. Cash drawer opened.`,
        variant: "success",
      });
    }, 450);
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "ALL" && p.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.skuCode.toLowerCase().includes(q) ||
        p.barcode.includes(q)
      );
    }
    return true;
  });

  const categories = ["ALL", "Fast Chargers", "Oscilloscopes", "Soldering", "Cables", "Lab Instruments"];

  return (
    <div className="pos-root" data-testid="showroom-pos-view">
      {/* 1. Top Session & Hardware Status Bar */}
      <header className="pos-topbar">
        <div className="topbar-left">
          <span className="pos-brand">NCAMart POS</span>
          <span className="counter-pill">{INITIAL_SESSION.counterName}</span>
          <span className="status-indicator">
            <span className="pulse-dot" />
            <span>Nawabpur Central Godown Sync Online</span>
          </span>
        </div>

        <div className="topbar-right">
          <div className="staff-pill">
            <span className="staff-role-badge">SHOWROOM_AGENT</span>
            <span className="staff-name">{INITIAL_SESSION.staffName}</span>
          </div>

          <div className="drawer-pill">
            <span className="drawer-label">Drawer Active</span>
            <span className="drawer-amount">৳10,000 Float</span>
          </div>

          <div className="pos-clock">
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
      </header>

      {/* 2. Main Two-Column Touch Screen Layout */}
      <main className="pos-main">
        {/* LEFT COLUMN: Product Touch Grid & Barcode Scanner */}
        <section className="pos-left-pane">
          {/* Barcode Scanner HUD */}
          <div className="scanner-hud">
            <div className="hud-title-row">
              <div className="hud-status">
                <span className="scanner-icon">⚡</span>
                <span className="scanner-label">Laser Barcode Gun Active (Auto-Detect)</span>
              </div>
              <span className="hud-hint">&lt;50ms Instant Beep Listen</span>
            </div>

            {/* Quick Simulation Chips */}
            <div className="scan-sim-chips">
              <span className="sim-chip-label">Quick Scan:</span>
              <button
                type="button"
                className="chip-btn"
                onClick={() => addProductToCart(products[0])}
              >
                Anker 65W
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => addProductToCart(products[1])}
              >
                Rigol Scope
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => addProductToCart(products[2])}
              >
                TS101 Iron
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => addProductToCart(products[3])}
              >
                240W Cable
              </button>
            </div>

            {/* Manual input form */}
            <form onSubmit={handleManualBarcodeSubmit} className="barcode-input-form">
              <input
                id="barcode-quick-field"
                type="text"
                placeholder="Scan or enter barcode / SKU (e.g. 8901001)..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="barcode-text-input"
              />
              <button type="submit" className="barcode-submit-btn">
                Add SKU
              </button>
            </form>
          </div>

          {/* Category Filter Pills & Search */}
          <div className="category-and-search-row">
            <div className="category-tabs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`cat-pill ${selectedCategory === cat ? "cat-active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="search-wrap">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {/* Product Touch Grid */}
          <div className="products-touch-grid">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                className="product-touch-card"
                onClick={() => addProductToCart(p)}
                data-testid={`pos-product-${p.skuCode}`}
              >
                <div className="card-top">
                  <span className={`tier-badge ${p.tier === "AUTHENTIC" ? "gold" : "teal"}`}>
                    {p.tier === "AUTHENTIC" ? "✨ Authentic" : "⚡ Smart"}
                  </span>
                  <span className="stock-count">{p.showroomStock} in counter</span>
                </div>

                <div className="card-img-wrap">
                  <img src={p.image} alt={p.title} className="card-img" />
                </div>

                <div className="card-info">
                  <span className="sku-code">{p.skuCode}</span>
                  <h4 className="prod-title">{p.title}</h4>
                  <span className="prod-price">{formatPaisa(p.pricePaisa)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* RIGHT COLUMN: Active Cart & Tender Console */}
        <section className="pos-right-pane">
          {/* Customer Selection Banner */}
          <div className="customer-banner">
            <div className="customer-info-row">
              <div className="customer-icon">👤</div>
              <div>
                <div className="customer-name-row">
                  <span className="customer-name">{customer.name}</span>
                  {!customer.isGuest && (
                    <span className="customer-pro-tag">PRO ENGINEER</span>
                  )}
                </div>
                <span className="customer-phone-label">{customer.phone}</span>
              </div>
            </div>

            <div className="customer-actions">
              {!customer.isGuest ? (
                <button
                  type="button"
                  className="guest-switch-btn"
                  onClick={handleSetGuestCustomer}
                >
                  Switch to Guest
                </button>
              ) : (
                <form onSubmit={handleAttachCustomer} className="attach-form">
                  <input
                    type="tel"
                    placeholder="Mobile 017..."
                    value={customerPhoneInput}
                    onChange={(e) => setCustomerPhoneInput(e.target.value)}
                    className="customer-phone-input"
                  />
                  <button type="submit" className="attach-btn">
                    Attach
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="pos-cart-container">
            <div className="cart-header-row">
              <span className="cart-title">Billing Items ({cart.length})</span>
              {cart.length > 0 && (
                <button type="button" className="clear-cart-btn" onClick={handleClearCart}>
                  Clear Cart
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart-view">
                <span className="empty-cart-icon">🛒</span>
                <p className="empty-cart-text">Cart is empty. Scan an item or tap a product card.</p>
              </div>
            ) : (
              <div className="cart-items-scroll">
                {cart.map((item) => (
                  <div key={item.product.id} className="cart-item-row" data-testid={`pos-cart-item-${item.product.skuCode}`}>
                    <div className="item-details">
                      <span className="item-title">{item.product.title}</span>
                      <div className="item-meta">
                        <span className="sku-tag">{item.product.skuCode}</span>
                        <span className="seal-tag">🔒 {item.assignedSealId}</span>
                      </div>
                    </div>

                    <div className="item-quantity-stepper">
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => handleUpdateQuantity(item.product.id, -1)}
                      >
                        –
                      </button>
                      <span className="stepper-val">{item.quantity}</span>
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => handleUpdateQuantity(item.product.id, 1)}
                      >
                        +
                      </button>
                    </div>

                    <div className="item-total-col">
                      <span className="line-total">
                        {formatPaisa(item.product.pricePaisa * item.quantity)}
                      </span>
                      <button
                        type="button"
                        className="remove-line-btn"
                        onClick={() => handleRemoveItem(item.product.id)}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Summary */}
          <div className="financial-summary">
            <div className="summary-row">
              <span>Subtotal (Ex-VAT)</span>
              <span>{formatPaisa(subtotalPaisa - vatPaisa)}</span>
            </div>
            <div className="summary-row">
              <span>Mushak 6.3 VAT (7.5% Included)</span>
              <span>{formatPaisa(vatPaisa)}</span>
            </div>
            <div className="summary-row total-row">
              <span className="total-label">Total Payable</span>
              <span className="total-amount">{formatPaisa(totalPaisa)}</span>
            </div>
          </div>

          {/* Tender Panel */}
          <div className="tender-panel">
            {/* Payment Method Selector */}
            <div className="payment-tabs-row">
              <button
                type="button"
                className={`pay-tab ${paymentMethod === "CASH" ? "active" : ""}`}
                onClick={() => setPaymentMethod("CASH")}
              >
                💵 Cash
              </button>
              <button
                type="button"
                className={`pay-tab ${paymentMethod === "BKASH_QR" ? "active" : ""}`}
                onClick={() => setPaymentMethod("BKASH_QR")}
              >
                📱 bKash POS
              </button>
              <button
                type="button"
                className={`pay-tab ${paymentMethod === "CARD_TERMINAL" ? "active" : ""}`}
                onClick={() => setPaymentMethod("CARD_TERMINAL")}
              >
                💳 Card POS
              </button>
              <button
                type="button"
                className={`pay-tab ${paymentMethod === "STORE_CREDIT" ? "active" : ""}`}
                onClick={() => setPaymentMethod("STORE_CREDIT")}
              >
                👛 Store Credit
              </button>
            </div>

            {/* Cash Tendered Calculator */}
            {paymentMethod === "CASH" && (
              <div className="cash-calculator">
                <div className="quick-cash-row">
                  <button type="button" className="quick-cash-btn" onClick={setExactCash}>
                    Exact
                  </button>
                  <button type="button" className="quick-cash-btn" onClick={() => addCashAmount(500)}>
                    +৳500
                  </button>
                  <button type="button" className="quick-cash-btn" onClick={() => addCashAmount(1000)}>
                    +৳1,000
                  </button>
                  <button type="button" className="quick-cash-btn" onClick={() => addCashAmount(2000)}>
                    +৳2,000
                  </button>
                  <button type="button" className="quick-cash-btn" onClick={() => addCashAmount(5000)}>
                    +৳5,000
                  </button>
                </div>

                <div className="cash-input-row">
                  <div className="cash-input-box">
                    <label className="cash-label">Cash Tendered (৳)</label>
                    <input
                      type="number"
                      placeholder="Enter amount..."
                      value={cashTenderedInput}
                      onChange={(e) => setCashTenderedInput(e.target.value)}
                      className="cash-num-input"
                    />
                  </div>

                  <div className="change-due-box">
                    <span className="change-label">
                      {tenderedPaisa >= totalPaisa ? "Change Due" : "Remaining Due"}
                    </span>
                    <span
                      className={`change-val ${
                        tenderedPaisa >= totalPaisa ? "change-positive" : "change-negative"
                      }`}
                    >
                      {tenderedPaisa >= totalPaisa
                        ? formatPaisa(changeDuePaisa)
                        : formatPaisa(remainingDuePaisa)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === "BKASH_QR" && (
              <div className="digital-tender-box">
                <span className="qr-sim-icon">📱</span>
                <div>
                  <div className="digital-title">Showroom Merchant bKash QR Active</div>
                  <span className="digital-sub">Scan counter QR code via bKash App • Account 01700998877</span>
                </div>
              </div>
            )}

            {paymentMethod === "CARD_TERMINAL" && (
              <div className="digital-tender-box">
                <span className="qr-sim-icon">💳</span>
                <div>
                  <div className="digital-title">POS Terminal Ready (Counter #1)</div>
                  <span className="digital-sub">Swipe / Insert Visa, Mastercard, NexusPay</span>
                </div>
              </div>
            )}

            {paymentMethod === "STORE_CREDIT" && (
              <div className="digital-tender-box">
                <span className="qr-sim-icon">👛</span>
                <div>
                  <div className="digital-title">
                    Available Balance: {formatPaisa(customer.storeCreditPaisa || 0)}
                  </div>
                  <span className="digital-sub">
                    {customer.isGuest
                      ? "Attach registered customer to use Store Credit"
                      : "Sufficient balance for this transaction"}
                  </span>
                </div>
              </div>
            )}

            {/* Complete Sale Action */}
            <button
              type="button"
              className="complete-sale-btn"
              onClick={handleCompleteSale}
              disabled={isProcessingSale || cart.length === 0}
            >
              <span className="bolt-icon">⚡</span>
              <span>
                {isProcessingSale
                  ? "Processing Sale..."
                  : `Complete Walk-in Sale & Print Mushak 6.3 (${formatPaisa(totalPaisa)})`}
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* Sale Success & Thermal Receipt Modal */}
      {lastReceipt && (
        <div className="receipt-modal-backdrop" onClick={() => setLastReceipt(null)}>
          <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-header">
              <span className="success-check">✓</span>
              <h2>Walk-in Sale Confirmed!</h2>
              <p>Mushak 6.3 VAT Tax Invoice Printed to Counter Receipt Printer</p>
            </div>

            <div className="receipt-paper">
              <div className="paper-header">
                <h3>NAWABPUR COMPLEX ACCESSORIES</h3>
                <p>Nawabpur Tower, Shop #14, Nawabpur Road, Dhaka</p>
                <p>BIN / Mushak Registration: 002391029-0101</p>
                <p>MUSHAK 6.3 TAX INVOICE: {lastReceipt.mushak63Serial}</p>
                <div className="divider-dash" />
              </div>

              <div className="paper-meta">
                <div>Invoice: {lastReceipt.invoiceNumber}</div>
                <div>Time: {lastReceipt.timestamp}</div>
                <div>Cashier: {lastReceipt.cashierName}</div>
                <div>Customer: {lastReceipt.customer.name} ({lastReceipt.customer.phone})</div>
                <div className="divider-dash" />
              </div>

              <div className="paper-items">
                {lastReceipt.items.map((i, idx) => (
                  <div key={idx} className="paper-item-row">
                    <span>
                      {i.quantity}x {i.product.title}
                    </span>
                    <span>{formatPaisa(i.product.pricePaisa * i.quantity)}</span>
                  </div>
                ))}
                <div className="divider-dash" />
              </div>

              <div className="paper-totals">
                <div className="paper-tot-row">
                  <span>Subtotal:</span>
                  <span>{formatPaisa(lastReceipt.subtotalPaisa)}</span>
                </div>
                <div className="paper-tot-row">
                  <span>VAT (7.5% Included):</span>
                  <span>{formatPaisa(lastReceipt.vatPaisa)}</span>
                </div>
                <div className="paper-tot-row font-bold">
                  <span>Total Paid:</span>
                  <span>{formatPaisa(lastReceipt.totalPaisa)}</span>
                </div>
                {lastReceipt.paymentMethod === "CASH" && (
                  <>
                    <div className="paper-tot-row">
                      <span>Tendered:</span>
                      <span>{formatPaisa(lastReceipt.tenderedPaisa)}</span>
                    </div>
                    <div className="paper-tot-row font-bold">
                      <span>Change Given:</span>
                      <span>{formatPaisa(lastReceipt.changeDuePaisa)}</span>
                    </div>
                  </>
                )}
                <div className="divider-dash" />
              </div>

              <div className="paper-seals">
                <p className="seals-header">Tamper-Evident Holographic Seals:</p>
                {lastReceipt.sealIds.map((s, idx) => (
                  <p key={idx} className="seal-code">
                    🔒 {s} (Verify at ncamart.com/verify)
                  </p>
                ))}
              </div>

              <div className="paper-footer">
                <p>Thank you for choosing Nawabpur Authentic Gear!</p>
                <p>No Counterfeit Guarantee • 72-Hour Swap Policy</p>
              </div>
            </div>

            <div className="receipt-actions">
              <button
                type="button"
                className="btn-print"
                onClick={() => {
                  if (typeof window !== "undefined") window.print();
                }}
              >
                🖨️ Re-Print Receipt (80mm)
              </button>
              <button
                type="button"
                className="btn-done"
                onClick={() => setLastReceipt(null)}
              >
                Start Next Customer Sale
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .pos-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #0b1120;
          color: #f8fafc;
          font-family: var(--font-sans, system-ui, sans-serif);
          overflow: hidden;
        }

        /* Topbar */
        .pos-topbar {
          height: 54px;
          background: #0f172a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          flex-shrink: 0;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pos-brand {
          font-size: 16px;
          font-weight: 900;
          color: #f59e0b;
          letter-spacing: -0.5px;
        }

        .counter-pill {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #10b981;
          font-weight: 600;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .staff-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.05);
          padding: 3px 10px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 12px;
        }

        .staff-role-badge {
          font-size: 10px;
          font-weight: 800;
          color: #38bdf8;
          font-family: monospace;
        }

        .staff-name {
          font-weight: 700;
          color: #f8fafc;
        }

        .drawer-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 3px 8px;
          border-radius: 6px;
        }

        .drawer-label {
          color: #10b981;
          font-weight: 700;
        }

        .drawer-amount {
          color: #a7f3d0;
          font-weight: 800;
        }

        .pos-clock {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        /* Split Main */
        .pos-main {
          display: grid;
          grid-template-columns: 1fr 440px;
          height: calc(100vh - 54px);
          overflow: hidden;
        }

        @media (max-width: 1024px) {
          .pos-main {
            grid-template-columns: 1fr;
            overflow-y: auto;
          }
        }

        /* Left Pane */
        .pos-left-pane {
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }

        .scanner-hud {
          background: rgba(30, 41, 59, 0.4);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px 18px;
        }

        .hud-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .hud-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #fbbf24;
        }

        .hud-hint {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
        }

        .scan-sim-chips {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .sim-chip-label {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
        }

        .chip-btn {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .chip-btn:hover {
          background: #f59e0b;
          color: #0f172a;
          border-color: #f59e0b;
        }

        .barcode-input-form {
          display: flex;
          gap: 8px;
        }

        .barcode-text-input {
          flex: 1;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          color: #f8fafc;
          font-size: 13px;
        }

        .barcode-submit-btn {
          padding: 8px 16px;
          border-radius: 8px;
          background: #f59e0b;
          color: #0f172a;
          font-size: 12px;
          font-weight: 800;
          border: none;
          cursor: pointer;
        }

        /* Filter & Search */
        .category-and-search-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          background: rgba(15, 23, 42, 0.4);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          gap: 12px;
          flex-wrap: wrap;
        }

        .category-tabs {
          display: flex;
          gap: 6px;
          overflow-x: auto;
        }

        .cat-pill {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .cat-pill:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.08);
        }

        .cat-active {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.5);
          color: #fbbf24;
        }

        .search-wrap {
          width: 200px;
        }

        .search-input {
          width: 100%;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 6px 10px;
          color: #f8fafc;
          font-size: 12px;
        }

        /* Products Grid */
        .products-touch-grid {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
          align-content: start;
        }

        .product-touch-card {
          background: rgba(30, 41, 59, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: all 0.15s ease;
        }

        .product-touch-card:hover {
          border-color: #f59e0b;
          transform: translateY(-2px);
          background: rgba(30, 41, 59, 0.6);
        }

        .product-touch-card:active {
          transform: scale(0.98);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tier-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .tier-badge.gold {
          background: rgba(245, 158, 11, 0.2);
          color: #fbbf24;
        }

        .tier-badge.teal {
          background: rgba(20, 184, 166, 0.2);
          color: #2dd4bf;
        }

        .stock-count {
          font-size: 10px;
          color: #10b981;
          font-weight: 600;
        }

        .card-img-wrap {
          height: 100px;
          background: #0f172a;
          border-radius: 8px;
          overflow: hidden;
        }

        .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .card-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sku-code {
          font-size: 10px;
          color: #94a3b8;
          font-family: monospace;
        }

        .prod-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.3;
          color: #f8fafc;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .prod-price {
          font-size: 15px;
          font-weight: 800;
          color: #f59e0b;
          margin-top: 4px;
        }

        /* Right Pane */
        .pos-right-pane {
          display: flex;
          flex-direction: column;
          background: #0e1526;
          overflow: hidden;
        }

        /* Customer Banner */
        .customer-banner {
          background: rgba(15, 23, 42, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .customer-info-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .customer-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .customer-name-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .customer-name {
          font-size: 13px;
          font-weight: 800;
          color: #f8fafc;
        }

        .customer-pro-tag {
          font-size: 9px;
          font-weight: 800;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.15);
          padding: 1px 4px;
          border-radius: 4px;
        }

        .customer-phone-label {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .guest-switch-btn {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
        }

        .attach-form {
          display: flex;
          gap: 4px;
        }

        .customer-phone-input {
          width: 110px;
          font-size: 11px;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #fff;
        }

        .attach-btn {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        /* Cart */
        .pos-cart-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 12px 16px;
        }

        .cart-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .cart-title {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #cbd5e1;
        }

        .clear-cart-btn {
          font-size: 11px;
          color: #ef4444;
          background: none;
          border: none;
          cursor: pointer;
        }

        .empty-cart-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #64748b;
          text-align: center;
          gap: 8px;
        }

        .empty-cart-icon {
          font-size: 32px;
        }

        .empty-cart-text {
          font-size: 12px;
          margin: 0;
          max-width: 220px;
        }

        .cart-items-scroll {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cart-item-row {
          background: rgba(30, 41, 59, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .item-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .item-title {
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.3;
        }

        .item-meta {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sku-tag {
          font-size: 10px;
          color: #94a3b8;
          font-family: monospace;
        }

        .seal-tag {
          font-size: 10px;
          color: #10b981;
          font-family: monospace;
        }

        .item-quantity-stepper {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 6px;
          padding: 2px;
        }

        .stepper-btn {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .stepper-val {
          width: 24px;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          color: #f8fafc;
        }

        .item-total-col {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .line-total {
          font-size: 13px;
          font-weight: 800;
          color: #f59e0b;
        }

        .remove-line-btn {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 11px;
        }

        .remove-line-btn:hover {
          color: #ef4444;
        }

        /* Summary */
        .financial-summary {
          background: rgba(15, 23, 42, 0.7);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #94a3b8;
        }

        .total-row {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 6px;
          margin-top: 2px;
          font-size: 14px;
        }

        .total-label {
          font-weight: 800;
          color: #f8fafc;
        }

        .total-amount {
          font-weight: 900;
          font-size: 18px;
          color: #f59e0b;
        }

        /* Tender */
        .tender-panel {
          background: #090e1a;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .payment-tabs-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }

        .pay-tab {
          padding: 8px 4px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s ease;
        }

        .pay-tab.active {
          background: #f59e0b;
          color: #0f172a;
          border-color: #f59e0b;
        }

        /* Cash Calculator */
        .cash-calculator {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(30, 41, 59, 0.3);
          padding: 8px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .quick-cash-row {
          display: flex;
          gap: 4px;
        }

        .quick-cash-btn {
          flex: 1;
          padding: 6px 2px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          cursor: pointer;
        }

        .quick-cash-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        .cash-input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .cash-input-box {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .cash-label {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
        }

        .cash-num-input {
          background: #000;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          padding: 6px 8px;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
        }

        .change-due-box {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: rgba(0, 0, 0, 0.4);
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .change-label {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
        }

        .change-val {
          font-size: 15px;
          font-weight: 900;
        }

        .change-positive {
          color: #10b981;
        }

        .change-negative {
          color: #f59e0b;
        }

        .digital-tender-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 8px;
          background: rgba(30, 41, 59, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .qr-sim-icon {
          font-size: 24px;
        }

        .digital-title {
          font-size: 12px;
          font-weight: 800;
          color: #f8fafc;
        }

        .digital-sub {
          font-size: 11px;
          color: #94a3b8;
        }

        .complete-sale-btn {
          padding: 12px;
          border-radius: 8px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff;
          font-size: 13px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
          transition: all 0.2s ease;
        }

        .complete-sale-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
        }

        .complete-sale-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Receipt Modal */
        .receipt-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }

        .receipt-modal-content {
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          max-width: 440px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .receipt-header {
          text-align: center;
        }

        .success-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
          font-size: 24px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .receipt-header h2 {
          font-size: 18px;
          font-weight: 800;
          margin: 0 0 4px 0;
        }

        .receipt-header p {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }

        /* 80mm Thermal Paper Simulation */
        .receipt-paper {
          background: #ffffff;
          color: #000000;
          padding: 16px 14px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
          line-height: 1.4;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .paper-header {
          text-align: center;
        }

        .paper-header h3 {
          font-size: 12px;
          font-weight: 900;
          margin: 0 0 4px 0;
        }

        .paper-header p {
          margin: 2px 0;
          font-size: 10px;
        }

        .divider-dash {
          border-bottom: 1px dashed #000;
          margin: 8px 0;
        }

        .paper-item-row,
        .paper-tot-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }

        .font-bold {
          font-weight: 900;
        }

        .paper-seals {
          margin: 8px 0;
        }

        .seals-header {
          font-weight: 800;
          margin: 0 0 2px 0;
        }

        .seal-code {
          margin: 2px 0;
          font-size: 10px;
        }

        .paper-footer {
          text-align: center;
          font-size: 9px;
          margin-top: 8px;
        }

        .paper-footer p {
          margin: 2px 0;
        }

        .receipt-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .btn-print {
          padding: 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-done {
          padding: 12px;
          border-radius: 8px;
          background: #f59e0b;
          color: #0f172a;
          font-size: 13px;
          font-weight: 800;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
