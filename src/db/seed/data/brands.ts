export interface SeedBrandDefinition {
  name: string;
  slug: string;
  isAuthorizedDistribution: boolean;
  officialDistributorName: string | null;
}

export const SEED_BRANDS: SeedBrandDefinition[] = [
  {
    name: "UGREEN",
    slug: "ugreen",
    isAuthorizedDistribution: true,
    officialDistributorName: "Star Tech & Engineering Ltd",
  },
  {
    name: "Baseus",
    slug: "baseus",
    isAuthorizedDistribution: true,
    officialDistributorName: "Ryans Computers Ltd",
  },
  {
    name: "Anker",
    slug: "anker",
    isAuthorizedDistribution: true,
    officialDistributorName: "Excel Technologies Ltd",
  },
  {
    name: "Aqara",
    slug: "aqara",
    isAuthorizedDistribution: true,
    officialDistributorName: "Smart Solution BD",
  },
  {
    name: "UNI-T",
    slug: "uni-t",
    isAuthorizedDistribution: true,
    officialDistributorName: "Uni-Trend Bangladesh",
  },
  {
    name: "HIKMICRO",
    slug: "hikmicro",
    isAuthorizedDistribution: true,
    officialDistributorName: "Hikvision BD",
  },
  {
    name: "70mai",
    slug: "70mai",
    isAuthorizedDistribution: true,
    officialDistributorName: "70mai Bangladesh",
  },
  {
    name: "OEM Nawabpur",
    slug: "oem-nawabpur",
    isAuthorizedDistribution: false,
    officialDistributorName: null,
  },
];
