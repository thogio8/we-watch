"use client";

import type { GroupSummary } from "@/domain/group";
import { cx } from "@/ui/cx";
import type { CreateGroupResult } from "./actions";
import { GroupPanel } from "./GroupPanel";
import styles from "./GroupPill.module.css";
import { useGroupPanel } from "./useGroupPanel";

interface GroupPillProps {
  active: GroupSummary;
  groups: GroupSummary[];
  choose: (groupId: string) => Promise<void>;
  create: (formData: FormData) => Promise<CreateGroupResult>;
}

/**
 * « ● NOUS DEUX ▾ » above the screen title (option A): the displayed group,
 * and the panel to switch, create one or sign out.
 */
export function GroupPill({ active, groups, choose, create }: GroupPillProps) {
  const panel = useGroupPanel({ activeId: active.id, choose });
  const { pillRef } = panel.refs;

  return (
    <div
      className={cx(styles.group, panel.open && styles.open)}
      onBlur={panel.onBlur}
    >
      <button
        ref={pillRef}
        type="button"
        className={styles.pill}
        aria-haspopup="dialog"
        aria-expanded={panel.open}
        aria-controls={panel.panelId}
        onClick={panel.toggle}
      >
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.name}>
          <span className={styles.hidden}>Groupe affiché :</span> {active.name}
        </span>
        <span aria-hidden="true">{panel.open ? "▴" : "▾"}</span>
      </button>
      {panel.open && (
        <>
          {/* A touch beside the panel lands here and closes it. */}
          <div className={styles.scrim} aria-hidden="true" />
          <GroupPanel
            id={panel.panelId}
            active={active}
            groups={groups}
            panel={panel}
            create={create}
          />
        </>
      )}
    </div>
  );
}

/** Keeps the pill's room while the page loads, so nothing jumps. */
export function GroupPillFallback() {
  return <div className={styles.group} aria-hidden="true" />;
}
