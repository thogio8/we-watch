import type { Metadata } from "next";
import { APP_NAME } from "@/features/pwa/brand";
import { UnlockScreen } from "@/features/unlock/UnlockScreen";

export const metadata: Metadata = { title: `Entrer · ${APP_NAME}` };

export default function UnlockPage() {
  return <UnlockScreen />;
}
