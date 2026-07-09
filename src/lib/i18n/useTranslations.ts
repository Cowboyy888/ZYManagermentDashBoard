"use client";

import { useLocale } from "./LocaleContext";
import type { Locale } from "./index";

type LocaleDict<T> = { [K in keyof T]: T[K] extends (...args: infer A) => unknown ? (...args: A) => string : string };

// Generic translation hook — pass the module dict for each supported locale.
// km falls back to en when not supplied.
export function useTranslations<T extends Record<string, unknown>>(
  en: T,
  zhCN: LocaleDict<T>,
  km?: LocaleDict<T>,
): T {
  const { locale } = useLocale();
  if (locale === "zh-CN") return zhCN as T;
  if (locale === "km") return (km ?? en) as T;
  return en;
}

// Helper: format date for locale
export function useDateFormatter() {
  const { locale } = useLocale();
  const tag = locale === "zh-CN" ? "zh-CN" : locale === "km" ? "km-KH" : "en-US";
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
  const tag = locale === "zh-CN" ? "zh-CN" : locale === "km" ? "km-KH" : "en-US";
  return {
    currency: (n: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(n),
    number: (n: number) => new Intl.NumberFormat(tag).format(n),
    percent: (n: number) => new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 1 }).format(n / 100),
  };
}

export type { Locale };
