import { StaffRole } from "@/modules/identity/permissions";

export interface SeedStaffDefinition {
  fullName: string;
  email: string;
  phone: string;
  roles: StaffRole[];
  password: string;
  totpSecret: string;
}

export const SEED_STAFF: SeedStaffDefinition[] = [
  {
    fullName: "Super Administrator",
    email: "admin@ncamart.com",
    phone: "+8801811000000",
    roles: ["SUPER_ADMIN"],
    password: "DevPassword@2026!",
    totpSecret: "JBSWY3DPEHPK3PXP",
  },
  {
    fullName: "Customer Support Lead",
    email: "support@ncamart.com",
    phone: "+8801811000001",
    roles: ["CUSTOMER_SUPPORT"],
    password: "DevPassword@2026!",
    totpSecret: "KRSXG5CTMVRXEZLU",
  },
  {
    fullName: "Catalog Manager",
    email: "catalog@ncamart.com",
    phone: "+8801811000002",
    roles: ["CATALOG_MANAGER"],
    password: "DevPassword@2026!",
    totpSecret: "MFRGGZDFMZTWQ2LK",
  },
  {
    fullName: "Sourcing Manager",
    email: "sourcing@ncamart.com",
    phone: "+8801811000003",
    roles: ["SOURCING_MANAGER"],
    password: "DevPassword@2026!",
    totpSecret: "NBSWY3DPEHPK3PXP",
  },
  {
    fullName: "Godown Manager",
    email: "godown@ncamart.com",
    phone: "+8801811000004",
    roles: ["GODOWN_MANAGER"],
    password: "DevPassword@2026!",
    totpSecret: "OBSWY3DPEHPK3PXP",
  },
  {
    fullName: "QC Lead Technician",
    email: "qc@ncamart.com",
    phone: "+8801811000005",
    roles: ["QC_TECHNICIAN"],
    password: "DevPassword@2026!",
    totpSecret: "PBSWY3DPEHPK3PXP",
  },
  {
    fullName: "Dispatch Logistics Officer",
    email: "dispatch@ncamart.com",
    phone: "+8801811000006",
    roles: ["DISPATCH_STAFF"],
    password: "DevPassword@2026!",
    totpSecret: "QBSWY3DPEHPK3PXP",
  },
  {
    fullName: "Showroom POS Cashier",
    email: "pos@ncamart.com",
    phone: "+8801811000007",
    roles: ["SHOWROOM_POS_STAFF"],
    password: "DevPassword@2026!",
    totpSecret: "RBSWY3DPEHPK3PXP",
  },
  {
    fullName: "Nawabpur Field Runner",
    email: "runner@ncamart.com",
    phone: "+8801811000008",
    roles: ["FIELD_RUNNER"],
    password: "DevPassword@2026!",
    totpSecret: "SBSWY3DPEHPK3PXP",
  },
  {
    fullName: "Senior Finance Officer",
    email: "finance@ncamart.com",
    phone: "+8801811000009",
    roles: ["FINANCE_OFFICER"],
    password: "DevPassword@2026!",
    totpSecret: "TBSWY3DPEHPK3PXP",
  },
];
