/**
 * NCAMart — Type-Safe Universal API Client & RFC 7807 Handler
 * PRD §1.1, architechture.md §16, api-spec.md §2, F03
 */

export interface ProblemDetails {
  code: string;
  message: string;
  status?: number;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface ApiErrorResponse {
  error: ProblemDetails;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly messageBn: string;

  constructor(problem: ProblemDetails, status: number) {
    super(problem.message);
    this.name = "ApiClientError";
    this.code = problem.code || "ERR_INTERNAL";
    this.status = status || problem.status || 500;
    this.details = problem.details;
    this.messageBn = translateErrorMessageBn(problem.code, problem.message);
  }
}

/**
 * Bilingual Error Translation Dictionary (Bangla / English)
 */
function translateErrorMessageBn(code: string, fallbackEn: string): string {
  switch (code) {
    case "ERR_MIXED_CART_DISALLOWED":
      return "প্রি-অর্ডার এবং ইন-স্টক পণ্য একসাথে চেকআউট করা সম্ভব নয়। দয়া করে আলাদা অর্ডার করুন।";
    case "ERR_COD_NOT_ALLOWED":
      return "আপনার বর্তমান অ্যাকাউন্টের জন্য ক্যাশ অন ডেলিভারি (COD) প্রযোজ্য নয়। অনলাইন পেমেন্ট ব্যবহার করুন।";
    case "ERR_INSUFFICIENT_STOCK":
      return "নির্বাচিত পণ্যের স্টক শেষ হয়ে গেছে বা অন্য গ্রাহকের কার্টে লক রয়েছে।";
    case "ERR_OTP_INVALID":
      return "ভুল ওটিপি (OTP) কোড দেওয়া হয়েছে। সঠিক কোড দিয়ে আবার চেষ্টা করুন।";
    case "ERR_OTP_EXPIRED":
      return "ওটিপির মেয়াদ শেষ হয়ে গেছে। নতুন কোড পাওয়ার জন্য অনুরোধ করুন।";
    case "ERR_UNAUTHENTICATED":
      return "অনুগ্রহ করে প্রথমে আপনার একাউন্টে লগইন করুন।";
    case "ERR_FORBIDDEN":
      return "এই অ্যাকশনটি সম্পাদন করার পর্যাপ্ত অনুমতি আপনার নেই।";
    case "ERR_NOT_FOUND":
      return "অনুরোধকৃত তথ্য বা পণ্যটি পাওয়া যায়নি।";
    case "ERR_RATE_LIMITED":
    case "ERR_RATE_LIMIT_BLOCKED":
      return "অতিরিক্ত অনুরোধের কারণে সাময়িকভাবে ব্লক করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।";
    case "ERR_GATEWAY_UNAVAILABLE":
      return "পেমেন্ট গেটওয়ে সাময়িকভাবে ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।";
    default:
      return fallbackEn;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipIdempotency?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("nca_token");
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = new URL(this.baseUrl ? `${this.baseUrl}${cleanEndpoint}` : cleanEndpoint, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, String(val));
        }
      });
    }

    return this.baseUrl ? url.toString() : `${url.pathname}${url.search}`;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, skipIdempotency, headers = {}, ...customOptions } = options;
    const url = this.buildUrl(endpoint, params);

    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes((customOptions.method || "GET").toUpperCase());
    const reqHeaders: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(headers as Record<string, string>),
    };

    // Auto-attach Idempotency-Key on mutating calls if not disabled
    if (isMutation && !skipIdempotency && !reqHeaders["Idempotency-Key"]) {
      reqHeaders["Idempotency-Key"] = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Attach Bearer token fallback if present in localStorage
    const token = this.getAuthToken();
    if (token && !reqHeaders["Authorization"]) {
      reqHeaders["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      credentials: "include", // Always send nca_sid cookie
      headers: reqHeaders,
      ...customOptions,
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    let data: unknown;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => null);
    }

    if (!response.ok) {
      if (
        response.status === 401 &&
        typeof window !== "undefined" &&
        !endpoint.includes("/auth/login") &&
        !endpoint.includes("/auth/otp") &&
        !endpoint.includes("/auth/register")
      ) {
        localStorage.removeItem("nca_token");
        localStorage.removeItem("nca_user");
        try {
          const channel = new BroadcastChannel("nca_auth_channel");
          channel.postMessage({ type: "UNAUTHORIZED", timestamp: Date.now() });
          channel.close();
        } catch {
          // ignore
        }
      }

      if (data && typeof data === "object" && "error" in data) {
        const errorContainer = data as { error: ProblemDetails };
        throw new ApiClientError(errorContainer.error, response.status);
      }
      throw new ApiClientError(
        {
          code: `HTTP_${response.status}`,
          message: typeof data === "string" ? data : response.statusText || "Request failed",
        },
        response.status
      );
    }

    return data as T;
  }

  get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", params, ...options });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", ...options });
  }
}

export const api = new ApiClient();
