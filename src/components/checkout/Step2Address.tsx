"use client";

import React, { useState, useEffect } from "react";
import { ShippingAddressData, CorporateInvoiceData } from "./types";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api/client";

interface GeoItem {
  id: string;
  name_en: string;
  name_bn?: string;
}

// Built-in Seed Fallback to guarantee ZERO blank states if network is offline
const FALLBACK_DIVISIONS: GeoItem[] = [
  { id: "div-dhaka", name_en: "Dhaka" },
  { id: "div-chittagong", name_en: "Chittagong" },
  { id: "div-rajshahi", name_en: "Rajshahi" },
  { id: "div-khulna", name_en: "Khulna" },
  { id: "div-sylhet", name_en: "Sylhet" },
  { id: "div-barisal", name_en: "Barisal" },
  { id: "div-rangpur", name_en: "Rangpur" },
  { id: "div-mymensingh", name_en: "Mymensingh" },
];

const FALLBACK_DISTRICTS: Record<string, GeoItem[]> = {
  "div-dhaka": [
    { id: "dist-dhaka", name_en: "Dhaka City" },
    { id: "dist-gazipur", name_en: "Gazipur" },
    { id: "dist-narayanganj", name_en: "Narayanganj" },
    { id: "dist-savar", name_en: "Savar" },
    { id: "dist-tangail", name_en: "Tangail" },
  ],
  "div-chittagong": [
    { id: "dist-ctg", name_en: "Chittagong City" },
    { id: "dist-cox", name_en: "Cox's Bazar" },
    { id: "dist-comilla", name_en: "Comilla" },
  ],
};

const FALLBACK_THANAS: Record<string, GeoItem[]> = {
  "dist-dhaka": [
    { id: "thana-kotwali", name_en: "Kotwali (Nawabpur)" },
    { id: "thana-dhanmondi", name_en: "Dhanmondi" },
    { id: "thana-gulshan", name_en: "Gulshan" },
    { id: "thana-motijheel", name_en: "Motijheel" },
    { id: "thana-uttara", name_en: "Uttara" },
    { id: "thana-mirpur", name_en: "Mirpur" },
  ],
};

export interface Step2AddressProps {
  customerName?: string;
  customerPhone?: string;
  onBack: () => void;
  onComplete: (data: { address: ShippingAddressData; corporate: CorporateInvoiceData }) => void;
}

export function Step2Address({ customerName = "", customerPhone = "", onBack, onComplete }: Step2AddressProps) {
  const { toast } = useToast();

  const [recipientName, setRecipientName] = useState(customerName || "");
  const [recipientPhone, setRecipientPhone] = useState(customerPhone || "");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [isPickupCounter, setIsPickupCounter] = useState(false);

  // Geo Cascade State
  const [divisions, setDivisions] = useState<GeoItem[]>(FALLBACK_DIVISIONS);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("div-dhaka");
  const [districts, setDistricts] = useState<GeoItem[]>(FALLBACK_DISTRICTS["div-dhaka"] || []);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("dist-dhaka");
  const [thanas, setThanas] = useState<GeoItem[]>(FALLBACK_THANAS["dist-dhaka"] || []);
  const [selectedThanaId, setSelectedThanaId] = useState<string>("thana-kotwali");

  // Corporate VAT / Mushak 6.3 State
  const [isCorporateRequested, setIsCorporateRequested] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [binNumber, setBinNumber] = useState("");

  // Load Divisions from API with graceful fallback
  useEffect(() => {
    let mounted = true;
    api
      .get<GeoItem[]>("/api/v1/geo/divisions")
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setDivisions(data);
          if (!data.some((d) => d.id === selectedDivisionId)) {
            setSelectedDivisionId(data[0].id);
          }
        }
      })
      .catch(() => {
        // Keeps fallback divisions
      });

    return () => {
      mounted = false;
    };
  }, [selectedDivisionId]);

  // Load Districts when Division changes
  useEffect(() => {
    let mounted = true;
    api
      .get<GeoItem[]>("/api/v1/geo/districts", { division_id: selectedDivisionId })
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setDistricts(data);
          setSelectedDistrictId(data[0].id);
        } else if (mounted) {
          const fallback = FALLBACK_DISTRICTS[selectedDivisionId] || [
            { id: "dist-central", name_en: "District Headquarters" },
          ];
          setDistricts(fallback);
          setSelectedDistrictId(fallback[0].id);
        }
      })
      .catch(() => {
        const fallback = FALLBACK_DISTRICTS[selectedDivisionId] || [
          { id: "dist-central", name_en: "District Headquarters" },
        ];
        setDistricts(fallback);
        setSelectedDistrictId(fallback[0].id);
      });

    return () => {
      mounted = false;
    };
  }, [selectedDivisionId]);

  // Load Thanas when District changes
  useEffect(() => {
    let mounted = true;
    api
      .get<GeoItem[]>("/api/v1/geo/thanas", { district_id: selectedDistrictId })
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setThanas(data);
          setSelectedThanaId(data[0].id);
        } else if (mounted) {
          const fallback = FALLBACK_THANAS[selectedDistrictId] || [
            { id: "thana-sadar", name_en: "Sadar / Central Police Station Area" },
          ];
          setThanas(fallback);
          setSelectedThanaId(fallback[0].id);
        }
      })
      .catch(() => {
        const fallback = FALLBACK_THANAS[selectedDistrictId] || [
          { id: "thana-sadar", name_en: "Sadar / Central Police Station Area" },
        ];
        setThanas(fallback);
        setSelectedThanaId(fallback[0].id);
      });

    return () => {
      mounted = false;
    };
  }, [selectedDistrictId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPickupCounter) {
      if (!recipientName.trim()) {
        toast({ title: "Name Required", description: "Please enter the recipient full name.", variant: "destructive" });
        return;
      }
      if (!recipientPhone.trim()) {
        toast({ title: "Phone Required", description: "Please enter the delivery contact phone.", variant: "destructive" });
        return;
      }
      if (!streetAddress.trim()) {
        toast({ title: "Address Required", description: "Please provide street / house / building details.", variant: "destructive" });
        return;
      }
    }

    // Corporate BIN validation if requested
    if (isCorporateRequested) {
      const cleanBin = binNumber.replace(/\D/g, "");
      if (cleanBin.length !== 11) {
        toast({
          title: "Invalid Corporate BIN",
          description: "Bangladesh Business Identification Number (BIN) must be exactly 11 digits.",
          variant: "destructive",
        });
        return;
      }
      if (!companyName.trim()) {
        toast({ title: "Company Name Required", description: "Please enter legal company name for Mushak 6.3 invoice.", variant: "destructive" });
        return;
      }
    }

    const divisionObj = divisions.find((d) => d.id === selectedDivisionId);
    const districtObj = districts.find((d) => d.id === selectedDistrictId);
    const thanaObj = thanas.find((t) => t.id === selectedThanaId);

    onComplete({
      address: {
        recipientName: isPickupCounter ? "Showroom Walk-in" : recipientName,
        phone: recipientPhone || customerPhone,
        alternatePhone: alternatePhone || undefined,
        divisionId: selectedDivisionId,
        divisionName: divisionObj?.name_en || "Dhaka",
        districtId: selectedDistrictId,
        districtName: districtObj?.name_en || "Dhaka City",
        thanaId: selectedThanaId,
        thanaName: thanaObj?.name_en || "Kotwali",
        streetAddress: isPickupCounter ? "Counter #42, Nawabpur Complex, 224 Nawabpur Road" : streetAddress,
        landmark: isPickupCounter ? "Nawabpur Showroom Pickup Counter" : landmark || undefined,
        isPickupCounter,
      },
      corporate: {
        isCorporateRequested,
        companyName: isCorporateRequested ? companyName : "",
        binNumber: isCorporateRequested ? binNumber.replace(/\D/g, "") : "",
      },
    });
  };

  return (
    <div
      style={{
        maxWidth: "680px",
        margin: "0 auto",
        padding: "24px",
        borderRadius: "16px",
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc", margin: 0 }}>
          Step 2: Shipping & Delivery Method
        </h2>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: "6px 0 0 0" }}>
          Choose door-to-door courier dispatch or free same-day pickup at Nawabpur Complex.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Delivery Mode Toggle: Courier Delivery vs Showroom Pickup */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div
            onClick={() => setIsPickupCounter(false)}
            style={{
              padding: "14px",
              borderRadius: "10px",
              cursor: "pointer",
              border: !isPickupCounter ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: !isPickupCounter ? "rgba(59, 130, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "14px", color: "#f8fafc" }}>
              <span>🚚</span>
              <span>Courier Delivery</span>
            </div>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              Inside Dhaka 24h (৳60) / Nationwide (৳120)
            </span>
          </div>

          <div
            onClick={() => setIsPickupCounter(true)}
            style={{
              padding: "14px",
              borderRadius: "10px",
              cursor: "pointer",
              border: isPickupCounter ? "2px solid #10b981" : "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: isPickupCounter ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "14px", color: "#f8fafc" }}>
              <span>🏬</span>
              <span>Free Showroom Pickup</span>
            </div>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              Counter #42, Nawabpur Rd (Free PIN handover)
            </span>
          </div>
        </div>

        {/* Address Fields (Hidden if Showroom Pickup) */}
        {!isPickupCounter ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Recipient Name and Phone */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px", fontWeight: 600 }}>
                  Recipient Name *
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Tanvir Rahman"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px", fontWeight: 600 }}>
                  Delivery Contact Phone *
                </label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Geographical Cascade: Division -> District -> Thana */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              {/* Division */}
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                  Division
                </label>
                <select
                  value={selectedDivisionId}
                  onChange={(e) => setSelectedDivisionId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {divisions.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                  District
                </label>
                <select
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {districts.map((dist) => (
                    <option key={dist.id} value={dist.id}>
                      {dist.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Thana */}
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                  Thana / Area
                </label>
                <select
                  value={selectedThanaId}
                  onChange={(e) => setSelectedThanaId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {thanas.map((th) => (
                    <option key={th.id} value={th.id}>
                      {th.name_en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Street Address Details */}
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px", fontWeight: 600 }}>
                Street Address, House / Flat / Road *
              </label>
              <textarea
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="e.g. House 42, Road 11, Block D, Banani"
                rows={2}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  backgroundColor: "#0d131f",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f8fafc",
                  fontSize: "13px",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Landmark & Alternate Contact */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                  Nearby Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near City Bank ATM"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                  Alternate Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "18px",
              borderRadius: "10px",
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#10b981", fontWeight: 700 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Nawabpur Complex Pickup Details</span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6 }}>
              Upon order confirmation, you will receive a secure 6-digit pickup PIN via SMS.
              Show this PIN at <strong>Counter #42, Nawabpur Complex, 224 Nawabpur Road, Dhaka</strong> (Open 10:00 AM – 8:00 PM).
            </p>
            <div style={{ fontSize: "12px", color: "#10b981", fontWeight: 600 }}>
              ✓ 100% Free • Bench Inspection Prior to Handover
            </div>
          </div>
        )}

        {/* Corporate / B2B VAT Mushak 6.3 Tax Invoice Toggle */}
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isCorporateRequested}
              onChange={(e) => setIsCorporateRequested(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "#3b82f6", cursor: "pointer" }}
            />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#f8fafc" }}>
              I need a Corporate VAT / Mushak 6.3 Tax Invoice (NBR Compliant)
            </span>
          </label>

          {isCorporateRequested && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                  Registered Company Legal Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Tech BD Ltd."
                  required={isCorporateRequested}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                  11-Digit Business Identification Number (BIN) *
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={binNumber}
                  onChange={(e) => setBinNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="XXXXXXXXXXX"
                  required={isCorporateRequested}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#0d131f",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: "10px", color: "#64748b", marginTop: "3px", display: "block" }}>
                  {binNumber.length}/11 digits entered
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Buttons Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              background: "none",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#cbd5e1",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back to Step 1
          </button>

          <button
            type="submit"
            style={{
              padding: "14px 28px",
              borderRadius: "10px",
              backgroundColor: "#3b82f6",
              color: "#ffffff",
              border: "none",
              fontSize: "14px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Continue to Order Review →
          </button>
        </div>
      </form>
    </div>
  );
}
