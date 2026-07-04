// Locale types and utilities
export type Locale = "en" | "zh-CN";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en",    label: "English", flag: "🇺🇸" },
  { code: "zh-CN", label: "中文",    flag: "🇨🇳" },
];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "zy_locale";

export function isValidLocale(v: unknown): v is Locale {
  return v === "en" || v === "zh-CN";
}

export function detectLocale(cookieValue?: string | null, acceptLanguage?: string | null): Locale {
  if (cookieValue && isValidLocale(cookieValue)) return cookieValue;
  if (acceptLanguage) {
    const tag = acceptLanguage.split(",")[0]?.split(";")[0]?.trim().toLowerCase();
    if (tag === "zh" || tag?.startsWith("zh-")) return "zh-CN";
  }
  return DEFAULT_LOCALE;
}
