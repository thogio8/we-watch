"use client";

import { Button } from "@/ui/Button";
import { ConfirmButton } from "@/ui/ConfirmButton";
import styles from "./GroupScreen.module.css";
import {
  COPY_FAILED,
  LINK_FAILED,
  REGENERATE_FAILED,
  REGENERATE_QUESTION,
} from "./messages";
import { useInviteLink } from "./useInviteLink";

interface InviteLinkProps {
  load: () => Promise<string>;
  regenerate: () => Promise<string>;
}

/**
 * « COPIER LE LIEN D’INVITATION » (« PARTAGER » on a phone), the link in
 * clear when neither works, and « RÉGÉNÉRER LE LIEN » once confirmed.
 */
export function InviteLink({ load, regenerate }: InviteLinkProps) {
  const invite = useInviteLink({ load, regenerate });

  return (
    <div className={styles.invite}>
      <Button
        variant="primary"
        className={styles.wide}
        disabled={!invite.ready}
        onClick={invite.share}
      >
        {invite.shareable ? "PARTAGER" : "COPIER LE LIEN D’INVITATION"}
      </Button>
      <p className={styles.status} role="status">
        {invite.copied && "LIEN COPIÉ"}
      </p>
      {invite.loadFailed && (
        <p className={styles.alert} role="alert">
          {LINK_FAILED}
        </p>
      )}
      {invite.shownInClear && (
        <>
          <p className={styles.alert} role="alert">
            {COPY_FAILED}
          </p>
          <p className={styles.link}>{invite.link}</p>
        </>
      )}
      <ConfirmButton
        label="RÉGÉNÉRER LE LIEN"
        question={REGENERATE_QUESTION}
        confirmLabel="RÉGÉNÉRER"
        action={invite.regenerated}
        failure={REGENERATE_FAILED}
      />
    </div>
  );
}
