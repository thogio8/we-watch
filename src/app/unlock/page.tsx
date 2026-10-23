import type { Metadata } from "next";
import { UnlockScreen } from "@/features/unlock/UnlockScreen";

export const metadata: Metadata = { title: "Entrer · we-watch" };

export default function UnlockPage() {
  return <UnlockScreen />;
}
