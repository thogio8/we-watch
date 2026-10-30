"use client";

import { parseGroupName } from "@/domain/group";
import { LabelForm, type LabelFormProps } from "@/ui/LabelForm";
import { GROUP_NAME_ERROR } from "./messages";

type Result = { ok: true } | { ok: false; error: string };

/** « NOM DU GROUPE » then its button: creating (panel, first group screen) or renaming. */
export function GroupNameForm<R extends Result>(
  props: Omit<LabelFormProps<R>, "label" | "parse" | "invalid">,
) {
  return (
    <LabelForm
      {...props}
      label="NOM DU GROUPE"
      parse={parseGroupName}
      invalid={GROUP_NAME_ERROR}
    />
  );
}
