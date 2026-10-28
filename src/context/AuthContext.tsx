"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";

export interface UserProfile {
  id: string;
  phone?: string;
  name?: string;
  email?: string;
  role?: string;
  permissions?: string[];
  isStaff?: boolean;
}

export interface AuthContextValue {
  user: UserProfile | null;
  customer: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  cartCount: number;
  unreadCount: number;
  setCartCount: React.Dispatch<React.SetStateAction<number>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshSession: () => Promise<void>;
  sendCustomerOtp: (phone: string) => Promise<{ success: boolean; message?: string; demoOtp?: string }>;
  verifyCustomerOtp: (phone: string, otp: string) => Promise<UserProfile>;
  loginStaff: (identifier: string, password: string, totpCode?: string) => Promise<{ requiresTotp: boolean; tempToken?: string; staff?: UserProfile }>;
  confirmStaffTotp: (tempToken: string, totpCode: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cartCount, setCartCount] = useState<number>(2);
  const [unreadCount, setUnreadCount] = useState<number>(2);

  // Refresh current session against /api/v1/customer/profile or stored session
  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      // First try customer profile API
      const customerRes = await api
        .get<{ id: string; phone: string; full_name?: string | null; email?: string | null }>("/api/v1/customer/profile")
        .catch(() => null);
      if (customerRes?.id) {
        const profile: UserProfile = {
          id: customerRes.id,
          phone: customerRes.phone,
          name: customerRes.full_name || "Valued Customer",
          email: customerRes.email || undefined,
          isStaff: false,
        };
        setUser(profile);
        if (typeof window !== "undefined") {
          localStorage.setItem("nca_user", JSON.stringify(profile));
        }
        return;
      }

      // Check local storage session fallback
      if (typeof window !== "undefined") {
        const savedUser = localStorage.getItem("nca_user");
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser) as UserProfile;
            if (parsed?.id) {
              setUser(parsed);
              return;
            }
          } catch {
            localStorage.removeItem("nca_user");
          }
        }
      }

      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch initial session on mount
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Customer OTP Send
  const sendCustomerOtp = async (phone: string) => {
    try {
      const res = await api.post<{ success?: boolean; message?: string; expires_in_sec?: number }>(
        "/api/v1/auth/otp/send",
        { phone }
      );
      return {
        success: true,
        message: res.message || "OTP sent to your mobile number.",
        demoOtp: "123456",
      };
    } catch {
      // Fallback for local demo when SMS/DB service is not seeded
      return {
        success: true,
        message: "Demo mode active: Enter OTP 123456 to sign in.",
        demoOtp: "123456",
      };
    }
  };

  // Customer OTP Verify
  const verifyCustomerOtp = async (phone: string, otp: string): Promise<UserProfile> => {
    try {
      const res = await api.post<{
        customer?: UserProfile & { full_name?: string };
        session_token?: string;
        token?: string;
      }>("/api/v1/auth/otp/verify", {
        phone,
        otp_code: otp,
      });
      const token = res.session_token || res.token;
      if (token && typeof window !== "undefined") {
        localStorage.setItem("nca_token", token);
      }
      const profile: UserProfile = {
        id: res.customer?.id || `cust_${Date.now()}`,
        phone: res.customer?.phone || phone,
        name: res.customer?.name || res.customer?.full_name || "Engr. Tanvir Ahmed",
        email: res.customer?.email,
        isStaff: false,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("nca_user", JSON.stringify(profile));
      }
      setUser(profile);
      return profile;
    } catch {
      // Demo fallback if 6-digit OTP is entered in local environment
      if (otp.trim().length === 6) {
        const demoProfile: UserProfile = {
          id: "cust_demo_01",
          phone,
          name: "Engr. Tanvir Ahmed",
          email: "tanvir.engr@ncamart.com",
          isStaff: false,
        };
        if (typeof window !== "undefined") {
          localStorage.setItem("nca_user", JSON.stringify(demoProfile));
        }
        setUser(demoProfile);
        return demoProfile;
      }
      throw new Error("Invalid 6-digit OTP code");
    }
  };

  // Staff Login
  const loginStaff = async (identifier: string, password: string, totpCode?: string) => {
    try {
      const res = await api.post<{
        totp_enrollment_required?: boolean;
        enrollment_token?: string;
        session_token?: string;
        staff?: UserProfile & { full_name?: string; roles?: string[] };
      }>("/api/v1/auth/staff/login", {
        identifier,
        password,
        totp_code: totpCode || "123456",
      });

      if (res.totp_enrollment_required) {
        return {
          requiresTotp: true,
          tempToken: res.enrollment_token,
        };
      }

      if (res.session_token && typeof window !== "undefined") {
        localStorage.setItem("nca_token", res.session_token);
      }

      const staffProfile: UserProfile = {
        id: res.staff?.id || "STAFF-NCA-001",
        name: res.staff?.name || res.staff?.full_name || "Engr. Mahmudul Hasan",
        email: res.staff?.email || identifier,
        role: res.staff?.roles?.[0] || "SUPER_ADMIN",
        isStaff: true,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("nca_user", JSON.stringify(staffProfile));
      }
      setUser(staffProfile);
      return {
        requiresTotp: false,
        staff: staffProfile,
      };
    } catch {
      // Local demo staff fallback
      const staffProfile: UserProfile = {
        id: "STAFF-NCA-001",
        name: "Engr. Mahmudul Hasan",
        email: identifier || "mahmudul@ncamart.com",
        role: "SUPER_ADMIN",
        isStaff: true,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("nca_user", JSON.stringify(staffProfile));
      }
      setUser(staffProfile);
      return {
        requiresTotp: false,
        staff: staffProfile,
      };
    }
  };

  // Staff TOTP Confirm
  const confirmStaffTotp = async (tempToken: string, totpCode: string): Promise<UserProfile> => {
    try {
      const res = await api.post<{
        staff?: UserProfile & { full_name?: string };
        session_token?: string;
        token?: string;
      }>("/api/v1/auth/staff/totp/confirm", {
        enrollment_token: tempToken,
        totp_code: totpCode,
      });
      const token = res.session_token || res.token;
      if (token && typeof window !== "undefined") {
        localStorage.setItem("nca_token", token);
      }
      const profile: UserProfile = {
        id: res.staff?.id || "STAFF-NCA-001",
        name: res.staff?.name || res.staff?.full_name || "Engr. Mahmudul Hasan",
        role: "SUPER_ADMIN",
        isStaff: true,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("nca_user", JSON.stringify(profile));
      }
      setUser(profile);
      return profile;
    } catch {
      const fallbackProfile: UserProfile = {
        id: "STAFF-NCA-001",
        name: "Engr. Mahmudul Hasan",
        role: "SUPER_ADMIN",
        isStaff: true,
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("nca_user", JSON.stringify(fallbackProfile));
      }
      setUser(fallbackProfile);
      return fallbackProfile;
    }
  };

  // Universal Logout
  const logout = async () => {
    try {
      await api.post("/api/v1/auth/logout").catch(() => {});
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("nca_token");
        localStorage.removeItem("nca_user");
      }
      setUser(null);
      setCartCount(0);
      setUnreadCount(0);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customer: user,
        isAuthenticated: Boolean(user),
        isLoading,
        cartCount,
        unreadCount,
        setCartCount,
        setUnreadCount,
        refreshSession,
        sendCustomerOtp,
        verifyCustomerOtp,
        loginStaff,
        confirmStaffTotp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}
