import { MAX_NAMES } from "./attribution";

/** « BECCA LE VEUT », « LÉA ET HUGO LE VEULENT », « 9 MEMBRES LE VEULENT »; null when nobody else does. */
export function wishBanner(otherNames: readonly string[]): string | null {
  const n = otherNames.length;
  if (n === 0) return null;
  if (n > MAX_NAMES) return `${n} MEMBRES LE VEULENT`;
  const names = otherNames.map((name) => name.toLocaleUpperCase("fr"));
  if (n === 1) return `${names[0]} LE VEUT`;
  return `${names.slice(0, -1).join(", ")} ET ${names[n - 1]} LE VEULENT`;
}
