import { describe, expect, it } from "vitest";
import { deviceLabel, UNKNOWN_DEVICE } from "./device";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1";
const IPAD_FIREFOX =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const LINUX_FIREFOX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";
const CHROMEBOOK =
  "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

describe("deviceLabel", () => {
  it.each([
    [IPHONE_SAFARI, "iPhone · Safari"],
    [IPHONE_CHROME, "iPhone · Chrome"],
    [IPAD_FIREFOX, "iPad · Firefox"],
    [ANDROID_CHROME, "Android · Chrome"],
    [MAC_CHROME, "Mac · Chrome"],
    [MAC_SAFARI, "Mac · Safari"],
    [WINDOWS_EDGE, "Windows · Edge"],
    [LINUX_FIREFOX, "Linux · Firefox"],
    [CHROMEBOOK, "Chromebook · Chrome"],
  ])("reconnaît l’appareil et le navigateur (%#)", (userAgent, label) => {
    expect(deviceLabel(userAgent)).toBe(label);
  });

  it("donne l’appareil seul quand le navigateur est inconnu", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Bidule/1.0")).toBe(
      "Windows",
    );
  });

  it.each([
    ["inconnu", "curl/8.5.0"],
    ["vide", ""],
    ["absent", null],
    ["non défini", undefined],
  ])("un agent %s donne « APPAREIL INCONNU »", (_label, userAgent) => {
    expect(deviceLabel(userAgent)).toBe(UNKNOWN_DEVICE);
    expect(UNKNOWN_DEVICE).toBe("APPAREIL INCONNU");
  });
});
