"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { canShare, type ShareOutcome, shareOrCopy } from "./share";

interface InviteLinkActions {
  /** inviteLink: the first call creates the token, hence after mounting. */
  load: () => Promise<string>;
  regenerate: () => Promise<string>;
}

const never = () => () => {};

/**
 * The group's link, asked for once mounted (no write while the server
 * renders), then shared or copied; a failed load is retried by the button.
 */
export function useInviteLink({ load, regenerate }: InviteLinkActions) {
  const [link, setLink] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [sharing, setSharing] = useState(false);
  const busy = useRef(false);
  // Known in the browser only: the server renders the copy button.
  const shareable = useSyncExternalStore(
    never,
    () => canShare(navigator),
    () => false,
  );

  const received = useCallback((url: string) => {
    setLink(url);
    setLoadFailed(false);
    return url;
  }, []);
  const failed = useCallback(() => {
    setLoadFailed(true);
    return null;
  }, []);

  useEffect(() => {
    load().then(received, failed);
  }, [load, received, failed]);

  async function share() {
    if (busy.current) return;
    busy.current = true;
    setSharing(true);
    setOutcome(null);
    const url = link ?? (await load().then(received, failed));
    if (url !== null) setOutcome(await shareOrCopy(url, navigator));
    busy.current = false;
    setSharing(false);
  }

  /** « RÉGÉNÉRER », confirmed: the old link stops working. */
  async function regenerated() {
    setLink(await regenerate());
    setOutcome(null);
  }

  return {
    link,
    shareable,
    loadFailed,
    copied: outcome === "copied",
    shownInClear: outcome === "failed",
    /** Nothing to share until the link came (or failed: retried then). */
    ready: !sharing && (link !== null || loadFailed),
    share,
    regenerated,
  };
}
