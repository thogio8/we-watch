"use client";

import type { JoinGroupResult } from "@/features/groups/actions";
import { CHOOSE_FAILED } from "@/features/groups/messages";
import { invitedTitle } from "@/features/signin/messages";
import { SigninScreen } from "@/features/signin/SigninScreen";
import { TicketPage } from "@/features/signin/TicketPage";
import type { PrepareSignup } from "@/features/signin/useSignin";
import { ButtonLink } from "@/ui/ButtonLink";
import { InvitationChoice } from "./InvitationChoice";
import type { Invitation } from "./load";
import { INVALID_TITLE, JOIN_FAILED, memberTitle } from "./messages";

export interface InvitationActions {
  /** joinGroup, bound by the page to the link's token. */
  join: () => Promise<JoinGroupResult>;
  choose: (groupId: string) => Promise<void>;
  prepareSignup: PrepareSignup;
}

interface InvitationScreenProps {
  invitation: Invitation;
  /** From the link's path: sent along when an account is created. */
  token: string;
  signup: "open" | "invite";
  actions: InvitationActions;
}

/** `/invitation/<token>`: what the link opens, depending on who opens it. */
export function InvitationScreen({
  invitation,
  token,
  signup,
  actions,
}: InvitationScreenProps) {
  switch (invitation.state) {
    case "invalid":
      return (
        <TicketPage title={INVALID_TITLE} error={null}>
          <ButtonLink href="/" variant="secondary">
            ALLER À L’ACCUEIL
          </ButtonLink>
        </TicketPage>
      );
    case "signed_out":
      return (
        <SigninScreen
          signup={signup}
          prepareSignup={actions.prepareSignup}
          invite={{ token, groupName: invitation.groupName }}
        />
      );
    case "join":
      return (
        <InvitationChoice
          title={invitedTitle(invitation.groupName)}
          label="REJOINDRE"
          confirm={async () => {
            const joined = await actions.join();
            return joined.ok ? null : joined.error;
          }}
          failure={JOIN_FAILED}
        />
      );
    case "member":
      return (
        <InvitationChoice
          title={memberTitle(invitation.groupName)}
          label="Y ALLER"
          confirm={async () => {
            await actions.choose(invitation.groupId);
            return null;
          }}
          failure={CHOOSE_FAILED}
        />
      );
  }
}
