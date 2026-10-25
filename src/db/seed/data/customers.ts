export interface SeedCustomerDefinition {
  phone: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
  status: "ACTIVE" | "FROZEN";
  deliveredOrderCount: number;
  rtoCount12m: number;
  codBlocked: boolean;
  codBlockReason?: string;
  lastActiveAt?: Date;
  address: {
    consigneeName: string;
    contactPhone: string;
    divisionId: string;
    districtId: string;
    thanaId: string;
    addressLine: string;
    label: "HOME" | "OFFICE";
  };
}

export const SEED_CUSTOMERS: SeedCustomerDefinition[] = [
  {
    phone: "+8801711000001",
    fullName: "Tanvir Ahmed",
    email: "tanvir.first@example.com",
    emailVerified: true,
    status: "ACTIVE",
    deliveredOrderCount: 0,
    rtoCount12m: 0,
    codBlocked: false,
    lastActiveAt: new Date(),
    address: {
      consigneeName: "Tanvir Ahmed",
      contactPhone: "+8801711000001",
      divisionId: "dhaka",
      districtId: "dhaka",
      thanaId: "dhanmondi",
      addressLine: "House 24, Road 7A, Dhanmondi, Dhaka-1209",
      label: "HOME",
    },
  },
  {
    phone: "+8801811000002",
    fullName: "Rahim Chowdhury",
    email: "rahim.repeat@example.com",
    emailVerified: true,
    status: "ACTIVE",
    deliveredOrderCount: 5,
    rtoCount12m: 0,
    codBlocked: false,
    lastActiveAt: new Date(),
    address: {
      consigneeName: "Rahim Chowdhury",
      contactPhone: "+8801811000002",
      divisionId: "dhaka",
      districtId: "dhaka",
      thanaId: "gulshan",
      addressLine: "Apt 5B, Road 45, Gulshan-2, Dhaka-1212",
      label: "OFFICE",
    },
  },
  {
    phone: "+8801911000003",
    fullName: "Kamrul Hasan",
    email: "kamrul.blocked@example.com",
    emailVerified: false,
    status: "ACTIVE",
    deliveredOrderCount: 1,
    rtoCount12m: 2,
    codBlocked: true,
    codBlockReason: "AUTO_RTO",
    lastActiveAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
    address: {
      consigneeName: "Kamrul Hasan",
      contactPhone: "+8801911000003",
      divisionId: "chittagong",
      districtId: "chittagong",
      thanaId: "kotwali_ctg",
      addressLine: "Shop 12, Jubilee Road, Chattogram",
      label: "OFFICE",
    },
  },
  {
    phone: "+8801611000004",
    fullName: "Shahidul Islam",
    email: "shahidul.dormant@example.com",
    emailVerified: true,
    status: "ACTIVE",
    deliveredOrderCount: 2,
    rtoCount12m: 0,
    codBlocked: false,
    // 13 months dormant (approx 396 days ago)
    lastActiveAt: new Date(Date.now() - 396 * 24 * 60 * 60 * 1000),
    address: {
      consigneeName: "Shahidul Islam",
      contactPhone: "+8801611000004",
      divisionId: "rajshahi",
      districtId: "rajshahi",
      thanaId: "boalia",
      addressLine: "Shaheb Bazar, Rajshahi-6000",
      label: "HOME",
    },
  },
];
