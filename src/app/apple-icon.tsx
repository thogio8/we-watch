import { ticketIcon } from "@/features/pwa/TicketIcon";

/** iOS home screen icon; iOS rounds the corners itself. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return ticketIcon({ size: size.width });
}
