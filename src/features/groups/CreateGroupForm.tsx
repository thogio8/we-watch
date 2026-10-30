"use client";

import type { CreateGroupResult } from "./actions";
import { GroupNameForm } from "./GroupNameForm";
import { CREATE_FAILED } from "./messages";

interface CreateGroupFormProps {
  create: (formData: FormData) => Promise<CreateGroupResult>;
  /** The group exists and is now the displayed one. */
  onCreated?: (groupId: string) => void;
}

/** « NOM DU GROUPE » then « CRÉER LE GROUPE ». */
export function CreateGroupForm({ create, onCreated }: CreateGroupFormProps) {
  return (
    <GroupNameForm
      send={create}
      submitLabel="CRÉER LE GROUPE"
      failure={CREATE_FAILED}
      onDone={(result) => onCreated?.(result.groupId)}
    />
  );
}
