# WeWatch 2.0 · Morceau 3 : invitations et membres · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Chaque groupe a un lien d'invitation, que tout membre peut copier, partager ou régénérer.
- Ouvrir ce lien permet de créer un compte (même quand les inscriptions sont fermées) ou de se connecter, puis de rejoindre le groupe.
- Un écran « MEMBRES ET INVITATION » permet de renommer le groupe, de voir les membres, de retirer un membre et de quitter le groupe.
- Un groupe disparaît avec son dernier membre.

**Architecture:**
- **Le lien.** Le jeton d'invitation est une colonne `invite_token` (unique) de `app_group`. Il est créé à la demande et remplacé quand on le régénère.
- **La page `/invitation/<jeton>`** est publique, comme `/connexion` : le proxy la laisse passer. Elle a quatre états : lien invalide, pas de compte, connecté sans être membre, déjà membre.
- **Créer un compte par une invitation.** Le ticket d'inscription signé du morceau 1 porte le groupe : `invite: groupId`. `afterVerification` crée l'appartenance **dans la transaction d'inscription**, comme le fait déjà le code propriétaire pour « NOUS DEUX ».
- **Partir ou retirer un membre.** Une seule transaction supprime l'appartenance, puis les « voulu » de ce membre dans ce groupe, puis le groupe s'il n'a plus de membre.

**Tech Stack:** Next.js 16.4, Drizzle 0.45 + libSQL, Better Auth 1.7.14 (passkey), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-wewatch-v2-design.md` §6 (groupes), §7 (invitations), §9 (écrans « Invitation » et « Groupe »), §12 (sécurité), §13 morceau 3.

**Branche :** `feat/v2-invitations`, partie de `release/2.0.0` (morceaux 1 et 2 fusionnés). Une PR vers `release/2.0.0` à la fin.

## Décisions du mainteneur (2026-10-29)

1. **Quand un membre quitte un groupe ou en est retiré**, ses « voulu » sur les films de ce groupe disparaissent. Ses ajouts et ses « marqué par » restent, avec son prénom tant que son compte existe.
2. **Un groupe dont le dernier membre part est supprimé**, avec sa liste.
   - « NOUS DEUX » sans membre (avant qu'un propriétaire le rejoigne) n'est jamais concerné, car personne ne le quitte.
3. **Ouvrir un lien d'invitation fait basculer sur ce groupe**, comme en créer un : cookie `ww_group` posé et `lastUsedAt` mis à jour.

## Global Constraints

- **Jeton d'invitation :**
  - 32 octets aléatoires (`crypto.getRandomValues`) encodés en base64url, soit 43 caractères ;
  - colonne `app_group.invite_token`, texte nullable, avec un **index unique** ;
  - créé à la première demande (`ensureInvite`, idempotent : `UPDATE … WHERE invite_token IS NULL`) ;
  - régénérer le remplace : l'ancien lien ne marche plus ;
  - le jeton n'apparaît jamais dans un log.
- **Lien :** `` `${BETTER_AUTH_URL}/invitation/${token}` ``, l'origine venant de l'environnement et non de la requête.
- **Migration 0008** : additive. Elle ajoute la colonne et l'index unique. Elle ne touche ni `movies` ni les migrations 0000 à 0007.
- **Règle de validation :** un jeton bien formé correspond à `^[A-Za-z0-9_-]{43}$`. Tout le reste répond « CE LIEN N'EST PLUS VALABLE » sans interroger la base.
- **Inscription :**
  - en mode `invite`, un compte se crée **seulement** avec une invitation valide ou le code propriétaire ;
  - en mode `open`, une invitation est aussi acceptée ;
  - le ticket signé porte `invite: string | null` (id du groupe, résolu depuis le jeton au moment de `prepareSignup`) ;
  - si le groupe a été supprimé entre-temps, l'inscription réussit sans appartenance ;
  - un jeton régénéré entre `prepareSignup` et la vérification (moins de 10 min) est accepté : le ticket reste valable jusqu'à son expiration.
- **Autorisations :**
  - tout membre peut renommer, régénérer le lien, retirer un membre (lui compris, ce qui revient à quitter) et quitter ;
  - chaque action commence par `assertMember(groupId)`, sauf `joinGroup(token)`, qui commence par `assertSignedIn()` puis résout le jeton.
- **Revalidation :**
  - renommer → `revalidateGroupPages()` (la pastille de SWIPER change aussi) ;
  - rejoindre, quitter, retirer → `revalidateGroupPages()` + `revalidatePath("/groupe")` ;
  - régénérer → `revalidatePath("/groupe")`.
- **Après avoir quitté :** le cookie qui pointe vers ce groupe est ignoré (`getActiveGroup` le vérifie déjà) et l'action le supprime. Sans groupe restant, on arrive sur « CRÉER TON PREMIER GROUPE ».
- **Textes** (MAJUSCULES, typographie française ’ « ») :
  - « MEMBRES ET INVITATION », « NOM DU GROUPE », « RENOMMER », « MEMBRES », « toi », « depuis le 23/10 » ;
  - « COPIER LE LIEN D’INVITATION », « LIEN COPIÉ », « PARTAGER », « RÉGÉNÉRER LE LIEN » ;
  - « L’ANCIEN LIEN NE MARCHERA PLUS. RÉGÉNÉRER ? », « RETIRER », « RETIRER LÉA DU GROUPE ? », « QUITTER LE GROUPE », « QUITTER « NOM » ? » ;
  - si l'on est le dernier membre, l'action de quitter montre « TU ES LE DERNIER MEMBRE : LE GROUPE ET SA LISTE SERONT SUPPRIMÉS. » ;
  - « TU ES INVITÉ·E DANS « NOM » », « REJOINDRE », « TU ES DÉJÀ DANS « NOM » », « Y ALLER », « CE LIEN N’EST PLUS VALABLE ».
- **Partage :**
  - `navigator.share` quand il existe (mobile), sinon `navigator.clipboard.writeText` ;
  - si les deux échouent, le lien est affiché en clair, sélectionnable.
- **Règles du dépôt** (`CLAUDE.md`) : couches ESLint, 200 lignes, jscpd/knip, couverture 100 %, DA riso et tokens, axe, captures regardées, commits Conventional **sans trailer ni mention d'IA**. Aucune migration sur `main` avant la bascule.

## Review Focus

1. **Lien forgé, ancien (régénéré), d'un groupe supprimé, ou malformé** (longueur, caractères, encodage) : « CE LIEN N’EST PLUS VALABLE », sans appartenance créée ni groupe révélé. → Tâches 1, 3 et 4.
2. **Inscription par invitation en mode `invite`** : autorisée avec un jeton valide, refusée sans ou avec un jeton invalide. Un ticket rejoué ne crée qu'un compte et une appartenance. Un échec après l'insertion annule tout. → Tâche 3.
3. **Un membre retiré** perd l'accès tout de suite : ses actions sur ce groupe sont refusées et ses pages retombent sur un autre groupe. Il peut revenir par le lien tant qu'il n'est pas régénéré. → Tâches 2 et 6.
4. **Le dernier membre qui part** : le groupe, sa liste, ses « voulu » et ses appartenances disparaissent. Les instantanés partagés et les BOF personnels restent. Un autre groupe qui a les mêmes films n'est pas touché. → Tâche 1.
5. **Deux membres qui quittent en même temps le même groupe à deux** : le groupe disparaît exactement une fois, sans exception ni groupe orphelin. → Tâche 1.

---

### Task 1 : données des invitations et des départs

**Files:**
- Modify: `src/db/group-schema.ts` : `inviteToken: text("invite_token")` + `uniqueIndex("app_group_invite_token_unique")`.
- Create: `drizzle/0008_*.sql` (`npm run db:generate`).
- Modify: `src/db/groups.ts` (+ test). Si le fichier dépasse 200 lignes, sortir les invitations dans `src/db/invitations.ts`.
- Modify: `src/domain/group.ts` (+ test) : `INVITE_TOKEN_PATTERN` et `isInviteToken(value: unknown): value is string`.
- Modify: `tests/functional` + `tests/helpers/functional.ts` : `reset()` supprime aussi les utilisateurs créés par `aUser` (report du morceau 2).

**Interfaces (Produces)** — ajoutées à `Groups` :
- `ensureInvite(groupId): Promise<string>` : renvoie le jeton existant ou en crée un.
- `regenerateInvite(groupId): Promise<string>`.
- `findByInvite(token): Promise<{ id: string; name: string } | null>`.
- `join(groupId, userId, now?): Promise<"joined" | "already">` : insertion qui ignore le conflit, `lastUsedAt = now`.
- `rename(groupId, name): Promise<void>`.
- `membersOf(groupId): Promise<{ userId: string; name: string; joinedAt: Date }[]>`, triés par `joinedAt` croissant.
- `leave(groupId, userId): Promise<"left" | "group_deleted" | "not_member">`. Dans **une** transaction :
  1. supprimer l'appartenance ;
  2. supprimer les `movie_want` de ce membre dans ce groupe ;
  3. s'il ne reste aucun membre, supprimer le groupe (les cascades emportent `group_movie` et `movie_want`).

  La suppression des enfants est **explicite**, sans compter sur `PRAGMA foreign_keys` (report de la relecture globale du morceau 2).

- [ ] **Step 1 : tests en échec.**
  - `ensureInvite` : deux appels donnent le même jeton de 43 caractères ; deux groupes ont deux jetons différents.
  - `regenerateInvite` : nouveau jeton, et l'ancien ne se trouve plus (`findByInvite(ancien)` renvoie `null`).
  - `join` : `"already"` au second appel, une seule ligne.
  - `leave` :
    - les « voulu » du partant disparaissent, ceux des autres restent, ainsi que ses ajouts (avec son prénom) ;
    - le dernier membre qui part fait disparaître le groupe, ses lignes et ses « voulu », alors que les instantanés et les BOF restent, et qu'un autre groupe avec les mêmes films est intact ;
    - `"not_member"` pour un non-membre, sans aucune écriture ;
    - deux départs concurrents d'un groupe à deux membres (simulés comme au morceau 2 : trigger TEMP ou deux transactions) suppriment le groupe une seule fois, sans exception.
  - `isInviteToken` : 43 caractères base64url acceptés ; 42, 44, `+`, `/`, `=`, espace, nombre et `null` refusés.
  - Migration : 0008 est additive (aucun `ALTER`/`DROP` sur une table existante, en dehors de `ADD COLUMN` et `CREATE UNIQUE INDEX`), et le test de migration en deux temps passe avec 9 migrations.
- [ ] **Step 2 :** `npx vitest run src/db src/domain`. Attendu : FAIL.
- [ ] **Step 3 : implémenter.** `npm run db:generate`, puis `npm run db:migrate` en local.
- [ ] **Step 4 :** relancer, puis `npm run ci:checks`. Attendu : vert.
- [ ] **Step 5 : commit** `feat(db): invite links and leaving a group`.

### Task 2 : actions des groupes

**Files:**
- Modify: `src/features/groups/actions.ts` (+ test).
- Modify: `src/server/groups.ts` : `forgetGroup()` supprime le cookie si c'est ce groupe.
- Modify: `tests/functional/groups.test.ts` et `tests/functional/isolation.test.ts`.

**Interfaces (Produces):**
- `renameGroup(groupId: string, formData: FormData): Promise<{ ok: true } | { ok: false; error: string }>` : `parseGroupName`, sinon « UN NOM DE 1 À 30 CARACTÈRES ».
- `regenerateInvite(groupId: string): Promise<string>` : renvoie le nouveau lien complet.
- `inviteLink(groupId: string): Promise<string>` : lecture, mais en action, car elle peut créer le jeton.
- `removeMember(groupId: string, userId: string): Promise<void>` : `userId` validé (chaîne de 1 à 64 caractères). Retirer un non-membre est un no-op.
- `leaveGroup(groupId: string): Promise<void>` : équivaut à `removeMember(groupId, moi)`. Si le cookie pointe vers ce groupe, il est supprimé.
- `joinGroup(token: string): Promise<{ ok: true; groupId: string } | { ok: false; error: string }>` :
  - commence par `assertSignedIn()`, puis `isInviteToken`, puis `findByInvite` ;
  - lien invalide → « CE LIEN N’EST PLUS VALABLE » ;
  - sinon `join`, puis `rememberGroup`, `touch` et la revalidation.

- [ ] **Step 1 : tests en échec.**
  - Ordre : chaque action appelle `assertMember` (ou `assertSignedIn` pour `joinGroup`) **avant** toute validation ou lecture.
  - Isolation (vraie base) : les 5 nouvelles actions sur un groupe étranger ou un id forgé lèvent l'exception, et les tables du groupe B sont inchangées.
  - Fonctionnels :
    - Hugo retire Léa → Léa n'est plus membre, et `decideSwipe(groupe, …)` de Léa est refusé ;
    - le dernier qui quitte → le groupe disparaît, et `getActiveGroup` de ce compte renvoie `group: null` ;
    - `joinGroup` avec un lien valide → membre, cookie posé ; avec un lien régénéré → refus, sans écriture ;
    - renommer → `groupsOf` donne le nouveau nom.
- [ ] **Step 2 :** lancer ces fichiers. Attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 :** `npm run ci:checks`. Attendu : vert.
- [ ] **Step 5 : commit** `feat(groups): rename, invite, remove and leave`.

### Task 3 : créer son compte par une invitation

**Files:**
- Modify: `src/access/paths.ts` (`INVITATION_PREFIX = "/invitation/"`) et `src/access/decision.ts` (+ test) : `GET` et `POST` sous ce préfixe sont publics. `/invitation` seul et `/invitations…` ne le sont pas.
- Modify: `src/access/signup.ts` (+ test) : `signupRight` accepte `invited: boolean`. En mode `invite`, `invited` autorise ; le propriétaire reste prioritaire.
- Modify: `src/access/signup-ticket.ts` (+ test) : le payload gagne `invite: string | null` (schéma zod strict, id non vide de 64 caractères au plus).
- Modify: `src/features/signin/actions.ts` (+ test) : `prepareSignup` lit le champ `invite` (jeton). S'il est valide, il le résout en id de groupe et met `invited: true`. Un jeton invalide donne « CE LIEN N’EST PLUS VALABLE ».
- Modify: `src/auth/passkey-signup.ts` et `src/auth/legacy-group-join.ts`, ou un nouveau `src/auth/group-join.ts` qui généralise `joinLegacyGroup` en `joinGroupInSignup(adapter, groupId, userId)` (+ tests). Après `createUser`, si `invite` est présent et que le groupe existe, on crée l'appartenance dans la même transaction. Si le ticket porte aussi `owner`, on rejoint les deux groupes.

- [ ] **Step 1 : tests en échec.**
  - Décision du proxy : `/invitation/<43>` (GET et POST) est autorisé sans session ; `/invitation` et `/invitationsx/…` ne le sont pas.
  - `signupRight` : la table complète (`open`/`invite` × invité ou non × code bon, mauvais ou absent).
  - Ticket : `invite` relu, forgé (signature), ou de forme invalide → `null`.
  - Fonctionnels avec la vraie cérémonie (`tests/helpers/webauthn.ts`) :
    - en mode `invite`, une inscription par invitation donne un compte membre du groupe, qui devient son groupe affiché ;
    - sans invitation → refus ;
    - un jeton régénéré avant `prepareSignup` → refus ;
    - un groupe supprimé entre la préparation et la vérification → compte créé sans appartenance ;
    - un ticket rejoué → une seule appartenance ;
    - un identifiant de passkey en double après l'insertion de l'appartenance → tout est annulé.
- [ ] **Step 2 :** lancer. Attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 :** `npm run ci:checks`. Attendu : vert.
- [ ] **Step 5 : commit** `feat(auth): sign up through an invite link`.

### Task 4 : page `/invitation/[token]`

**Files:**
- Create: `src/app/invitation/[token]/page.tsx`, qui passe la promesse `params` à un composant sous `<Suspense>` (§ pièges Next 16 de `CLAUDE.md`).
- Create: `src/features/invitation/` : `InvitationScreen.tsx` et ses vues, `load.ts` (+ test), CSS et tests RTL.
- Modify: `src/features/signin/` : `SigninScreen` accepte un `invite?: { token: string; groupName: string }`. Dans ce cas :
  - le titre devient « TU ES INVITÉ·E DANS « NOM » » ;
  - « CRÉER UN COMPTE » est disponible même en mode `invite`, et le formulaire envoie le jeton ;
  - « SE CONNECTER » ramène sur le lien après la connexion (`window.location.replace(lien)`).

**Interfaces:**
- `loadInvitation(token: unknown): Promise<{ state: "invalid" } | { state: "signed_out"; groupName } | { state: "join"; groupName } | { state: "member"; groupId; groupName }>`. Il ne révèle jamais rien d'un lien invalide.
- États de l'écran :
  - `invalid` : « CE LIEN N’EST PLUS VALABLE » et un lien vers l'accueil ;
  - `signed_out` : l'écran de connexion en variante invitation ;
  - `join` : « TU ES INVITÉ·E DANS « NOM » » et « REJOINDRE » (`joinGroup`) ;
  - `member` : « TU ES DÉJÀ DANS « NOM » » et « Y ALLER » (`chooseGroup`).

  Après rejoindre ou Y aller, on va sur `/`.

- [ ] **Step 1 : tests en échec.** `load.test.ts` couvre les 4 états, un jeton malformé (sans aucun appel à la base) et un jeton régénéré. Les tests RTL couvrent chaque état et son bouton (double clic : un seul appel).
- [ ] **Step 2 :** lancer. Attendu : FAIL.
- [ ] **Step 3 : implémenter** dans la DA du ticket (`/connexion`). Vérifier dans un navigateur à 320×568, 390×844, 844×390 et 1280×800.
- [ ] **Step 4 :** `npm run ci:checks` et `npm run test:e2e`. Attendu : vert, captures existantes inchangées.
- [ ] **Step 5 : commit** `feat(invitation): join a group from its link`.

### Task 5 : écran « MEMBRES ET INVITATION »

**Files:**
- Create: `src/app/groupe/page.tsx`, qui lit le groupe affiché sous `<Suspense>` (premier groupe si besoin).
- Create: `src/features/group-members/` : `GroupScreen.tsx`, `RenameForm.tsx`, `MemberList.tsx`, `InviteLink.tsx`, `LeaveGroup.tsx`, `useConfirm.ts` si utile, plus CSS et tests RTL.
- Modify: `src/features/groups/GroupPanel.tsx` (+ test) : l'entrée « MEMBRES ET INVITATION » mène à `/groupe` et ferme le panneau.

**Interfaces:**
- `GroupScreen({ group: GroupSummary; me: string; members: { userId; name; joinedAt }[]; actions })`, avec les actions de la tâche 2 liées par `.bind(null, group.id)`.
- Le lien est obtenu par `inviteLink`, appelé au montage côté client, pour ne pas écrire pendant le rendu serveur.
- Chaque action destructive (retirer, quitter, régénérer) demande une **confirmation dans la DA** (un ticket de confirmation), jamais `window.confirm`.
- Après avoir quitté : redirection vers `/` (`window.location.replace`).

- [ ] **Step 1 : tests RTL en échec.**
  - Le nom est affiché et renommable : une erreur ne déclenche aucun appel.
  - Membres : « toi » sur moi, « depuis le 23/10 », pas de « RETIRER » sur moi (c'est « QUITTER LE GROUPE »).
  - Copier : `navigator.share` est appelé s'il existe, sinon `clipboard.writeText`, et « LIEN COPIÉ » s'affiche. Si les deux échouent, le lien s'affiche en clair.
  - Régénérer, retirer et quitter passent par une confirmation, et annuler n'appelle rien.
  - Dernier membre : l'avertissement de suppression s'affiche.
  - Le panneau mène à `/groupe`.
- [ ] **Step 2 :** lancer. Attendu : FAIL.
- [ ] **Step 3 : implémenter** dans la DA. axe et dépassements sur les 6 formats, comme au morceau 2.
- [ ] **Step 4 :** `npm run ci:checks`. Attendu : vert.
- [ ] **Step 5 : commit** `feat(groups): members and invite link screen`.

### Task 6 : e2e, captures, docs

**Files:** `e2e/invitations.spec.ts`, `e2e/fixtures.ts` (une fixture `visitor` connectée à un authentificateur virtuel), `e2e/visual.spec.ts`, `e2e/layout.spec.ts`, `CLAUDE.md`, `README.md`, `docs/coverage.md`.

Scénarios :
- « Hugo crée son compte par le lien de Léa et voit la liste du groupe » : deuxième contexte, Face ID virtuel ;
- « un lien régénéré ne marche plus » ;
- « Léa retire Hugo : il ne voit plus le groupe » ;
- « le dernier membre quitte : le groupe disparaît, on arrive sur CRÉER TON PREMIER GROUPE » ;
- « un membre déjà dans le groupe qui ouvre le lien y bascule » ;
- « renommer le groupe change la pastille sur TIRER, SWIPER et LISTE ».

- [ ] **Step 1 :** écrire les scénarios et les fixtures, puis `npm run test:e2e`. Attendu : PASS.
- [ ] **Step 2 : captures.**
  - Ajouter `8-groupe` (écran membres), `8b-groupe-quitter` (confirmation), `9-invitation` (déconnecté) et `9b-invitation-rejoindre` (connecté), pour chaque format.
  - axe sur ces écrans.
  - Le panneau change, avec l'entrée « MEMBRES ET INVITATION » : régénérer `7-groupes-panneau`.
  - **Regarder** chaque image nouvelle ou modifiée et décrire ce qu'on y voit.
- [ ] **Step 3 : docs.**
  - `CLAUDE.md` : invitations (jeton, page publique, préfixe du proxy), départs (transaction explicite), revalidation.
  - `README.md` : inviter, rejoindre, quitter ; le mode `invite`.
  - `docs/coverage.md` : régénéré.
- [ ] **Step 4 :** `npm run ci`. Attendu : tout vert.
- [ ] **Step 5 : commits** `test(e2e): invite, join, remove and leave`, puis `docs: describe invitations`. Pas de push : le contrôleur ouvre la PR.

## Hors de ce morceau

- **Morceau 4 :** Google.
- **Morceau 5 :**
  - Mon compte, suppression du compte (qui réutilise `leave` pour chaque groupe) ;
  - effacer `ww_group` à la déconnexion ;
  - index `movie_want(user_id)`.
- **Morceau 6 :**
  - limites de tentatives : rejoindre par lien, création de groupes, inscription ;
  - sauvegarde des comptes, chiffrée ;
  - `PRAGMA foreign_keys` sur Turso ;
  - procédure de restauration et rattrapage de la bascule ;
  - test de fumée enrichi ; bascule.
