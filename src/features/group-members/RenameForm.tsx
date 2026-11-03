"use client";

import type { RenameResult } from "@/features/groups/actions";
import { GroupNameForm } from "@/features/groups/GroupNameForm";
import { RENAME_FAILED } from "./messages";

interface RenameFormProps {
  name: string;
  rename: (formData: FormData) => Promise<RenameResult>;
  onDone: () => void;
}

/** « NOM DU GROUPE », filled in, then « RENOMMER ». */
export function RenameForm({ name, rename, onDone }: RenameFormProps) {
  return (
    <GroupNameForm
      send={rename}
      submitLabel="RENOMMER"
      failure={RENAME_FAILED}
      defaultName={name}
      onDone={onDone}
    />
  );
}
