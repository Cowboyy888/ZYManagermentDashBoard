// Locale types and utilities
export type Locale = "en" | "zh-CN" | "km";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en",    label: "English", flag: "🇺🇸" },
  { code: "zh-CN", label: "中文",    flag: "🇨🇳" },
  { code: "km",    label: "ខ្មែរ",   flag: "🇰🇭" },
];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "zy_locale";

export function isValidLocale(v: unknown): v is Locale {
  return v === "en" || v === "zh-CN" || v === "km";
}

export function detectLocale(cookieValue?: string | null, acceptLanguage?: string | null): Locale {
  if (cookieValue && isValidLocale(cookieValue)) return cookieValue;
  if (acceptLanguage) {
    const tag = acceptLanguage.split(",")[0]?.split(";")[0]?.trim().toLowerCase();
    if (tag === "zh" || tag?.startsWith("zh-")) return "zh-CN";
    if (tag === "km" || tag?.startsWith("km-")) return "km";
  }
  return DEFAULT_LOCALE;
}
