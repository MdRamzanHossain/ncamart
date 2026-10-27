"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  type SupportedLocale,
  type TranslationKey,
  t as translateHelper,
  toBengaliDigits,
  formatLocalizedNumber,
  formatLocalizedPaisa,
} from "@/lib/i18n";

interface LocaleContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey | string) => string;
  formatNumber: (num: number | string) => string;
  formatPaisa: (paisa: number) => string;
  isBengali: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({
  children,
  defaultLocale = "bn",
}: {
  children: React.ReactNode;
  defaultLocale?: SupportedLocale;
}) {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);

  // Sync with localStorage on client
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ncamart_locale");
      if (stored === "en" || stored === "bn") {
        setLocaleState(stored);
      }
    } catch {
      // Ignore localStorage exceptions in privacy mode
    }
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("ncamart_locale", newLocale);
      document.documentElement.lang = newLocale === "bn" ? "bn-BD" : "en-US";
    } catch {
      // Ignore
    }
  };

  const toggleLocale = () => {
    setLocale(locale === "en" ? "bn" : "en");
  };

  const t = (key: TranslationKey | string) => translateHelper(key, locale);
  const formatNumber = (num: number | string) => formatLocalizedNumber(num, locale);
  const formatPaisa = (paisa: number) => formatLocalizedPaisa(paisa, locale);

  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale,
        toggleLocale,
        t,
        formatNumber,
        formatPaisa,
        isBengali: locale === "bn",
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext);
  if (!context) {
    // Fallback if rendered outside LocaleProvider
    return {
      locale: "bn",
      setLocale: () => {},
      toggleLocale: () => {},
      t: (key: TranslationKey | string) => translateHelper(key, "bn"),
      formatNumber: (num: number | string) => formatLocalizedNumber(num, "bn"),
      formatPaisa: (paisa: number) => formatLocalizedPaisa(paisa, "bn"),
      isBengali: true,
    };
  }
  return context;
}
