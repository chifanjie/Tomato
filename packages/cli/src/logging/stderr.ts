import { PRODUCT_NAME } from "../constants.js";

export type DiagnosticCode =
  | "configuration_error"
  | "transport_error"
  | "internal_error";

export function writeDiagnostic(code: DiagnosticCode): void {
  process.stderr.write(`${PRODUCT_NAME}: ${code}\n`);
}
