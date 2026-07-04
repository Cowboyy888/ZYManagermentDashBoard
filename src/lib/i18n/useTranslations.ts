"use client";

import { useLocale } from "./LocaleContext";
import type { Locale } from "./index";

// Generic translation hook — pass the module dict for both locales.
// zhCN is typed as Record<keyof T, string> so literal types don't clash.
export function useTranslations<T extends Record<string, unknown>>(
  en: T,
  zhCN: { [K in keyof T]: T[K] extends (...args: infer A) => unknown ? (...args: A) => string : string },
): T {
  const { locale } = useLocale();
  return (locale === "zh-CN" ? zhCN : en) as T;
}

// Helper: format date for locale
export function useDateFormatter() {
  const { locale } = useLocale();
  const tag = locale === "zh-CN" ? "zh-CN" : "en-US";
  return {
    short: (d: Date | string | null) => {
      if (!d) return "—";
      return new Date(d).toLocaleDateString(tag, { year: "numeric", month: "2-digit", day: "2-digit" });
    },
    medium: (d: Date | string | null) => {
      if (!d) return "—";
      return new Date(d).toLocaleDateString(tag, { year: "numeric", month: "short", day: "numeric" });
    },
    long: (d: Date | string | null) => {
      if (!d) return "—";
      return new Date(d).toLocaleDateString(tag, { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    },
  };
}

// Helper: format numbers for locale
export function useNumberFormatter() {
  const { locale } = useLocale();
  const tag = locale === "zh-CN" ? "zh-CN" : "en-US";
  return {
    currency: (n: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(n),
    number: (n: number) => new Intl.NumberFormat(tag).format(n),
    percent: (n: number) => new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 1 }).format(n / 100),
  };
}

export type { Locale };
