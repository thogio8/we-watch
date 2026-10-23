import { ticketIcon } from "@/features/pwa/TicketIcon";

const SIZES = [32, 192, 512] as const;

/** Browser tab icon (32) and the manifest icons (192, 512): /icon/<size>. */
export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return ticketIcon({ size: Number(await id) });
}
