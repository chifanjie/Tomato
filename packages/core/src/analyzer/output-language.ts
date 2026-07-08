const SIMPLIFIED_CHINESE_CODES = new Set([
  "zh",
  "zh-cn",
  "zh-hans",
  "cn",
  "chinese",
  "simplified chinese",
  "mandarin",
  "中文",
  "简体中文",
]);

const TRADITIONAL_CHINESE_CODES = new Set([
  "zh-tw",
  "zh-hk",
  "zh-hant",
  "traditional chinese",
  "繁體中文",
  "繁体中文",
]);

export const DEFAULT_OUTPUT_LANGUAGE = "zh";

function normalizeOutputLanguage(outputLanguage?: string): string {
  const normalized = outputLanguage?.trim().toLowerCase();
  return normalized || DEFAULT_OUTPUT_LANGUAGE;
}

export function isSimplifiedChineseOutputLanguage(
  outputLanguage?: string,
): boolean {
  return SIMPLIFIED_CHINESE_CODES.has(normalizeOutputLanguage(outputLanguage));
}

export function buildOutputLanguageDirective(outputLanguage?: string): string {
  const normalized = normalizeOutputLanguage(outputLanguage);

  if (SIMPLIFIED_CHINESE_CODES.has(normalized)) {
    return [
      "Output language: Write all user-facing generated content in Simplified Chinese.",
      "Keep code identifiers, file paths, package names, framework names, API names, JSON field names, and enum values in their original form.",
      "Do not translate JSON keys or required literal values.",
    ].join(" ");
  }

  if (TRADITIONAL_CHINESE_CODES.has(normalized)) {
    return [
      "Output language: Write all user-facing generated content in Traditional Chinese.",
      "Keep code identifiers, file paths, package names, framework names, API names, JSON field names, and enum values in their original form.",
      "Do not translate JSON keys or required literal values.",
    ].join(" ");
  }

  if (!normalized || normalized === "en" || normalized === "english") {
    return "Output language: Write all user-facing generated content in English.";
  }

  const requestedLanguage = outputLanguage?.trim() ?? "English";
  return [
    `Output language: Write all user-facing generated content in ${requestedLanguage}.`,
    "Keep code identifiers, file paths, package names, framework names, API names, JSON field names, and enum values in their original form.",
    "Do not translate JSON keys or required literal values.",
  ].join(" ");
}
