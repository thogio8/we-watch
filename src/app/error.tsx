"use client";

import { leaveIfRefused } from "@/access/refusals";
import { useEffect } from "react";
import { Button } from "@/ui/Button";
import { StatusPage } from "./StatusPage";

interface ErrorPageProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  // An action refused (no session, no membership) that nothing caught.
  useEffect(() => leaveIfRefused(error), [error]);
  return (
    <StatusPage stamp="HORS SERVICE" title="OUPS, LA BOBINE A SAUTÉ">
      <Button variant="primary" onClick={() => retry()}>
        RÉESSAYER
      </Button>
    </StatusPage>
  );
}
