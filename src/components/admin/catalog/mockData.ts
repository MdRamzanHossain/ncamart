import type { AdminCatalogProduct } from "./types";

export const MOCK_CATALOG_PRODUCTS: AdminCatalogProduct[] = [
  {
    id: "PROD-001",
    title: "Anker 735 GaNPrime 65W Fast Charger (3-Port)",
    slug: "anker-735-ganprime-65w",
    skuCode: "ANK-735-65W",
    tier: "AUTHENTIC",
    status: "ACTIVE",
    category: "Chargers & Adapters",
    brand: "Anker",
    retailPricePaisa: 485000, // ৳4,850.00
    wholesaleBaselineCostPaisa: 380000, // ৳3,800.00
    maxAllowedSpotPricePaisa: 410000,
    stockCount: 42,
    primaryImage: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
    galleryImages: [],
    distributorName: "Anker Bangladesh Official Distributor",
    specs: { Wattage: "65W", Ports: "2x USB-C + 1x USB-A" },
    updatedAt: "2026-10-27 14:20",
  },
  {
    id: "PROD-002",
    title: "MINIWARE TS101 65W Smart Soldering Iron (OLED)",
    slug: "miniware-ts101-soldering-iron",
    skuCode: "MNW-TS101",
    tier: "AUTHENTIC",
    status: "ACTIVE",
    category: "Precision Soldering Tools",
    brand: "MINIWARE",
    retailPricePaisa: 720000, // ৳7,200.00
    wholesaleBaselineCostPaisa: 580000, // ৳5,800.00
    maxAllowedSpotPricePaisa: 620000,
    stockCount: 16,
    primaryImage: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80",
    galleryImages: [],
    distributorName: "e-Gizmo Hardware Imports",
    specs: { "Temp Range": "50°C-400°C", "Input Voltage": "DC 9V-24V / PD 65W" },
    updatedAt: "2026-10-26 11:45",
  },
  {
    id: "PROD-003",
    title: "Baseus Tungsten Gold 240W Type-C Braided Cable (2m)",
    slug: "baseus-tungsten-gold-240w-cable",
    skuCode: "BAS-240W-CBL",
    tier: "BUDGET_SMART",
    status: "ACTIVE",
    category: "Cables & Interconnects",
    brand: "Baseus",
    retailPricePaisa: 125000, // ৳1,250.00
    wholesaleBaselineCostPaisa: 85000, // ৳850.00
    maxAllowedSpotPricePaisa: 95000,
    stockCount: 88,
    primaryImage: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
    galleryImages: [],
    specs: { Wattage: "240W EPR", Length: "2.0 Meters" },
    updatedAt: "2026-10-27 09:15",
  },
  {
    id: "PROD-004",
    title: "Kailh Box White Mechanical Keyboard Switches (70 Pcs)",
    slug: "kailh-box-white-switches",
    skuCode: "KLH-BX-WHT-70",
    tier: "BUDGET_SMART",
    status: "REVIEW_REQUIRED",
    category: "Components & Switches",
    brand: "Kailh OEM",
    retailPricePaisa: 280000, // ৳2,800.00
    wholesaleBaselineCostPaisa: 210000, // ৳2,100.00
    maxAllowedSpotPricePaisa: 235000,
    stockCount: 25,
    primaryImage: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=400&q=80",
    galleryImages: [],
    specs: { Type: "Clicky", "Actuation Force": "50g" },
    updatedAt: "2026-10-27 16:30",
  },
  {
    id: "PROD-005",
    title: "Ugreen Nexode 140W GaN 4-Port Fast Desktop Charger",
    slug: "ugreen-nexode-140w-gan",
    skuCode: "UGR-NEX-140W",
    tier: "AUTHENTIC",
    status: "DRAFT",
    category: "Chargers & Adapters",
    brand: "Ugreen",
    retailPricePaisa: 980000, // ৳9,800.00
    wholesaleBaselineCostPaisa: 790000, // ৳7,900.00
    maxAllowedSpotPricePaisa: 840000,
    stockCount: 0,
    primaryImage: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80",
    galleryImages: [],
    specs: { Wattage: "140W PD 3.1", Ports: "3x USB-C + 1x USB-A" },
    updatedAt: "2026-10-27 17:10",
  },
];
