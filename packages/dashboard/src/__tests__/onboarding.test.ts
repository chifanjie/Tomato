import { describe, expect, it } from "vitest";
import { shouldShowOnboarding } from "../App";

describe("shouldShowOnboarding", () => {
  it("does not show the old graph onboarding by default", () => {
    expect(shouldShowOnboarding("")).toBe(false);
  });

  it("allows forcing onboarding from the URL", () => {
    expect(shouldShowOnboarding("?onboard=force")).toBe(true);
  });
});
