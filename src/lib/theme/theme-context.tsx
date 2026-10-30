"use client";

import React, { createContext, useContext, useEffect } from "react";
import type { Theme, ResolvedTheme, ThemeContextValue } from "./types";

const THEME_STORAGE_KEY = "nca_theme";
const THEME_COOKIE_KEY = "nca_theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme: Theme = "light";
  const resolvedTheme: ResolvedTheme = "light";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, "light");
    } catch {
      // Ignore storage errors
    }
    document.cookie = `${THEME_COOKIE_KEY}=light; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const setTheme = () => {
    document.documentElement.setAttribute("data-theme", "light");
  };

  const toggleTheme = () => {
    document.documentElement.setAttribute("data-theme", "light");
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return context;
}
