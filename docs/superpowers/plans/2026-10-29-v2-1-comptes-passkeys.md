# WeWatch 2.0 · Morceau 1 : comptes et passkeys · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le code d'accès partagé par de vrais comptes, créés et ouverts avec une passkey (Face ID / empreinte), sans email ni mot de passe. L'appli garde une seule liste, désormais derrière la connexion.

**Architecture:**
- Better Auth stocke comptes, sessions et passkeys dans la base Turso existante (adaptateur Drizzle).
- On crée un compte en une seule cérémonie WebAuthn, dite « passkey d'abord » :
  - une action serveur valide le nom affiché et le droit de s'inscrire, puis signe un « ticket d'inscription » ;
  - le plugin passkey reçoit ce ticket en `context` ;
  - il crée l'utilisateur dans `afterVerification` et ouvre la session.
- Le proxy et chaque action serveur vérifient la session à la place du cookie `ww_access`.

**Tech Stack:**
- Next.js 16.4 (App Router, Server Actions, `src/proxy.ts`), Drizzle 0.45 + libSQL ;
- `better-auth@1.7.14` et `@better-auth/passkey@1.7.14` ;
- Vitest, Playwright, avec l'authentificateur virtuel WebAuthn de Chromium via CDP.

**Spec:** `docs/superpowers/specs/2026-10-28-wewatch-v2-design.md` (§5, §9 « Connexion » et « Créer un compte », §12, §13 morceau 1, §14). La spec historique `2026-10-23-we-watch-design.md` reste la référence pour la DA.

**Branche :** `feat/v2-comptes`, partie de `release/2.0.0`. Une PR vers `release/2.0.0` à la fin, CI verte.

## Global Constraints

- **Uniquement des services gratuits**, et aucun envoi d'email.
- **Pas de nom de domaine** :
  - `rpID` = nom d'hôte de `BETTER_AUTH_URL` ;
  - `origin` = origine de `BETTER_AUTH_URL`.
- **Session** :
  - cookie httpOnly, `expiresIn` 60 jours, `updateAge` 1 jour ;
  - `cookieCache` de 5 minutes, pour que le proxy n'interroge pas la base à chaque requête.
- **Inscription** :
  - variable `SIGNUP` = `open` | `invite`, défaut `open` ;
  - avec `invite`, on ne peut s'inscrire qu'avec le code propriétaire `OWNER_CODE` (facultatif, au moins 12 caractères). Les invitations arrivent au morceau 3.
- **Nom affiché** : de 1 à 30 caractères après `trim`, espaces internes réduits à un seul.
- **Utilisateur Better Auth** : l'email est obligatoire et unique, on stocke donc `<id>@passkey.invalid`. Le TLD `.invalid` est réservé. Cette adresse n'est jamais affichée.
- **Code d'accès** :
  - il disparaît de l'appli : `ACCESS_CODE` est retiré du schéma d'env, `/unlock`, `ww_access` et `assertUnlocked` sont supprimés ;
  - la variable reste dans Vercel jusqu'en 2.1, car un retour arrière vers la 1.3.x en a besoin.
- **Textes de l'interface** (français, MAJUSCULES, typographie française) : « ENTRE DANS WEWATCH », « SE CONNECTER AVEC FACE ID », « CRÉER UN COMPTE », « WEWATCH SE REJOINT SUR INVITATION », « J'AI UN CODE PROPRIÉTAIRE », « TON PRÉNOM OU SURNOM », « CODE PROPRIÉTAIRE », « CRÉER AVEC FACE ID », « SE DÉCONNECTER ».
- **Règles du dépôt** (`CLAUDE.md`) :
  - couches ESLint ;
  - 200 lignes par fichier, 80 par fonction, complexité 10 ;
  - jscpd et knip propres, couverture ≥ 95/95/95/90 ;
  - DA riso, aucune couleur hors `tokens.css` ;
  - commits Conventional, header seul, sans trailer d'IA.
- Lire `node_modules/next/dist/docs/` avant de toucher au proxy ou aux routes (`AGENTS.md`).

## Review Focus

1. **Session expirée ou cookie forgé** : on revient sur `/connexion` (page) ou on reçoit une 401 (action), jamais une 500. La tâche 5 l'épingle.
2. **Ticket d'inscription rejoué, modifié ou expiré** (10 minutes) : refusé, aucun utilisateur créé. Tâche 3.
3. **Cérémonie annulée** (l'utilisateur ferme la fenêtre Face ID) : on reste sur le formulaire avec « FACE ID ANNULÉ, RÉESSAIE », et aucun compte orphelin n'est créé. L'utilisateur n'est créé qu'après vérification. Tâches 4 et 6.
4. **`SIGNUP=invite` avec un mauvais code propriétaire, ou sans** : refus clair, aucun ticket émis. Tâches 2 et 6.
5. **Les routes `/api/auth/*` et `/connexion` restent joignables sans session**, sinon impossible de se connecter, alors que tout le reste exige une session. Le cron, lui, garde son `CRON_SECRET`. Tâche 5.

---

### Task 1 : dépendances, environnement, tables

**Files:**
- Modify: `package.json` (deps `better-auth@1.7.14`, `@better-auth/passkey@1.7.14`)
- Modify: `src/env.ts`, `src/env.test.ts`
- Create: `src/db/auth-schema.ts` (tables Better Auth : `user`, `session`, `account`, `verification`, `passkey`)
- Modify: `src/db/create-database.ts` (le `schema` passé à drizzle inclut `auth-schema`)
- Create: `drizzle/0002_*.sql` (`npm run db:generate`)
- Modify: `drizzle.config.ts` (`schema: ["src/db/schema.ts", "src/db/auth-schema.ts"]`)
- Modify: `.env.example`

**Interfaces:**
- Produces:
  - `ServerEnv` gagne `BETTER_AUTH_SECRET: string` (≥ 32), `BETTER_AUTH_URL: string` (URL), `SIGNUP: "open" | "invite"` (défaut `"open"`), `OWNER_CODE?: string` (≥ 12, vide = absent) ;
  - `ACCESS_CODE` reste jusqu'à la tâche 5, car le code actuel s'en sert encore ;
  - tables Drizzle exportées par `src/db/auth-schema.ts` : `user`, `session`, `account`, `verification`, `passkey`.

- [ ] **Step 1 : tests d'env en échec** (`src/env.test.ts`). Nouveaux cas :
  - « BETTER_AUTH_SECRET de moins de 32 caractères est refusé » ;
  - « SIGNUP vaut open par défaut » ;
  - « SIGNUP refuse une autre valeur que open ou invite » ;
  - « OWNER_CODE vide équivaut à absent » ;
  - « OWNER_CODE de moins de 12 caractères est refusé » ;

  Mettre à jour l'objet d'env valide commun du fichier.
- [ ] **Step 2 :** `npx vitest run src/env.test.ts`. Attendu : FAIL sur les nouveaux cas.
- [ ] **Step 3 : implémenter le schéma zod dans `src/env.ts`.**
  - Réutiliser le motif `optional().transform("" → undefined)` déjà utilisé pour `CRON_SECRET`.
  - Commentaire en anglais sur chaque variable, comme les autres.
- [ ] **Step 4 :** `npx vitest run src/env.test.ts`. Attendu : PASS.
- [ ] **Step 5 : générer le schéma Better Auth.**
  - `npx @better-auth/cli@1.4.21 generate --config <fichier temporaire> --output src/db/auth-schema.ts`.
  - Le fichier temporaire est une config minimale `betterAuth({ database: drizzleAdapter(db, { provider: "sqlite" }), plugins: [passkey()] })` ; ne pas la commiter.
  - Si le CLI échoue, écrire les tables à la main d'après `node_modules/@better-auth/passkey/dist/index-*.d.mts` (schéma `passkey`) et la doc Better Auth « Drizzle schema ».
  - Puis `npm run db:generate`. Attendu : `drizzle/0002_*.sql` crée 5 tables, et ne modifie **pas** `movies` (migration additive).
- [ ] **Step 6 :** `npm run db:migrate` (local), puis `npm run typecheck`. Attendu : OK.
- [ ] **Step 7 : `.env.example`.**
  - Ajouter `BETTER_AUTH_SECRET=` (commentaire : `openssl rand -hex 32`) et `BETTER_AUTH_URL=http://localhost:3000`.
  - Ajouter `SIGNUP=open` et `OWNER_CODE=`, avec un commentaire en français dans le ton du fichier.
- [ ] **Step 8 : commit** `feat(auth): add account tables and auth environment`.

### Task 2 : nom affiché et droit de s'inscrire (logique pure)

**Files:**
- Create: `src/domain/display-name.ts`, `src/domain/display-name.test.ts`
- Create: `src/access/signup.ts`, `src/access/signup.test.ts`

**Interfaces:**
- Produces:
  - `parseDisplayName(input: unknown): string | null` : nom normalisé, ou `null` si invalide ;
  - `type SignupRight = { ok: true; owner: boolean } | { ok: false; reason: "closed" | "wrong_code" }` ;
  - `signupRight(input: { mode: "open" | "invite"; ownerCode?: string; submittedCode?: string }): SignupRight`.

- [ ] **Step 1 : tests en échec.**
  - `parseDisplayName` :
    - `"  Léa  "` → `"Léa"` ;
    - `"Jean   Pierre"` → `"Jean Pierre"` ;
    - `""`, `"   "` et 31 caractères → `null` ;
    - 30 caractères → accepté ;
    - un nombre, `null` ou un `File` → `null`.
  - `signupRight` :
    - `open` sans code → `{ ok: true, owner: false }` ;
    - `open` + bon code → `{ ok: true, owner: true }` ;
    - `open` + mauvais code → `{ ok: false, reason: "wrong_code" }` ;
    - `invite` sans code → `{ ok: false, reason: "closed" }` ;
    - `invite` + bon code → owner ;
    - `invite` sans `OWNER_CODE` configuré mais avec un code soumis → `"closed"`.
- [ ] **Step 2 :** `npx vitest run src/domain/display-name.test.ts src/access/signup.test.ts`. Attendu : FAIL.
- [ ] **Step 3 : implémenter.** La comparaison du code utilise `constantTimeEqual` (`src/access/token.ts`, garder cette fonction).
- [ ] **Step 4 :** relancer. Attendu : PASS.
- [ ] **Step 5 : commit** `feat(auth): validate display names and signup rights`.

### Task 3 : ticket d'inscription signé

**Files:**
- Create: `src/access/signup-ticket.ts`, `src/access/signup-ticket.test.ts`

**Interfaces:**
- Produces:
  - `type SignupTicket = { name: string; owner: boolean }` ;
  - `createSignupTicket(ticket: SignupTicket, secret: string, now?: number): Promise<string>` ;
  - `readSignupTicket(token: string | null | undefined, secret: string, now?: number): Promise<SignupTicket | null>`.

  Format : `base64url(JSON {name, owner, exp})` + `.` + `base64url(HMAC-SHA256)`, avec `exp = now + 10 min`. Web Crypto, comme `token.ts`.

- [ ] **Step 1 : tests en échec.**
  - Un ticket créé est relu à l'identique.
  - Ces cas renvoient `null` :
    - expiré (`now + 10 min + 1 ms`) ;
    - signature modifiée ;
    - charge modifiée (`owner` passé à `true`) ;
    - autre secret ;
    - `null`, `""`, `"abc"`, `"a.b.c"` ;
    - JSON valide mais `name` invalide pour `parseDisplayName`.
- [ ] **Step 2 :** `npx vitest run src/access/signup-ticket.test.ts`. Attendu : FAIL.
- [ ] **Step 3 : implémenter.**
  - Comparer les signatures avec `constantTimeEqual`.
  - Relire `name` avec `parseDisplayName`.
- [ ] **Step 4 :** relancer. Attendu : PASS.
- [ ] **Step 5 : commit** `feat(auth): sign short-lived signup tickets`.

> Rejeu : un ticket valide peut servir deux fois en 10 minutes. C'est acceptable, car il ne fait que créer un compte que son porteur avait déjà le droit de créer. La limite de tentatives arrive au morceau 6.

### Task 4 : instance Better Auth

**Files:**
- Create: `src/auth/create-auth.ts`, `src/auth/passkey-signup.ts`, `src/auth/passkey-signup.test.ts`
- Modify: `eslint.config.mjs` (couche `src/auth/**` : `only(["domain", "db", "access", "auth"], "Auth wires Better Auth on the database.")`)
- Test: `tests/functional/auth.test.ts`

**Interfaces:**
- Consumes: `readSignupTicket` (tâche 3), tables de la tâche 1.
- Produces:
  - `type AuthConfig = { db: Database; secret: string; baseURL: string; plugins?: BetterAuthPlugin[] }` ;
  - `createAuth(config: AuthConfig)` renvoie l'instance `betterAuth(...)`. Elle contient :
    - `drizzleAdapter(db, { provider: "sqlite", schema })` ;
    - `appName: "WeWatch"` ;
    - `session: { expiresIn: 60 jours, updateAge: 1 jour, cookieCache: { enabled: true, maxAge: 300 } }` ;
    - `emailAndPassword` désactivé ;
    - les plugins `passkey({ rpID, rpName: "WeWatch", origin, registration: passkeySignup(secret) })`, `nextCookies()` (en dernier) et `...plugins`.
  - `type Auth = ReturnType<typeof createAuth>` ;
  - `passkeySignup(secret: string): PasskeyRegistrationOptions`, qui renvoie :
    - `requireSession: false` ;
    - `resolveUser({ context })` : lit le ticket, renvoie `{ id: crypto.randomUUID(), name, displayName: name }` ou lève `APIError("BAD_REQUEST")` ;
    - `afterVerification({ ctx, context })` : relit le ticket, crée l'utilisateur avec `ctx.context.internalAdapter.createUser({ name, email: \`${uuid}@passkey.invalid\`, emailVerified: false })` et renvoie `{ userId: user.id }`.

  Le drapeau `owner` du ticket ne sert pas encore : le morceau 2 l'utilise pour rejoindre « NOUS DEUX ».

- [ ] **Step 1 : tests unitaires en échec** (`passkey-signup.test.ts`).
  - `resolveUser` avec un ticket valide → `name` = nom du ticket, `id` non vide.
  - `resolveUser` sans ticket ou avec un ticket invalide → rejette.
  - `afterVerification` appelle `createUser` une fois, avec ce nom et une adresse en `@passkey.invalid`, et renvoie son `id`.
  - `afterVerification` avec un ticket expiré → rejette, et `createUser` n'est pas appelé.
  - Le `ctx` est un objet minimal `{ context: { internalAdapter: { createUser: vi.fn() } } }`.
- [ ] **Step 2 :** `npx vitest run src/auth/passkey-signup.test.ts`. Attendu : FAIL.
- [ ] **Step 3 : implémenter `passkey-signup.ts` puis `create-auth.ts`.**
  - Pas d'`import "server-only"` : les fixtures e2e importent `createAuth`, comme elles importent `createDatabase`.
  - Vérifier les noms exacts d'import dans `node_modules` : `better-auth/adapters/drizzle`, `better-auth/next-js`, `@better-auth/passkey`.
- [ ] **Step 4 : test fonctionnel** (`tests/functional/auth.test.ts`) sur une base migrée (`startServerStack`).
  - Avec le plugin `testUtils()` (`better-auth/plugins`) : `const ctx = await auth.$context; const user = await ctx.test.saveUser(ctx.test.createUser({ name: "Léa" })); const headers = await ctx.test.getAuthHeaders({ userId: user.id });`.
  - Assertion : `auth.api.getSession({ headers })` renvoie `user.name === "Léa"`, sans en-têtes → `null` ; avec un cookie forgé (`cookie: "better-auth.session_token=forge.abc"`) → `null`, sans exception.
- [ ] **Step 5 :** `npx vitest run src/auth tests/functional/auth.test.ts && npm run lint`. Attendu : PASS.
- [ ] **Step 6 : commit** `feat(auth): create accounts from a passkey with Better Auth`.

### Task 5 : la session protège l'appli

**Files:**
- Modify: `src/server/container.ts` (`getAuth(): Auth`, mémoïsé, construit depuis l'env)
- Create: `src/server/session.ts` (`server-only`), `src/server/session.test.ts`, `src/server/__mocks__/session.ts`
- Create: `src/app/api/auth/[...all]/route.ts` (`export const { GET, POST } = toNextJsHandler(getAuth())`)
- Modify: `src/access/decision.ts`, `src/access/decision.test.ts`, `src/access/paths.ts`
- Modify: `src/proxy.ts`
- Modify: `src/features/{draw,list,swipe}/actions.ts` et leurs tests ; `tests/functional/{list,movie,swipe}.test.ts`, `tests/helpers/functional.ts`
- Delete: `src/access/assert-unlocked*`, `src/access/__mocks__/assert-unlocked.ts`, `src/access/cookie*`, les fonctions de jeton d'accès de `src/access/token.ts` (garder `constantTimeEqual`, ses tests suivent)

**Interfaces:**
- Consumes: `createAuth` (tâche 4).
- Produces:
  - `SIGNIN_PATH = "/connexion"` et `AUTH_API_PREFIX = "/api/auth/"` (`src/access/paths.ts`) ;
  - `accessDecision({ pathname, method, signedIn: boolean, authorization?, cronSecret? }): AccessDecision`, qui devient synchrone ;
  - `assertSignedIn(): Promise<{ userId: string; name: string }>`, qui lève `Error("Server Action refused: not signed in")` ;
  - mock `vi.mock("@/server/session")` : `assertSignedIn` résout `{ userId: "user-1", name: "Léa" }`.

- [ ] **Step 1 : réécrire `decision.test.ts`** sans le cookie d'accès. Cas :
  - `/connexion` est autorisé sans session (GET et POST) ;
  - `/api/auth/passkey/generate-authenticate-options` est autorisé sans session (GET et POST) ;
  - les ressources publiques gardent la même règle ;
  - le cron ne répond qu'à son secret, même avec une session ;
  - une page sans session → `"redirect"` ;
  - un POST d'action sans session → `"unauthorized"` ;
  - avec session → `"allow"`.
- [ ] **Step 2 : `src/env.test.ts`** « ACCESS_CODE n'est plus exigé » (retiré du schéma, de `.env.example` et de `startServerStack`), puis **`session.test.ts`**. Avec `getAuth` mocké : `api.getSession` renvoie `null` → rejette ; une session → `{ userId, name }`.
- [ ] **Step 3 :** `npx vitest run src/access src/server`. Attendu : FAIL.
- [ ] **Step 4 : implémenter.**
  - `decision.ts` : `UNLOCK_PATH` devient `SIGNIN_PATH`, plus le préfixe `AUTH_API_PREFIX`.
  - `proxy.ts` : `signedIn = (await getAuth().api.getSession({ headers: request.headers })) !== null`, redirection vers `SIGNIN_PATH`.
  - `session.ts` : `getSession({ headers: await headers() })`.
  - Les actions remplacent `assertUnlocked()` par `await assertSignedIn()`. Les tests remplacent `vi.mock("@/access/assert-unlocked")` par `vi.mock("@/server/session")`.
  - `startServerStack` stubbe `BETTER_AUTH_SECRET` (32 caractères) et `BETTER_AUTH_URL`, et retire `ACCESS_CODE`.
  - La redirection de `/connexion` vers `/` quand on est déjà connecté est faite par la page, en tâche 6.
- [ ] **Step 5 :** `npm run ci:checks`. Attendu : PASS, sans export mort (knip).
- [ ] **Step 6 : commit** `feat(auth)!: require a signed-in session instead of the access code`.

### Task 6 : écran de connexion et création de compte

**Files:**
- Create: `src/features/signin/`, en suivant le découpage de `features/draw/` (un fichier par vue) :
  - `SigninScreen.tsx` (assemble les vues) et `SigninScreen.module.css` (repris d'`UnlockScreen.module.css`) ;
  - `SigninHome.tsx` (Face ID, créer, ou message d'invitation) ;
  - `SignupForm.tsx` (prénom, code propriétaire, création avec Face ID) ;
  - `authClient.ts` (`createAuthClient({ plugins: [passkeyClient()] })` depuis `better-auth/react` et `@better-auth/passkey/client`) ;
  - `useSignin.ts` (les deux cérémonies et leurs erreurs) ;
  - `actions.ts`, avec `prepareSignup` ;
  - `messages.ts` (textes d'erreur).
- Create: `src/app/connexion/page.tsx` (titre `` `Entrer · ${APP_NAME}` ``), qui redirige vers `/` quand une session existe (sous `<Suspense>` : elle lit les en-têtes).
- Tests:
  - `src/features/signin/actions.test.ts` ;
  - `src/features/signin/SigninScreen.test.tsx`.
- Delete: `src/features/unlock/`, `src/app/unlock/`

**Interfaces:**
- Consumes: `parseDisplayName`, `signupRight`, `createSignupTicket`, `SIGNIN_PATH`.
- Produces:
  - `type PrepareSignupResult = { ok: true; ticket: string } | { ok: false; error: string }` ;
  - `prepareSignup(formData: FormData): Promise<PrepareSignupResult>` : lit `name` et `ownerCode`, applique `SIGNUP` et `OWNER_CODE`, renvoie un ticket ;
  - `SigninScreen` reçoit en props `{ signup: "open" | "invite"; prepareSignup }`. La page lit `SIGNUP` côté serveur.

Comportement (spec §9) :
- **Accueil** :
  - « ENTRE DANS WEWATCH », bouton « SE CONNECTER AVEC FACE ID » (`authClient.signIn.passkey()`) ;
  - en mode `open` : « CRÉER UN COMPTE » ;
  - en mode `invite` : « WEWATCH SE REJOINT SUR INVITATION » et un lien discret « J'AI UN CODE PROPRIÉTAIRE », qui ouvre le formulaire avec le champ code.
- **Formulaire** :
  - champ « TON PRÉNOM OU SURNOM » (`autocomplete="nickname"`), plus « CODE PROPRIÉTAIRE » en mode `invite` ;
  - bouton « CRÉER AVEC FACE ID » : `prepareSignup`, puis `authClient.passkey.addPasskey({ context: ticket, createSession: true, name: "WeWatch" })`.
- **Succès** : `window.location.assign("/")`. Le rechargement complet évite une page gardée en cache (`staleTimes`).
- **Erreurs** (`role="alert"`) :
  - nom invalide → « UN PRÉNOM DE 1 À 30 CARACTÈRES » ;
  - `closed` → « WEWATCH SE REJOINT SUR INVITATION » ;
  - `wrong_code` → « MAUVAIS CODE » (délai de 500 ms, comme l'ancien `WRONG_CODE_DELAY_MS`) ;
  - cérémonie annulée ou échouée → « FACE ID ANNULÉ, RÉESSAIE » ;
  - connexion sans passkey connue → « AUCUN COMPTE SUR CET APPAREIL ».

- [ ] **Step 1 : `actions.test.ts` en échec.** `getServerEnv` est stubbé avec `vi.stubEnv` puis `resetModules`, comme les tests existants. Cas :
  - nom valide en `open` → `ok` + ticket que `readSignupTicket` relit `{ name, owner: false }` ;
  - nom vide → erreur du nom ;
  - `invite` sans code → erreur `closed` ;
  - `invite` + bon code → ticket `owner: true` ;
  - mauvais code → « MAUVAIS CODE » ;
  - corps qui n'est pas un `FormData` → erreur du nom.
- [ ] **Step 2 : `SigninScreen.test.tsx` en échec.** `authClient` est mocké avec `vi.mock("./authClient")`. Cas :
  - `open` affiche « SE CONNECTER AVEC FACE ID » et « CRÉER UN COMPTE » ;
  - `invite` affiche le message d'invitation et pas « CRÉER UN COMPTE » ;
  - « J'AI UN CODE PROPRIÉTAIRE » montre le champ code ;
  - `addPasskey` en erreur → « FACE ID ANNULÉ, RÉESSAIE » visible, et le prénom reste dans le champ ;
  - `prepareSignup` en erreur → `addPasskey` jamais appelé.
- [ ] **Step 3 :** `npx vitest run src/features/signin`. Attendu : FAIL.
- [ ] **Step 4 : implémenter** dans la DA de l'ancien écran (`Ticket`, `Headline`, `Button`, styles d'`UnlockScreen.module.css` repris). Aucune nouvelle couleur.
- [ ] **Step 5 :** `npx vitest run src/features/signin && npm run lint`. Attendu : PASS.
- [ ] **Step 6 : commit** `feat(signin): sign in and create an account with Face ID`.

### Task 7 : se déconnecter

**Files:**
- Create: `src/features/signin/SignOutButton.tsx` (client : `authClient.signOut()`, puis `window.location.assign("/connexion")`)
- Modify: `src/features/list/ListFooter.tsx` (bouton « SE DÉCONNECTER » au-dessus des crédits)
- Test: `src/features/list/ListScreen.test.tsx` (le bouton est présent)

Emplacement **provisoire**, sur une branche jamais déployée seule : le morceau 2 le déplace dans le panneau de la pastille (spec §9).

- [ ] **Step 1 : test en échec.** LISTE affiche un bouton « SE DÉCONNECTER ».
- [ ] **Step 2 :** `npx vitest run src/features/list/ListScreen.test.tsx`. Attendu : FAIL.
- [ ] **Step 3 : implémenter** avec `ui/Button`, variante existante la plus discrète.
- [ ] **Step 4 :** relancer. Attendu : PASS.
- [ ] **Step 5 : commit** `feat(signin): sign out from the list screen`.

### Task 8 : e2e, captures, docs

**Files:**
- Modify: `e2e/env.ts`
  - `e2eEnv(worker)` : retirer `ACCESS_CODE`, ajouter `BETTER_AUTH_SECRET: "e2e-better-auth-secret-0123456789abcdef"`, `BETTER_AUTH_URL: \`http://localhost:${appPort(worker)}\``, `SIGNUP: "open"` et `OWNER_CODE: "e2e code proprio"`.
  - Exporter `OWNER_CODE`.
- Modify: `e2e/fixtures.ts`
  - `faceId(page)` : authentificateur virtuel via CDP (`WebAuthn.enable`, `WebAuthn.addVirtualAuthenticator` avec `{ protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true }`).
  - `signIn(page, name = "Léa")` : `createAuth({ db: db(), secret, baseURL, plugins: [testUtils()] })` sur la base du worker, `ctx.test.login({ userId })`, puis `page.context().addCookies(...)`.
  - La fixture `app` vide `movies`, `passkey`, `session` et `user`, appelle `signIn`, puis `page.goto("/")`.
  - Retirer `enterCode` et `unlock`.
- Delete: `e2e/access.spec.ts` ; Create: `e2e/auth.spec.ts`
- Modify: `playwright.config.ts` (`url` du serveur : `/connexion`)
- Modify: `e2e/visual.spec.ts` (capture `6-code` remplacée par `6-connexion` sur `/connexion`, vue de la page **sans** session : nouveau contexte)
- Modify: `scripts/smoke-prod.sh` (`/unlock` → `/connexion`), `scripts/measure-nav.mjs` (connexion par la fixture ou suppression de l'usage d'`ACCESS_CODE` : lire le script et l'adapter)
- Modify: `CLAUDE.md`, `README.md` (le code d'accès disparaît ; nouvelles variables ; section « Le code d'accès » → « Les comptes »), `docs/coverage.md`

Scénarios de `e2e/auth.spec.ts` (Chromium, `faceId(page)` avant l'action) :
- « sans compte, toutes les pages renvoient vers la connexion » (`/`, `/swipe`, `/list` → `/connexion`) ;
- « créer un compte avec Face ID ouvre l'appli » : prénom « Léa » → « CRÉER AVEC FACE ID » → titre « CE SOIR ON REGARDE » ;
- « se déconnecter puis revenir avec Face ID » : création, LISTE → « SE DÉCONNECTER » → `/connexion` → « SE CONNECTER AVEC FACE ID » → `/` ;
- « un prénom vide est refusé » ;
- Le mode `invite` n'a pas de scénario e2e (il faudrait un serveur de plus) : `SigninScreen.test.tsx` et `actions.test.ts` le couvrent.

- [ ] **Step 1 : écrire `auth.spec.ts` et adapter fixtures, env et config** comme ci-dessus.
- [ ] **Step 2 :** `npm run test:e2e`. Attendu : PASS hors captures. `6-code` disparaît, `6-connexion` est neuve.
- [ ] **Step 3 :** `npm run test:e2e -- --update-snapshots`, puis **ouvrir et regarder** les 4 captures `*-6-connexion-*`. Les autres doivent rester identiques : `git status` ne montre que les `6-*`.
- [ ] **Step 4 : docs.**
  - `CLAUDE.md` : description de l'appli (comptes, plus de code d'accès), architecture (`auth/`), mocks (`@/server/session`), pièges (`/unlock` → `/connexion`).
  - `README.md` : installation locale avec `BETTER_AUTH_SECRET` et `BETTER_AUTH_URL`, variables Vercel, section « Les comptes ».
  - `docs/coverage.md`.
- [ ] **Step 5 :** `npm run ci`. Attendu : tout vert.
- [ ] **Step 6 : commit** `test(e2e): sign in with a virtual Face ID`, puis `docs: describe accounts instead of the access code`.
- [ ] **Step 7 : PR.** `git push -u origin feat/v2-comptes`, puis `gh pr create --base release/2.0.0 --title "feat(auth)!: accounts with passkeys"`. Attendre la CI verte. La relecture du mainteneur précède la fusion (squash).

## Hors de ce morceau

- Groupes et migration « NOUS DEUX » : morceau 2. C'est là que le drapeau `owner` du ticket sert.
- Invitations : morceau 3.
- Google : morceau 4.
- Mon compte : morceau 5.
- Limites de tentatives, en-têtes, audit et bascule de prod : morceau 6. D'ici là, rien n'est déployé : `main` reste en 1.3.x.
