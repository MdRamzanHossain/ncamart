import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/lib/http/route";
import { BusinessError } from "@/lib/errors";
import { catalogService } from "@/modules/catalog";
import { inventoryService } from "@/modules/inventory";
import { sourcingService } from "@/modules/sourcing";
import { promotionsService } from "@/modules/promotions";
import { authService } from "@/modules/identity";
import { paymentsService } from "@/modules/payments";
import { ordersService } from "../service";
import { checkoutOrder, retryPayment } from "../checkout";
import { ordersRepo } from "../repo";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";

const staffActor: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

describe("P20 — Checkout (Regular Orders: COD Tiers, Advance Fee, Online, Pickup)", () => {
  let categoryId: string;
  let regularProduct: Awaited<ReturnType<typeof catalogService.createProduct>>;
  let regularSku: Awaited<ReturnType<typeof catalogService.createSku>>;
  let virtualProduct: Awaited<ReturnType<typeof catalogService.createProduct>>;
  let virtualSku: Awaited<ReturnType<typeof catalogService.createSku>>;

  const repeatCustomerActor: Actor = {
    id: "01920000-0000-7000-8000-000000000101",
    type: "customer",
  };

  const firstTimeCustomerActor: Actor = {
    id: "01920000-0000-7000-8000-000000000102",
    type: "customer",
  };

  const codBlockedCustomerActor: Actor = {
    id: "01920000-0000-7000-8000-000000000103",
    type: "customer",
  };

  beforeEach(async () => {
    catalogService.clearMemoryCatalogForTesting();
    inventoryService.clearMemoryForTesting();
    sourcingService.clearMemoryForTesting();
    promotionsService.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    authService.clearMemoryAuthForTesting();
    clearMemoryOutboxForTesting();
    paymentsService.simulateGatewayFailure(false);

    // 1. Create Category
    const category = await catalogService.createCategory({
      slug: "cables-and-chargers",
      nameEn: "Cables & Chargers",
      nameBn: "কেবল এবং চার্জার",
      level: 1,
    });
    categoryId = category.id;

    // 2. Regular Physical Product & SKU
    regularProduct = await catalogService.createProduct(
      {
        slug: "ugreen-100w-cable",
        titleEn: "UGREEN 100W USB-C Cable",
        titleBn: "ইউগ্রিন ১০০ ওয়াট কেবল",
        categoryId,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 750,
      },
      staffActor
    );
    regularSku = await catalogService.createSku(
      {
        productId: regularProduct.id,
        skuCode: "UGR-100W-CBL",
        pricePaisa: 100000, // ৳1,000
        baseCostPaisa: 70000,
        weightGrams: 100,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 365,
      },
      staffActor
    );
    catalogService.setProductStatusForTesting(regularProduct.id, "PUBLISHED");

    // 3. Virtual Sourcing Product & SKU (0 physical stock, virtual supplier active)
    virtualProduct = await catalogService.createProduct(
      {
        slug: "anker-mag-charger",
        titleEn: "Anker MagSafe Charger",
        titleBn: "অ্যাঙ্কার ম্যাগসেফ চার্জার",
        categoryId,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 750,
      },
      staffActor
    );
    virtualSku = await catalogService.createSku(
      {
        productId: virtualProduct.id,
        skuCode: "ANK-MAG-WHT",
        pricePaisa: 350000, // ৳3,500
        baseCostPaisa: 250000,
        weightGrams: 200,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 365,
      },
      staffActor
    );
    catalogService.setProductStatusForTesting(virtualProduct.id, "PUBLISHED");

    const virtualSupplier = await sourcingService.createSupplier(
      {
        name: "Virtual Supplier Ltd",
        proprietorName: "Ali",
        market: "NAWABPUR_COMPLEX",
        stallNo: "V1",
        floor: "1",
        phone: "+8801799999999",
        acceptedPaymentModes: ["CASH"],
      },
      staffActor
    );

    await sourcingService.updateSupplierStock(
      virtualSupplier.id,
      [
        {
          skuId: virtualSku.id,
          status: "AVAILABLE",
        },
      ],
      staffActor
    );

    type CustomerInput = Parameters<typeof authService.saveCustomer>[0];

    // 4. Seed Customers
    // Repeat Buyer: 2 delivered orders -> FULL_COD
    const repeatCustomer: CustomerInput = {
      id: repeatCustomerActor.id,
      phone: "+8801711111111",
      fullName: "Kamal Hasan",
      email: "kamal@example.com",
      emailVerified: true,
      preferredLocale: "en",
      marketingOptIn: false,
      status: "ACTIVE",
      deliveredOrderCount: 2,
      rtoCount12m: 0,
      codBlocked: false,
      codBlockReason: null,
      codBlockLiftedBy: null,
      marketingOptInAt: null,
      lastActiveAt: new Date(),
      previousCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await authService.saveCustomer(repeatCustomer);

    // First Time Buyer: 0 delivered orders -> ADVANCE_FEE_REQUIRED
    const firstTimeCustomer: CustomerInput = {
      id: firstTimeCustomerActor.id,
      phone: "+8801722222222",
      fullName: "Sadia Islam",
      email: "sadia@example.com",
      emailVerified: true,
      preferredLocale: "bn",
      marketingOptIn: false,
      status: "ACTIVE",
      deliveredOrderCount: 0,
      rtoCount12m: 0,
      codBlocked: false,
      codBlockReason: null,
      codBlockLiftedBy: null,
      marketingOptInAt: null,
      lastActiveAt: new Date(),
      previousCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await authService.saveCustomer(firstTimeCustomer);

    // COD Blocked Buyer: codBlocked: true -> COD_BLOCKED
    const codBlockedCustomer: CustomerInput = {
      id: codBlockedCustomerActor.id,
      phone: "+8801733333333",
      fullName: "Bad Buyer",
      email: "bad@example.com",
      emailVerified: true,
      preferredLocale: "en",
      marketingOptIn: false,
      status: "ACTIVE",
      deliveredOrderCount: 0,
      rtoCount12m: 3,
      codBlocked: true,
      codBlockReason: "EXCESSIVE_RTO",
      codBlockLiftedBy: null,
      marketingOptInAt: null,
      lastActiveAt: new Date(),
      previousCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await authService.saveCustomer(codBlockedCustomer);
  });

  it("1. FULL_COD path: repeat customer with 100% COD gets CONFIRMED status immediately", async () => {
    // Receive 10 units in GODOWN_NAWABPUR
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 10,
        unitCostPaisa: 70000,
        refId: "PO-TEST-1",
      },
      staffActor
    );

    const res = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: regularSku.id, quantity: 1 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Kamal Hasan",
          phone: "+8801711111111",
          district_id: "1", // Dhaka
          thana_id: "102", // Dhanmondi (Inside Dhaka)
          address_line: "Road 7/A, Dhanmondi",
        },
        payment_mode: "COD",
      },
      repeatCustomerActor
    );

    expect(res.order_number).toMatch(/^ORD-\d{4}-\d{5}$/);
    expect(res.status).toBe("CONFIRMED");
    if ("payment_status" in res) {
      expect(res.payment_status).toBe("UNPAID");
      // Product ৳1,000 + inside Dhaka delivery ৳80 = ৳1,080 (108000 paisa)
      expect(res.cod_amount_collectible_paisa).toBe(108000);
      expect(res.estimated_delivery).toBeDefined();
    }

    // Verify stock reservation was committed
    const balances = await inventoryService.getSellableBalancesForSkus([regularSku.id]);
    expect(balances[0]?.sellableOnHand).toBe(9); // decremented on commit
    expect(balances[0]?.sellableReserved).toBe(0);

    // Verify order.confirmed event emitted in outbox
    const outbox = getMemoryOutbox();
    const confirmedEvent = outbox.find((m) => m.type === "order.confirmed");
    expect(confirmedEvent).toBeDefined();
  });

  it("2a. First-time buyer inside Dhaka pays advance fee of exactly ৳80 online", async () => {
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 10,
        unitCostPaisa: 70000,
        refId: "PO-TEST-2",
      },
      staffActor
    );

    const res = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: regularSku.id, quantity: 1 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Sadia Islam",
          phone: "+8801722222222",
          district_id: "1", // Dhaka
          thana_id: "102", // Dhanmondi (Inside Dhaka)
          address_line: "House 12, Dhanmondi",
        },
        payment_mode: "COD",
      },
      firstTimeCustomerActor
    );

    expect(res.status).toBe("PENDING_PAYMENT");
    if ("payment_redirect_url" in res) {
      // Exactly ৳80 (8000 paisa) advance delivery fee inside Dhaka
      expect(res.payable_paisa).toBe(8000);
      expect(res.payment_redirect_url).toContain("sslcommerz.com");
      expect(res.tran_id).toMatch(/TXN-\d{8}-/);

      // Verify payment_transactions record created in DB with purpose ADVANCE_FEE
      const order = await ordersRepo.getOrderByNumberWithDetails(undefined, res.order_number);
      expect(order?.advanceRequiredPaisa).toBe(8000);
      expect(order?.codAmountPaisa).toBe(100000); // Product price via COD
      const txn = order?.transactions?.find((t) => t.tranId === res.tran_id);
      expect(txn).toBeDefined();
      expect(txn?.purpose).toBe("ADVANCE_FEE");
      expect(txn?.amountPaisa).toBe(8000);
      expect(txn?.status).toBe("PENDING");
    }
  });

  it("2b. First-time buyer outside Dhaka pays advance fee of exactly ৳150 online", async () => {
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 10,
        unitCostPaisa: 70000,
        refId: "PO-TEST-3",
      },
      staffActor
    );

    const res = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: regularSku.id, quantity: 1 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Sadia Islam",
          phone: "+8801722222222",
          district_id: "14", // Chattogram
          thana_id: "201", // Kotwali (Outside Dhaka)
          address_line: "GEC Circle, Chattogram",
        },
        payment_mode: "COD",
      },
      firstTimeCustomerActor
    );

    expect(res.status).toBe("PENDING_PAYMENT");
    if ("payment_redirect_url" in res) {
      // Exactly ৳150 (15000 paisa) advance delivery fee outside Dhaka
      expect(res.payable_paisa).toBe(15000);
      expect(res.tran_id).toMatch(/TXN-\d{8}-/);

      const order = await ordersRepo.getOrderByNumberWithDetails(undefined, res.order_number);
      expect(order?.advanceRequiredPaisa).toBe(15000);
      expect(order?.codAmountPaisa).toBe(100000); // Product price via COD
      const txn = order?.transactions?.find((t) => t.tranId === res.tran_id);
      expect(txn?.purpose).toBe("ADVANCE_FEE");
      expect(txn?.amountPaisa).toBe(15000);
    }
  });

  it("3. COD blocked customer returns 422 ERR_COD_NOT_ALLOWED", async () => {
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 10,
        unitCostPaisa: 70000,
        refId: "PO-TEST-4",
      },
      staffActor
    );

    await expect(
      checkoutOrder(
        {
          order_type: "REGULAR_DROP_PACK",
          items: [{ sku_id: regularSku.id, quantity: 1 }],
          fulfillment_channel: "COURIER",
          shipping_address: {
            consignee_name: "Bad Buyer",
            phone: "+8801733333333",
            district_id: "1",
            thana_id: "102",
            address_line: "Dhanmondi, Dhaka",
          },
          payment_mode: "COD",
        },
        codBlockedCustomerActor
      )
    ).rejects.toThrow(
      expect.objectContaining({
        code: "ERR_COD_NOT_ALLOWED",
      })
    );
  });

  it("4. Store credit cannot cover the advance fee", async () => {
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 10,
        unitCostPaisa: 70000,
        refId: "PO-TEST-5",
      },
      staffActor
    );

    // Issue ৳500 (50000 paisa) store credit to first-time buyer
    await promotionsService.issueStoreCredit(undefined, {
      customerId: firstTimeCustomerActor.id,
      amountPaisa: 50000,
      reason: "REFUND_AS_CREDIT",
      withdrawable: true,
      actor: staffActor,
    });

    const res = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: regularSku.id, quantity: 1 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Sadia Islam",
          phone: "+8801722222222",
          district_id: "1",
          thana_id: "102",
          address_line: "Dhanmondi, Dhaka",
        },
        payment_mode: "COD",
        store_credit_paisa: 50000,
      },
      firstTimeCustomerActor
    );

    expect(res.status).toBe("PENDING_PAYMENT");
    if ("payable_paisa" in res) {
      // Advance fee remains exactly ৳80 (8000 paisa). Store credit only reduces product payable!
      expect(res.payable_paisa).toBe(8000);

      const order = await ordersRepo.getOrderByNumberWithDetails(undefined, res.order_number);
      expect(order?.storeCreditAppliedPaisa).toBe(50000);
      expect(order?.advanceRequiredPaisa).toBe(8000);
      expect(order?.codAmountPaisa).toBe(50000); // ৳1,000 product - ৳500 credit = ৳500 COD
    }
  });

  it("5. Idempotent replay returns the same order without creating duplicates", async () => {
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 10,
        unitCostPaisa: 70000,
        refId: "PO-TEST-6",
      },
      staffActor
    );

    const payload = {
      order_type: "REGULAR_DROP_PACK" as const,
      items: [{ sku_id: regularSku.id, quantity: 1 }],
      fulfillment_channel: "COURIER" as const,
      shipping_address: {
        consignee_name: "Kamal Hasan",
        phone: "+8801711111111",
        district_id: "1",
        thana_id: "102",
        address_line: "Dhanmondi, Dhaka",
      },
      payment_mode: "COD" as const,
    };

    const firstRes = await checkoutOrder(payload, repeatCustomerActor, "idem_order_key_101");
    expect(firstRes.status).toBe("CONFIRMED");

    // Second call with same customer, payload, and parameters succeeds identically
    const secondRes = await checkoutOrder(payload, repeatCustomerActor, "idem_order_key_101");
    expect(secondRes.status).toBe("CONFIRMED");
    expect(secondRes.order_number).toBe(firstRes.order_number);
  });

  it("6. Parallel checkouts for the last physical unit: exactly one wins and the second fails with 409", async () => {
    // Only 1 unit in stock
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 1,
        unitCostPaisa: 70000,
        refId: "PO-TEST-7",
      },
      staffActor
    );

    const payload1 = {
      order_type: "REGULAR_DROP_PACK" as const,
      items: [{ sku_id: regularSku.id, quantity: 1 }],
      fulfillment_channel: "COURIER" as const,
      shipping_address: {
        consignee_name: "Kamal Hasan",
        phone: "+8801711111111",
        district_id: "1",
        thana_id: "102",
        address_line: "Dhanmondi, Dhaka",
      },
      payment_mode: "COD" as const,
    };

    const payload2 = {
      order_type: "REGULAR_DROP_PACK" as const,
      items: [{ sku_id: regularSku.id, quantity: 1 }],
      fulfillment_channel: "COURIER" as const,
      shipping_address: {
        consignee_name: "Sadia Islam",
        phone: "+8801722222222",
        district_id: "1",
        thana_id: "102",
        address_line: "Dhanmondi, Dhaka",
      },
      payment_mode: "COD" as const,
    };

    const results = await Promise.allSettled([
      checkoutOrder(payload1, repeatCustomerActor),
      checkoutOrder(payload2, firstTimeCustomerActor),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const error = (rejected[0] as PromiseRejectedResult).reason as BusinessError;
    expect(error.code).toBe("ERR_INSUFFICIENT_STOCK");
    expect(error.status).toBe(409);
  });

  it("7. Virtual-line orders go to SOURCING and emit sourcing.tasks_needed", async () => {
    // virtualSku has 0 physical stock, but isVirtuallyAvailable is true
    const res = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: virtualSku.id, quantity: 2 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Kamal Hasan",
          phone: "+8801711111111",
          district_id: "1",
          thana_id: "102",
          address_line: "Road 15, Dhanmondi",
        },
        payment_mode: "COD",
      },
      repeatCustomerActor
    );

    expect(res.status).toBe("SOURCING");

    // Verify order in database is in SOURCING status
    const order = await ordersRepo.getOrderByNumberWithDetails(undefined, res.order_number);
    expect(order?.status).toBe("SOURCING");
    expect(order?.items[0]?.source).toBe("VIRTUAL");

    // Verify sourcing.tasks_needed event emitted
    const outbox = getMemoryOutbox();
    const sourcingEvent = outbox.find((m) => m.type === "sourcing.tasks_needed");
    expect(sourcingEvent).toBeDefined();
    expect(sourcingEvent?.payload).toMatchObject({
      orderId: order?.id,
      orderNumber: order?.orderNumber,
    });
  });

  it("8. Gateway failure returns 502 ERR_GATEWAY_UNAVAILABLE and retryPayment endpoint re-initiates session", async () => {
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 5,
        unitCostPaisa: 70000,
        refId: "PO-TEST-8",
      },
      staffActor
    );

    // Simulate gateway failure
    paymentsService.simulateGatewayFailure(true);

    let failedError: BusinessError | null = null;
    try {
      await checkoutOrder(
        {
          order_type: "REGULAR_DROP_PACK",
          items: [{ sku_id: regularSku.id, quantity: 1 }],
          fulfillment_channel: "COURIER",
          shipping_address: {
            consignee_name: "Sadia Islam",
            phone: "+8801722222222",
            district_id: "1",
            thana_id: "102",
            address_line: "Dhanmondi, Dhaka",
          },
          payment_mode: "ONLINE_FULL",
        },
        firstTimeCustomerActor
      );
    } catch (err) {
      failedError = err as BusinessError;
    }

    expect(failedError).toBeDefined();
    expect(failedError?.code).toBe("ERR_GATEWAY_UNAVAILABLE");
    expect(failedError?.status).toBe(502);

    const orderNumber = (failedError?.details as Record<string, string>)?.orderNumber;
    expect(orderNumber).toBeDefined();
    if (!orderNumber) throw new Error("Expected orderNumber");

    // Verify order is still saved in DB as PENDING_PAYMENT
    const order = await ordersRepo.getOrderByNumberWithDetails(undefined, orderNumber);
    expect(order?.status).toBe("PENDING_PAYMENT");

    // Now restore gateway and call retryPayment endpoint
    paymentsService.simulateGatewayFailure(false);
    const retryRes = await retryPayment(orderNumber, firstTimeCustomerActor);

    expect(retryRes.order_number).toBe(orderNumber);
    expect(retryRes.status).toBe("PENDING_PAYMENT");
    expect(retryRes.payment_redirect_url).toContain("sslcommerz.com");
    expect(retryRes.payable_paisa).toBe(108000); // ৳1,000 product + ৳80 delivery
  });
});
