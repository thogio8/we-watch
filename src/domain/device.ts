export const UNKNOWN_DEVICE = "APPAREIL INCONNU";

type Rule = readonly [pattern: RegExp, label: string];

// First match wins: iPhone and iPad say « like Mac OS X », Android and
// Chrome OS say « Linux ».
const PLATFORMS: readonly Rule[] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "Chromebook"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

// Edge and Chrome on iOS still say « Safari », Edge says « Chrome ».
const BROWSERS: readonly Rule[] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const find = (rules: readonly Rule[], userAgent: string) =>
  rules.find(([pattern]) => pattern.test(userAgent))?.[1];

/**
 * A short, human label of the device a request comes from (« iPhone ·
 * Safari », « Windows · Edge »), read from its User-Agent: names a passkey
 * or a session in « MON COMPTE ». Unknown platform: « APPAREIL INCONNU ».
 */
export function deviceLabel(userAgent: string | null | undefined): string {
  const agent = userAgent ?? "";
  const platform = find(PLATFORMS, agent);
  if (platform === undefined) {
    return UNKNOWN_DEVICE;
  }
  const browser = find(BROWSERS, agent);
  return browser === undefined ? platform : `${platform} · ${browser}`;
}
