import React from "react";
import type { Metadata } from "next";
import { AddressBookView } from "@/components/account/AddressBookView";
import type { CustomerAddress } from "@/components/account/types";

export const metadata: Metadata = {
  title: "Delivery Addresses | NCAMart",
  description: "Manage your saved shipping addresses for home, office, and godown delivery across Bangladesh.",
};

const mockAddresses: CustomerAddress[] = [
  {
    id: "addr_01",
    label: "HOME",
    consigneeName: "Engr. Tanvir Ahmed",
    contactPhone: "+880 1712-345678",
    divisionId: "Dhaka",
    districtId: "dist_dhaka",
    districtName: "Dhaka",
    thanaId: "thana_dhanmondi",
    thanaName: "Dhanmondi",
    addressLine: "House #14, Road #5, Flat 4B, Dhanmondi R/A",
    isDefault: true,
  },
  {
    id: "addr_02",
    label: "OFFICE",
    consigneeName: "Tanvir Ahmed (Robotics Lab)",
    contactPhone: "+880 1819-987654",
    divisionId: "Dhaka",
    districtId: "dist_dhaka",
    districtName: "Dhaka",
    thanaId: "thana_motijheel",
    thanaName: "Motijheel",
    addressLine: "Level 6, Tech Innovation Tower, Motijheel Commercial Area",
    isDefault: false,
  },
  {
    id: "addr_03",
    label: "OTHER",
    consigneeName: "Tanvir Ahmed",
    contactPhone: "+880 1712-345678",
    divisionId: "Dhaka",
    districtId: "dist_dhaka",
    districtName: "Dhaka",
    thanaId: "thana_nawabpur",
    thanaName: "Kotwali (Nawabpur)",
    addressLine: "Shop #21, Nawabpur Complex, Sundarban Square Market",
    isDefault: false,
  },
];

export default function SavedAddressesPage() {
  return <AddressBookView initialAddresses={mockAddresses} />;
}
