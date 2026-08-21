declare const __UNDERSTAND_CODE_PRODUCT_VERSION__: string | undefined;

export const PRODUCT_NAME = "understand-code";
export const PRODUCT_VERSION =
  typeof __UNDERSTAND_CODE_PRODUCT_VERSION__ === "undefined"
    ? "0.1.0"
    : __UNDERSTAND_CODE_PRODUCT_VERSION__;

export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([
  "2025-11-25",
  "2025-06-18",
] as const);
export const PREFERRED_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const MAX_FRAME_BYTES = 1024 * 1024;
export const MAX_PATH_BYTES = 4_096;
export const MAX_IDENTITY_BYTES = 256;
export const MAX_ROOTS = 64;
export const ROOTS_REQUEST_TIMEOUT_MS = 2_000;
