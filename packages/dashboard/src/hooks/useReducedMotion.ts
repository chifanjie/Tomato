import { useEffect, useState } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type MatchMediaLike = (
  query: string,
) => Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;

export function observeReducedMotion(
  matchMedia: MatchMediaLike,
  notify: (reduced: boolean) => void,
): () => void {
  const media = matchMedia(REDUCED_MOTION_QUERY);
  const onChange = (event: MediaQueryListEvent) => notify(event.matches);
  notify(media.matches);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    return observeReducedMotion(window.matchMedia.bind(window), setReduced);
  }, []);
  return reduced;
}
