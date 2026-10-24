import { env } from "@/lib/env";
import { BusinessError } from "@/lib/errors";

export interface SslcommerzSessionRequest {
  total_amount: string; // e.g. "80.00"
  currency: string; // "BDT"
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  ipn_url: string;
  cus_name: string;
  cus_phone: string;
  cus_email?: string | null;
  cus_add1?: string | null;
  cus_city?: string | null;
  cus_country?: string | null;
  shipping_method?: string;
  product_name?: string;
  product_category?: string;
  product_profile: string; // "general"
}

export interface SslcommerzSessionResponse {
  status: "SUCCESS" | "FAILED";
  sessionkey: string;
  GatewayPageURL: string;
  failedreason?: string;
}

export interface SslcommerzValidationResponse {
  status: "VALID" | "VALIDATED" | "FAILED" | "CANCELLED" | "UNATTEMPTED";
  tran_id: string;
  val_id: string;
  amount: string;
  card_type: string;
  store_amount: string;
  bank_tran_id: string;
  card_issuer?: string;
  card_brand?: string;
  card_sub_brand?: string;
  card_issuer_country?: string;
  card_issuer_country_code?: string;
  currency_type?: string;
  currency_amount?: string;
  risk_level?: string | number; // "0" or "1"
  risk_title?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SslcommerzQueryResponse {
  status?: string;
  element?: SslcommerzValidationResponse[];
  tran_id?: string;
  val_id?: string;
  amount?: string;
  bank_tran_id?: string;
  card_type?: string;
  risk_level?: string | number;
  risk_title?: string;
  error?: string;
}

export interface SslcommerzRefundRequest {
  bank_tran_id: string;
  refund_amount: string; // e.g. "250.00"
  refund_remarks: string;
  re_fe_id: string; // Merchant refund reference
}

export interface SslcommerzRefundResponse {
  status: "success" | "failed";
  refund_ref_id?: string;
  errorReason?: string;
  APIConnect?: string;
}

export interface SslcommerzRefundQueryResponse {
  status: "success" | "failed";
  refund_ref_id: string;
  refund_status?: "PROCESSING" | "COMPLETED" | "FAILED" | "SUCCESS";
  errorReason?: string;
}

export interface SslcommerzClient {
  initSession(req: SslcommerzSessionRequest): Promise<SslcommerzSessionResponse>;
  validateOrder(valId: string): Promise<SslcommerzValidationResponse>;
  queryTransaction(tranId: string): Promise<SslcommerzQueryResponse>;
  initiateRefund(req: SslcommerzRefundRequest): Promise<SslcommerzRefundResponse>;
  queryRefund(refundRefId: string): Promise<SslcommerzRefundQueryResponse>;
}

/**
 * Real SSLCommerz HTTP Client.
 */
export class RealSslcommerzClient implements SslcommerzClient {
  private get baseUrl(): string {
    return env.SSLCOMMERZ_IS_SANDBOX
      ? "https://sandbox.sslcommerz.com"
      : "https://securepay.sslcommerz.com";
  }

  async initSession(req: SslcommerzSessionRequest): Promise<SslcommerzSessionResponse> {
    const params = new URLSearchParams();
    params.set("store_id", env.SSLCOMMERZ_STORE_ID);
    params.set("store_passwd", env.SSLCOMMERZ_STORE_PASS);
    params.set("total_amount", req.total_amount);
    params.set("currency", req.currency);
    params.set("tran_id", req.tran_id);
    params.set("success_url", req.success_url);
    params.set("fail_url", req.fail_url);
    params.set("cancel_url", req.cancel_url);
    params.set("ipn_url", req.ipn_url);
    params.set("cus_name", req.cus_name);
    params.set("cus_phone", req.cus_phone);
    if (req.cus_email) params.set("cus_email", req.cus_email);
    if (req.cus_add1) params.set("cus_add1", req.cus_add1);
    if (req.cus_city) params.set("cus_city", req.cus_city);
    params.set("cus_country", req.cus_country || "Bangladesh");
    params.set("shipping_method", req.shipping_method || "Courier");
    params.set("product_name", req.product_name || "Accessories");
    params.set("product_category", req.product_category || "Electronics");
    params.set("product_profile", req.product_profile || "general");

    const response = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new BusinessError(
        "ERR_GATEWAY_UNAVAILABLE",
        `SSLCommerz HTTP error: ${response.statusText}`,
        { status: response.status },
        502
      );
    }

    const data = (await response.json()) as SslcommerzSessionResponse;
    if (data.status !== "SUCCESS") {
      throw new BusinessError(
        "ERR_GATEWAY_UNAVAILABLE",
        data.failedreason || "Failed to initialize SSLCommerz payment session",
        { failedReason: data.failedreason, tranId: req.tran_id },
        502
      );
    }

    return data;
  }

  async validateOrder(valId: string): Promise<SslcommerzValidationResponse> {
    const url = `${this.baseUrl}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
      valId
    )}&store_id=${encodeURIComponent(env.SSLCOMMERZ_STORE_ID)}&store_passwd=${encodeURIComponent(
      env.SSLCOMMERZ_STORE_PASS
    )}&v=1&format=json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new BusinessError(
        "ERR_GATEWAY_UNAVAILABLE",
        `SSLCommerz validation error: ${response.statusText}`,
        { status: response.status },
        502
      );
    }

    return (await response.json()) as SslcommerzValidationResponse;
  }

  async queryTransaction(tranId: string): Promise<SslcommerzQueryResponse> {
    const url = `${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?tran_id=${encodeURIComponent(
      tranId
    )}&store_id=${encodeURIComponent(env.SSLCOMMERZ_STORE_ID)}&store_passwd=${encodeURIComponent(
      env.SSLCOMMERZ_STORE_PASS
    )}&format=json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new BusinessError(
        "ERR_GATEWAY_UNAVAILABLE",
        `SSLCommerz transaction query error: ${response.statusText}`,
        { status: response.status },
        502
      );
    }

    return (await response.json()) as SslcommerzQueryResponse;
  }

  async initiateRefund(req: SslcommerzRefundRequest): Promise<SslcommerzRefundResponse> {
    const params = new URLSearchParams();
    params.set("store_id", env.SSLCOMMERZ_STORE_ID);
    params.set("store_passwd", env.SSLCOMMERZ_STORE_PASS);
    params.set("bank_tran_id", req.bank_tran_id);
    params.set("refund_amount", req.refund_amount);
    params.set("refund_remarks", req.refund_remarks);
    params.set("re_fe_id", req.re_fe_id);
    params.set("format", "json");

    try {
      const res = await fetch(
        `${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?${params.toString()}`,
        { method: "GET" }
      );
      if (!res.ok) {
        throw new BusinessError("ERR_GATEWAY_UNAVAILABLE", "SSLCommerz refund initiation failed", {}, 502);
      }
      return (await res.json()) as SslcommerzRefundResponse;
    } catch (err: any) {
      if (err instanceof BusinessError) throw err;
      throw new BusinessError("ERR_GATEWAY_UNAVAILABLE", "Failed to reach SSLCommerz refund API", { originalError: String(err) }, 502);
    }
  }

  async queryRefund(refundRefId: string): Promise<SslcommerzRefundQueryResponse> {
    const params = new URLSearchParams();
    params.set("store_id", env.SSLCOMMERZ_STORE_ID);
    params.set("store_passwd", env.SSLCOMMERZ_STORE_PASS);
    params.set("refund_ref_id", refundRefId);
    params.set("format", "json");

    try {
      const res = await fetch(
        `${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?${params.toString()}`,
        { method: "GET" }
      );
      if (!res.ok) {
        throw new BusinessError("ERR_GATEWAY_UNAVAILABLE", "SSLCommerz refund query failed", {}, 502);
      }
      return (await res.json()) as SslcommerzRefundQueryResponse;
    } catch (err: any) {
      if (err instanceof BusinessError) throw err;
      throw new BusinessError("ERR_GATEWAY_UNAVAILABLE", "Failed to reach SSLCommerz refund status API", { originalError: String(err) }, 502);
    }
  }
}

/**
 * Mock SSLCommerz Client for testing and local development.
 */
export class MockSslcommerzClient implements SslcommerzClient {
  private simulateFailure = false;
  private nextRiskLevel: string | number = "0";
  private nextRiskTitle = "Safe";
  private tamperedAmount: string | null = null;
  private customValidations = new Map<string, SslcommerzValidationResponse>();
  private customQueries = new Map<string, SslcommerzQueryResponse>();
  private activeSessions = new Map<string, SslcommerzSessionRequest>();
  private customRefunds = new Map<string, SslcommerzRefundResponse>();
  private customRefundQueries = new Map<string, SslcommerzRefundQueryResponse>();
  private simulateRefundFailure = false;
  private nextRefundStatus: "PROCESSING" | "COMPLETED" | "FAILED" = "COMPLETED";

  setSimulateFailure(flag: boolean): void {
    this.simulateFailure = flag;
  }

  setNextRiskLevel(level: string | number, title = "Safe"): void {
    this.nextRiskLevel = level;
    this.nextRiskTitle = title;
  }

  setTamperedAmount(amount: string | null): void {
    this.tamperedAmount = amount;
  }

  setSimulateRefundFailure(flag: boolean): void {
    this.simulateRefundFailure = flag;
  }

  setNextRefundStatus(status: "PROCESSING" | "COMPLETED" | "FAILED"): void {
    this.nextRefundStatus = status;
  }

  setCustomRefund(reFeId: string, res: SslcommerzRefundResponse): void {
    this.customRefunds.set(reFeId, res);
  }

  setCustomRefundQuery(refundRefId: string, res: SslcommerzRefundQueryResponse): void {
    this.customRefundQueries.set(refundRefId, res);
  }

  clear(): void {
    this.simulateFailure = false;
    this.nextRiskLevel = "0";
    this.nextRiskTitle = "Safe";
    this.tamperedAmount = null;
    this.customValidations.clear();
    this.customQueries.clear();
    this.activeSessions.clear();
    this.customRefunds.clear();
    this.customRefundQueries.clear();
    this.simulateRefundFailure = false;
    this.nextRefundStatus = "COMPLETED";
  }

  async initSession(req: SslcommerzSessionRequest): Promise<SslcommerzSessionResponse> {
    if (this.simulateFailure) {
      throw new BusinessError(
        "ERR_GATEWAY_UNAVAILABLE",
        "Payment gateway is currently unavailable. Please retry using the pay endpoint.",
        { tranId: req.tran_id },
        502
      );
    }

    this.activeSessions.set(req.tran_id, req);
    const sessionKey = `SESS_${req.tran_id}`;
    const redirectUrl = `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=pay&SESSIONKEY=${sessionKey}`;

    return {
      status: "SUCCESS",
      sessionkey: sessionKey,
      GatewayPageURL: redirectUrl,
    };
  }

  async validateOrder(valId: string): Promise<SslcommerzValidationResponse> {
    if (this.simulateFailure) {
      throw new BusinessError("ERR_GATEWAY_UNAVAILABLE", "Validation failed", {}, 502);
    }

    if (this.customValidations.has(valId)) {
      return this.customValidations.get(valId)!;
    }

    // Synthesize a valid response based on session
    let tranId = "TXN_MOCK";
    let amount = "80.00";
    for (const [tId, sess] of this.activeSessions.entries()) {
      if (valId.includes(tId) || valId === `VAL_${tId}`) {
        tranId = tId;
        amount = sess.total_amount;
        break;
      }
    }

    if (this.tamperedAmount) {
      amount = this.tamperedAmount;
    }

    return {
      status: "VALID",
      tran_id: tranId,
      val_id: valId,
      amount,
      store_amount: amount,
      card_type: "BKASH-bKash",
      bank_tran_id: `BANK_${tranId}`,
      card_brand: "MOBILEBANKING",
      card_issuer: "bKash",
      risk_level: this.nextRiskLevel,
      risk_title: this.nextRiskTitle,
    };
  }

  async queryTransaction(tranId: string): Promise<SslcommerzQueryResponse> {
    if (this.simulateFailure) {
      throw new BusinessError("ERR_GATEWAY_UNAVAILABLE", "Query failed", {}, 502);
    }

    if (this.customQueries.has(tranId)) {
      return this.customQueries.get(tranId)!;
    }

    const sess = this.activeSessions.get(tranId);
    const amount = this.tamperedAmount || sess?.total_amount || "80.00";

    const item: SslcommerzValidationResponse = {
      status: "VALID",
      tran_id: tranId,
      val_id: `VAL_${tranId}`,
      amount,
      store_amount: amount,
      card_type: "BKASH-bKash",
      bank_tran_id: `BANK_${tranId}`,
      risk_level: this.nextRiskLevel,
      risk_title: this.nextRiskTitle,
    };

    return {
      status: "API_SUCCESS",
      element: [item],
      tran_id: tranId,
      val_id: `VAL_${tranId}`,
      amount,
      bank_tran_id: `BANK_${tranId}`,
      card_type: "BKASH-bKash",
      risk_level: this.nextRiskLevel,
      risk_title: this.nextRiskTitle,
    };
  }

  async initiateRefund(req: SslcommerzRefundRequest): Promise<SslcommerzRefundResponse> {
    if (this.simulateRefundFailure) {
      return {
        status: "failed",
        errorReason: "Payment gateway error during refund initiation",
      };
    }

    if (this.customRefunds.has(req.re_fe_id)) {
      return this.customRefunds.get(req.re_fe_id)!;
    }

    const refId = `REF_SSL_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const response: SslcommerzRefundResponse = {
      status: "success",
      refund_ref_id: refId,
      APIConnect: "DONE",
    };
    return response;
  }

  async queryRefund(refundRefId: string): Promise<SslcommerzRefundQueryResponse> {
    if (this.simulateRefundFailure) {
      throw new BusinessError("ERR_GATEWAY_UNAVAILABLE", "Refund query failed", {}, 502);
    }

    if (this.customRefundQueries.has(refundRefId)) {
      return this.customRefundQueries.get(refundRefId)!;
    }

    return {
      status: "success",
      refund_ref_id: refundRefId,
      refund_status: this.nextRefundStatus,
    };
  }
}

let activeClient: SslcommerzClient = new MockSslcommerzClient();

export function getSslcommerzClient(): SslcommerzClient {
  if (env.MOCK_EXTERNAL_SERVICES || env.NODE_ENV === "test") {
    return activeClient;
  }
  return new RealSslcommerzClient();
}

export function setSslcommerzClient(client: SslcommerzClient): void {
  activeClient = client;
}
