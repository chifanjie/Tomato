import { createRequire } from "node:module";

// The browser export uses document at module scope, which breaks Web Workers.
// Pin only this parser dependency to its official DOM-free implementation;
// other browser dependencies keep their normal export conditions.
export const markdownWorkerSafeAliases = {
  "decode-named-character-reference": createRequire(import.meta.url).resolve("decode-named-character-reference"),
};
