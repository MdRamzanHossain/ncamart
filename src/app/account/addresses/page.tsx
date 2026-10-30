"use client";

import React, { useState, useEffect } from "react";
import { AddressBookView } from "@/components/account/AddressBookView";
import type { CustomerAddress } from "@/components/account/types";

export default function SavedAddressesPage() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchAddresses() {
      try {
        const res = await fetch("/api/v1/customer/addresses");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.addresses)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: CustomerAddress[] = data.addresses.map((a: any) => ({
              id: a.id,
              label: a.label || "HOME",
              consigneeName: a.consignee_name || a.consigneeName || "Customer",
              contactPhone: a.contact_phone || a.contactPhone || "",
              divisionId: a.division_id || a.divisionId || "Dhaka",
              districtId: a.district_id || a.districtId || "dist_dhaka",
              districtName: a.district_name || a.districtName || "Dhaka",
              thanaId: a.thana_id || a.thanaId || "thana_dhaka",
              thanaName: a.thana_name || a.thanaName || "Dhaka",
              addressLine: a.address_line || a.street_address || a.addressLine || "",
              isDefault: Boolean(a.is_default || a.isDefault),
            }));
            setAddresses(mapped);
          }
        }
      } catch {
        // Safe empty fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchAddresses();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📍</div>
        <p>Loading your saved addresses from database...</p>
      </div>
    );
  }

  return <AddressBookView initialAddresses={addresses} />;
}
