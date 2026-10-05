import { describe, expect, it } from "vitest";
import { iosInstallSurface } from "@/features/pwa/ios-install";

const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const CRIOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0.0";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.193 Mobile Safari/537.36";

describe("iosInstallSurface", () => {
  it("treats iPhone Safari as Safari", () => {
    expect(iosInstallSurface(SAFARI_IPHONE)).toBe("safari");
  });

  it("treats Chrome on iPhone as a non-Safari browser", () => {
    expect(iosInstallSurface(CRIOS)).toBe("other");
  });

  it("treats an in-app iPhone browser as non-Safari", () => {
    expect(iosInstallSurface(INSTAGRAM)).toBe("other");
  });

  it("ignores Android Chrome", () => {
    expect(iosInstallSurface(ANDROID_CHROME)).toBeNull();
  });

  it("treats iPad desktop mode as Safari when the platform is a touch Mac", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
    expect(iosInstallSurface(ua, "MacIntel", 5)).toBe("safari");
  });
});
