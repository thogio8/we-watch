import { ticketIcon } from "@/features/pwa/TicketIcon";

/**
 * Android maskable icon for the manifest. A plain route handler rather than
 * an `icon` file: it must not be advertised as a tab icon in <head>.
 */
export function GET() {
  return ticketIcon({ size: 512, maskable: true });
}
