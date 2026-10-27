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
  isAuthenticated: boolean;
  isLoading: boolean;
  cartCount: number;
  unreadCount: number;
  setCartCount: React.Dispatch<React.SetStateAction<number>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshSession: () => Promise<void>;
  sendCustomerOtp: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyCustomerOtp: (phone: string, otp: string) => Promise<UserProfile>;
  loginStaff: (identifier: string, password: string) => Promise<{ requiresTotp: boolean; tempToken?: string }>;
  confirmStaffTotp: (tempToken: string, totpCode: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cartCount, setCartCount] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Refresh current session against /api/v1/auth/me or /api/v1/admin/staff/me
  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      // First try customer me
      const customerRes = await api.get<{ customer: UserProfile }>("/api/v1/auth/me").catch(() => null);
      if (customerRes?.customer) {
        setUser({ ...customerRes.customer, isStaff: false });
        return;
      }

      // If no customer session, try staff me
      const staffRes = await api.get<{ staff: UserProfile }>("/api/v1/admin/staff/me").catch(() => null);
      if (staffRes?.staff) {
        setUser({ ...staffRes.staff, isStaff: true });
        return;
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
    return api.post<{ success: boolean; message?: string }>("/api/v1/auth/otp/send", { phone });
  };

  // Customer OTP Verify
  const verifyCustomerOtp = async (phone: string, otp: string): Promise<UserProfile> => {
    const res = await api.post<{ customer: UserProfile; token?: string }>("/api/v1/auth/otp/verify", {
      phone,
      otp,
    });
    if (res.token) {
      localStorage.setItem("nca_token", res.token);
    }
    const profile = { ...res.customer, isStaff: false };
    setUser(profile);
    return profile;
  };

  // Staff Login
  const loginStaff = async (identifier: string, password: string) => {
    const res = await api.post<{ requiresTotp: boolean; tempToken?: string; staff?: UserProfile }>(
      "/api/v1/admin/staff/login",
      { identifier, password }
    );
    if (!res.requiresTotp && res.staff) {
      setUser({ ...res.staff, isStaff: true });
    }
    return {
      requiresTotp: Boolean(res.requiresTotp),
      tempToken: res.tempToken,
    };
  };

  // Staff TOTP Confirm
  const confirmStaffTotp = async (tempToken: string, totpCode: string): Promise<UserProfile> => {
    const res = await api.post<{ staff: UserProfile; token?: string }>(
      "/api/v1/admin/staff/totp/confirm",
      { tempToken, totpCode }
    );
    if (res.token) {
      localStorage.setItem("nca_token", res.token);
    }
    const profile = { ...res.staff, isStaff: true };
    setUser(profile);
    return profile;
  };

  // Universal Logout
  const logout = async () => {
    try {
      if (user?.isStaff) {
        await api.post("/api/v1/admin/staff/logout").catch(() => {});
      } else {
        await api.post("/api/v1/auth/logout").catch(() => {});
      }
    } finally {
      localStorage.removeItem("nca_token");
      setUser(null);
      setCartCount(0);
      setUnreadCount(0);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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
