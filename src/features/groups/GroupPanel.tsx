"use client";

import Link from "next/link";
import { useId } from "react";
import type { GroupSummary } from "@/domain/group";
import { SignOutButton } from "@/features/signin/SignOutButton";
import { cx } from "@/ui/cx";
import type { CreateGroupResult } from "./actions";
import { CreateGroupForm } from "./CreateGroupForm";
import styles from "./GroupPanel.module.css";
import { membersLabel } from "./messages";
import type { useGroupPanel } from "./useGroupPanel";

interface GroupPanelProps {
  id: string;
  active: GroupSummary;
  groups: GroupSummary[];
  panel: ReturnType<typeof useGroupPanel>;
  create: (formData: FormData) => Promise<CreateGroupResult>;
}

/**
 * The white ticket under the pill: my groups, a new one, the displayed
 * group's members and invite link, my account, signing out.
 */
export function GroupPanel({
  id,
  active,
  groups,
  panel,
  create,
}: GroupPanelProps) {
  const titleId = useId();
  const formId = useId();
  const { panelRef, activeRef } = panel.refs;

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-labelledby={titleId}
      className={styles.panel}
    >
      <h2 id={titleId} className={styles.title}>
        TES GROUPES
      </h2>
      <ul className={styles.groups}>
        {groups.map((group) => {
          const current = group.id === active.id;
          return (
            <li key={group.id}>
              <button
                ref={current ? activeRef : undefined}
                type="button"
                className={styles.item}
                aria-current={current || undefined}
                disabled={panel.pending}
                onClick={() => panel.pick(group.id)}
              >
                <span className={styles.name}>
                  {current && <span aria-hidden="true">● </span>}
                  {group.name}
                </span>
                <small className={styles.members}>
                  {membersLabel(group.memberCount)}
                  {current && <span aria-hidden="true"> ✓</span>}
                </small>
              </button>
            </li>
          );
        })}
      </ul>
      {panel.error !== null && (
        <p className={styles.error} role="alert">
          {panel.error}
        </p>
      )}
      <button
        type="button"
        className={cx(styles.item, styles.add)}
        aria-expanded={panel.creating}
        aria-controls={formId}
        onClick={panel.toggleCreating}
      >
        + CRÉER UN GROUPE
      </button>
      {panel.creating && (
        <div id={formId} className={styles.create}>
          <CreateGroupForm create={create} onCreated={panel.created} />
        </div>
      )}
      <Link href="/groupe" className={styles.item} onClick={panel.followed}>
        MEMBRES ET INVITATION
      </Link>
      <Link href="/compte" className={styles.item} onClick={panel.followed}>
        MON COMPTE
      </Link>
      <div className={styles.signOut}>
        <SignOutButton />
      </div>
    </div>
  );
}
