export type AdminRole =
  | "SUPER_ADMIN"
  | "OPS_MANAGER"
  | "SOURCING_MANAGER"
  | "GODOWN_MANAGER"
  | "QC_TECHNICIAN"
  | "FIELD_RUNNER"
  | "SHOWROOM_POS_STAFF"
  | "CATALOG_MANAGER"
  | "CUSTOMER_SUPPORT"
  | "FINANCE_OFFICER"
  | "DISPATCH_STAFF";

export interface StaffAdminProfile {
  id: string;
  name: string;
  email: string;
  roles: AdminRole[];
  activeRole: AdminRole;
  avatar?: string;
  assignedLocation: string; // e.g. "Nawabpur Central Godown"
}

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
  badgeVariant?: "primary" | "warning" | "destructive" | "success";
  allowedRoles: AdminRole[];
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

export interface AdminKpiStats {
  grossMerchandisePaisa: number;
  grossRevenueGrowthPercent: number;
  dailyDropAndPackOrders: number;
  dailyOrdersGrowthPercent: number;
  activePreOrdersCount: number;
  activePreOrderQuotaPaisa: number;
  rtoRateBasisPoints: number; // 1% = 100 bp (e.g. 240 bp = 2.40%)
  openRmaClaimsCount: number;
  unresolvedRmaAlerts: number;
}

export interface RevenueChartPoint {
  date: string;
  revenuePaisa: number;
  orderVolume: number;
  label: string;
}

export interface LiveActivityEvent {
  id: string;
  timestamp: string;
  type: "ORDER_PLACED" | "RUNNER_PURCHASED" | "QC_PASSED" | "SEAL_VERIFIED" | "RMA_FILED";
  title: string;
  subtitle: string;
  amountPaisa?: number;
  badge: string;
  badgeColor: string;
}
