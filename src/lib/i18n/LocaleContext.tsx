"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Locale } from "./index";
import { LOCALE_COOKIE, isValidLocale, DEFAULT_LOCALE } from "./index";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `${LOCALE_COOKIE}=${l};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  }, []);

  // Sync if another tab changes locale
  useEffect(() => {
    const handler = () => {
      const v = document.cookie
        .split("; ")
        .find(r => r.startsWith(LOCALE_COOKIE + "="))
        ?.split("=")[1];
      if (v && isValidLocale(v) && v !== locale) setLocaleState(v);
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
