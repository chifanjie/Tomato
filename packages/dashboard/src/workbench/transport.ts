/**
 * Non-secret in-memory marker for the HttpOnly-cookie Workbench transport.
 * It must never be written to URL or browser storage.
 */
export const COOKIE_WORKBENCH_ACCESS = "__workbench_cookie__";

export function isCookieWorkbenchAccess(access: string | null | undefined): boolean {
  return access === COOKIE_WORKBENCH_ACCESS;
}

export function isCookieWorkbenchLocation(
  location?: Pick<Location, "pathname">,
): boolean {
  const resolved = location ?? (typeof window === "undefined" ? undefined : window.location);
  return resolved?.pathname === "/workbench";
}

export function withDashboardAccess(url: string, access: string | null): string {
  if (!access || isCookieWorkbenchAccess(access)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(access)}`;
}

export function dashboardFetchInit(access: string | null): RequestInit {
  return isCookieWorkbenchAccess(access) ? { credentials: "same-origin" } : {};
}
