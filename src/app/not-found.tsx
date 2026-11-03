import { ButtonLink } from "@/ui/ButtonLink";
import { StatusPage } from "./StatusPage";

/** Any address the app does not know, in its own colours and language. */
export default function NotFound() {
  return (
    <StatusPage stamp="404" title="RIEN À L’AFFICHE ICI">
      <ButtonLink href="/" variant="primary">
        ALLER À L’ACCUEIL
      </ButtonLink>
    </StatusPage>
  );
}
