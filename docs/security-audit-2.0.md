# Audit de sécurité · WeWatch 2.0

- **Date** : 2026-11-02
- **Périmètre** : branche `feat/v2-blindage` (= `release/2.0.0` + morceau 6), commit `8f1c1e6`. Code applicatif (`src/`), configuration (`next.config.ts`, `vercel.json`), scripts d'exploitation (`scripts/`), CI (`.github/workflows/ci.yml`), historique Git complet (`git log -p --all`).
- **Auditeur** : relecteur indépendant, qui n'a rien implémenté de la 2.0. Lecture du code tel qu'il est, pas du diff.
- **Référentiel** : `CLAUDE.md`, `AGENTS.md`, spec v2 §5-§12, plan `docs/superpowers/plans/2026-11-02-v2-6-blindage.md` (tâche 7 et correction 20).

## Méthode

1. Lecture de chaque module `"use server"`, de chaque page, du proxy (`src/proxy.ts`, `src/access/`), de la configuration Better Auth (`src/auth/`) et du code de Better Auth 1.7.14 qu'elle sollicite (`origin-check.mjs`, `utils/ip.mjs`, `rate-limiter/index.mjs`, `cookies/index.mjs`, `create-context.mjs`).
2. Build de prod local (`npm run build`), servi avec un environnement explicite et une base locale (`DATABASE_URL=file:local.db … npx next start -p 3417`, jamais `.env.production.local` pour la base), puis requêtes réelles :
   - en-têtes (`curl -sI`) sur `/connexion`, `/`, `/invitation/<43 caractères>`, `/api/auth/sign-out` ;
   - 40 chemins limites (encodage, barre finale, casse, préfixes voisins, `..`) ;
   - POST d'une autre origine sur `verify-authentication` ;
   - Server Actions appelées sans session et d'une autre origine, y compris par une autre route que la leur (identifiants lus dans `.next/server/server-reference-manifest.json`) ;
   - limite de tentatives Better Auth par IP (`x-forwarded-for` à une et deux valeurs).
   Serveur arrêté ensuite.
3. Recherche de secrets dans tout l'historique (`git log -p --all`, 154 126 lignes), `git check-ignore`, `npm audit --omit=dev`.

Aucune valeur secrète n'apparaît dans ce document.

Les numéros de ligne cités renvoient au commit audité (`8f1c1e6`) ; les corrections qui ont suivi les ont déplacés.

## Suivi des constats

| # | Gravité | Statut |
| --- | --- | --- |
| M1 | moyenne | corrigé (commit `14f20ef`) |
| L1 | faible | corrigé (commit `77dd98d`, déroulé de bascule et README) |
| L2 | faible | corrigé (commit `6016bc4`) |
| L3 | faible | corrigé (commit `5e04e04`) |
| L4 | faible | corrigé (commit `9a0ef04`) |
| I1 | info | corrigé (commit `2438c43`) |
| I2 | info | accepté (longueur publique ou fixe pour la signature et le secret du cron ; gigue, pause de 500 ms et limite par IP pour le code propriétaire, retiré après la bascule) |
| I3 | info | accepté (serveur de développement d'esbuild jamais lancé, `drizzle-kit` hors de l'appli servie ; à revoir avec `drizzle-kit` 1.0) |
| I4 | info | corrigé (commit `77dd98d` : régénérer chaque lien après une restauration) |
| I5 | info | accepté (réservé aux membres déjà admis, appli à deux) |
| I6 | info | accepté (`vercel.app` préchargé HSTS ; `includeSubDomains` sur un domaine personnel futur) |

## Synthèse

| # | Point | Verdict | Preuve en une ligne |
| --- | --- | --- | --- |
| 1 | Server Actions : session/appartenance d'abord, limites, pas de `groupId` du cookie, arguments validés | ✅ | 20 actions dans 6 modules : `assertSignedIn`/`assertMember` en première ligne, sauf `prepareSignup` (public, limité par IP en premier) ; limites conformes à `ACTION_LIMITS` (`src/domain/rate-limit.ts:18-26`) ; méta-test `tests/functional/server-actions.test.ts` ; vérifié en direct (digest `WEWATCH_SIGNED_OUT`). |
| 2 | Pages connectées : `connection()`, session relue en base, `redirect` | ✅ | `/`, `/swipe`, `/list`, `/list/[tmdbId]`, `/groupe` → `connection()` puis `getActiveGroup()` (`src/server/groups.ts:28-32`) ; `/compte` → `src/app/compte/page.tsx:27-31` ; lecture `AUTHORITATIVE_SESSION_READ` (`src/server/session.ts:21-24`). |
| 3 | Proxy : préfixes publics, `PUBLIC_ASSET`, cron, cas limites | ✅ | `src/access/decision.ts:22-63` ; `/invitationx/…`, `/%69nvitation/…`, `/CONNEXION`, `/connexion%2F`, `/_next/../list`, `/icon/../list`, `/list/1.png` → 307 vers `/connexion` ; cron sans secret → 401. |
| 4 | Better Auth : `AUTH_PATHS`, contrôle d'origine, `allowedOrigins`, cookies | ✅ (voir L3) | `get-session`, `ok`, `error`, `list-sessions`, `update-user`, `callback/x`, `reset-password/x`, `PASSKEY/…`, `passkey%2F…` → 404 ; POST d'une autre origine → 403 `INVALID_ORIGIN` ; Server Action d'une autre origine → « Invalid Server Actions request » ; `allowedOrigins` absent de `next.config.ts`. |
| 5 | Jetons : invitation, ticket d'inscription, `listMySessions` | ✅ | aucun `console.*` ne touche un jeton (3 fichiers, `grep -rn "console\." src`) ; `findInvitedGroup` et `withoutToken` relancent sans message ni cause ; `Referrer-Policy: no-referrer` servi sur `/invitation/…` ; ticket HMAC, 10 min, `jti` à usage unique (`src/auth/passkey-signup.ts:48-61`) ; `sessionsOf` ne sélectionne pas `token` (`src/db/account.ts:78-86`). |
| 6 | Droit d'inscription, code propriétaire | ✅ (voir L1, L2, I2) | `signupRight` (`src/access/signup.ts:28-44`) ; `constantTimeEqual` ; `owner-code:<ip>` 5/15 min consommé juste avant la comparaison (`src/features/signin/actions.ts:69-74`) ; pause de 500 ms. |
| 7 | Révocation | ✅ | `getCurrentUser` sans cache ni rafraîchissement ; `leaveIfSignedOut` dans chaque `catch` d'action (`useListAction`, `SearchPanel`, `useDebouncedSearch`, `useDeckLoader`, `useSwipeSync`, `useGroupPanel`, `useInviteLink`, `LabelForm`, `useConfirm`, `MovieActions`) et `app/error.tsx` pour le reste (`useDraw`). |
| 8 | En-têtes servis, XSS, liens externes | ✅ (voir I1) | CSP, `nosniff`, `X-Frame-Options: DENY`, COOP, Permissions-Policy, HSTS présents sur les 4 réponses (200, 307, 404) ; aucun `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` dans `src`, `e2e`, `scripts` ; bande-annonce = `https://www.youtube.com/watch?v=${encodeURIComponent(key)}` (`src/ui/TrailerLink.tsx:15`) ; affiches toujours sous `https://image.tmdb.org/t/p/` (`src/tmdb/images.ts:4-6`). |
| 9 | Secrets : historique, `.env*`, sauvegarde, scripts | ⚠️ (voir M1) | historique propre (motifs vides ou fictifs seulement, 0 JWT, 0 `authToken=`, 0 hex de 64) ; `.env*`, `*.db`, `.rehearsal/` ignorés ; AES-256-GCM sans repli en clair ; tables secrètes exclues ; scripts n'affichent que des comptes. Mais la CI expose les secrets de prod à `npm ci` (M1). |
| 10 | `npm audit --omit=dev` | ✅ | 0 critique, 0 haute, 4 modérées (esbuild via `drizzle-kit`, avis sur le serveur de dev d'esbuild : non exploitable ici, voir I3). |
| 11 | IP client des limites (correction 20) | ✅ | `getIPFromHeader` n'accepte qu'un `x-forwarded-for` à une valeur (`@better-auth/core/dist/utils/ip.mjs`) ; `clientIp()` replie sur `no-trusted-ip` (`src/server/rate-limit.ts:8,15`) ; mesuré : 11ᵉ requête de `203.0.113.9` → 429, autre IP → non limitée, en-tête à deux valeurs → seau partagé et un avertissement dans le journal. |
| 12 | Divers (attaquant raisonnable) | ⚠️ (voir L1, L2, L3) | jeton d'invitation : 256 bits, force brute hors de portée ; aucune énumération de comptes (pas d'email ni d'identifiant, passkeys découvrables) ; CSRF des actions et de Better Auth fermé ; aucune redirection ouverte (destinations fixes) ; cron en GET seul, secret en temps constant. |

**Constats** : 0 critique, 0 haute, 1 moyenne, 4 faibles, 6 informatifs.

## Constats

### M1 · La CI donne les secrets de prod à l'installation des dépendances

- **Gravité** : moyenne.
- **Statut** : corrigé (commit `14f20ef`). Chaque secret est dans l'`env` des seules étapes qui s'en servent : `build` → l'étape `vercel pull/build/deploy` ; `release` → sauvegarde (`DATABASE_*`, `BACKUP_KEY`), migration (`DATABASE_*`), lecture, promotion et retour arrière (`VERCEL_*`), fumée (`CRON_SECRET`). Aucun secret dans l'`env` d'un job ni d'un `npm ci`. `release` installe avec `npm ci --ignore-scripts` (vérifié hors du dépôt : `drizzle-kit migrate` et `backup-db.mjs` marchent sans scripts d'installation, esbuild par son paquet de plateforme, `@libsql/client` par son binaire précompilé) ; `build` garde les scripts, sans secret. La CLI Vercel est une devDependency à version exacte (`vercel` 65.9.0, intégrité dans le lockfile, montée par Dependabot), appelée par `npx --no vercel` (jamais téléchargée au run). En-tête du workflow : `permissions: contents: read` (L4).
- **Preuve** :
  - Job `release` : `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `VERCEL_TOKEN`, `CRON_SECRET` sont dans l'`env` **du job** (`.github/workflows/ci.yml:103-110`), donc visibles de `npm ci` (`ci.yml:117`).
  - Job `build` : `VERCEL_TOKEN` au niveau du job (`ci.yml:71-74`) pendant `npm ci` (`ci.yml:83`) ; puis `vercel pull --environment=production` écrit toutes les variables de prod (dont `BETTER_AUTH_SECRET` et le jeton Turso) sur le runner, et `vercel build` exécute le build avec elles (`ci.yml:87-88`).
  - `npm ci` exécute des scripts d'installation : `esbuild` (3 copies, dont celles de `drizzle-kit`), `fsevents`, `lefthook`, `unrs-resolver`, plus `prepare` (`package.json:23`).
  - `npx vercel@latest`, jamais épinglé (`ci.yml:87-89`), est téléchargé à chaque run avec le jeton Vercel.
  - Dependabot ouvre chaque semaine une PR, fusionnée « si la CI est verte » (`CLAUDE.md`).
- **Risque** : une dépendance compromise (attaque de chaîne d'approvisionnement par script `postinstall`, scénario courant sur npm) lit le jeton Turso en écriture et le jeton Vercel, donc la base de prod et le déploiement. `BACKUP_KEY`, lui, est déjà protégé (étape seule, `ci.yml:119-125`) : la même règle n'est pas appliquée aux autres secrets.
- **Correction proposée** :
  1. Dans `release` et `build`, déplacer chaque secret dans l'`env` de la seule étape qui en a besoin (sauvegarde, migration, promotion, fumée, retour arrière ; `vercel pull/build/deploy`), comme `BACKUP_KEY`.
  2. `npm ci --ignore-scripts` dans `release` (seuls `@libsql/client` et `drizzle-kit` y servent, sans binaire natif à installer pour la migration ; à vérifier) ; dans `build`, le build Vercel a besoin d'esbuild : garder les scripts mais sans secret dans l'`env` de `npm ci`.
  3. Épingler la CLI Vercel (`vercel` en `devDependency` à version exacte, ou `npx vercel@<x.y.z>`).
  4. Ajouter en tête du workflow `permissions: contents: read` (voir L4).

### L1 · Le code propriétaire ouvre « NOUS DEUX » pour toujours

- **Gravité** : faible.
- **Statut** : corrigé (commit `77dd98d`) : `docs/bascule-2.0.md` §3 fait retirer `OWNER_CODE` de Vercel (puis redéployer) une fois les deux comptes dans « NOUS DEUX », avec la raison ; le README le dit aussi.
- **Preuve** : un ticket `owner: true` fait rejoindre `LEGACY_GROUP_ID` à chaque inscription (`src/auth/group-join.ts:22-27`) ; `OWNER_CODE` reste valable tant qu'il est dans Vercel. La limite est par IP seulement (`owner-code:<ip>`, 5/15 min, `src/domain/rate-limit.ts:20`), par choix (correction 6) ; Better Auth regroupe l'IPv6 par /64, mais un attaquant qui dispose d'un bloc IPv6 plus large (un /48 = 65 536 /64) multiplie ses essais.
- **Risque** : quiconque devine le code entre dans la liste du couple, sans lien d'invitation. Avec une phrase de plusieurs mots (README), la force brute reste irréaliste ; le risque tient surtout à une fuite du code (capture d'écran, gestionnaire partagé) dont l'effet ne s'éteint jamais.
- **Correction proposée** : une fois les deux comptes du couple dans « NOUS DEUX » après la bascule, retirer `OWNER_CODE` de Vercel (l'inscription reste possible par lien d'invitation) ; l'écrire dans le déroulé de bascule et dans le README. À défaut, exiger au moins 5 mots tirés au hasard.

### L2 · `SIGNUP` est ouvert par défaut, et la fumée ne le vérifie pas

- **Gravité** : faible.
- **Statut** : corrigé (commit `6016bc4`) : `scripts/smoke-prod.sh` exige « WEWATCH SE REJOINT SUR INVITATION » sur `/connexion` quand `EXPECT_SIGNUP=invite` (défaut ; la CI passe `${{ vars.EXPECT_SIGNUP || 'invite' }}`), ne vérifie rien avec `open`, refuse toute autre valeur ; espaces insécables et entités tolérés. Une fumée rouge déclenche le retour arrière automatique.
- **Preuve** : `SIGNUP: z.enum(["open", "invite"]).default("open")` (`src/env.ts:22`) ; `scripts/smoke-prod.sh` vérifie la redirection, le `rpId` et le cron, pas le mode d'inscription. Le déroulé le contrôle une fois, à la bascule (`docs/bascule-2.0.md:118-143`).
- **Risque** : une variable supprimée ou mal saisie plus tard (projet Vercel recréé, nouvel environnement) ouvre l'inscription à quiconque connaît l'adresse `*.vercel.app`. Un inconnu n'accède à aucun groupe existant, mais consomme le quota TMDB (recherche, decks) et la base Turso, sans que rien ne le signale.
- **Correction proposée** : faire vérifier par `smoke-prod.sh` que `/connexion` affiche « WEWATCH SE REJOINT SUR INVITATION » quand le dépôt l'attend (variable `vars.EXPECT_SIGNUP=invite`), ou rendre `invite` la valeur par défaut hors développement.

### L3 · Le contrôle d'origine de Better Auth dépend d'une variable d'environnement

- **Gravité** : faible.
- **Statut** : corrigé (commit `5e04e04`) : en production, `createAuth` passe `advanced: { disableOriginCheck: false, disableCSRFCheck: false }` (`originCheckForcedOn`), qui prime sur `isTest()` (`create-context.mjs:211`) ; test fonctionnel `tests/functional/origin-check.test.ts` (`NODE_ENV=production` et `TEST=1` → 403). La fumée poste d'une autre origine sur `/api/auth/passkey/verify-authentication` et exige 403. `getIP` dépend toujours de `isTest()` : couvert par l'interdiction de `TEST` en prod (« À vérifier » 7).
- **Preuve** : Better Auth coupe son contrôle d'origine **et** son contrôle CSRF quand `isTest()` est vrai, c'est-à-dire `NODE_ENV=test` **ou** une variable `TEST` « vraie » (`node_modules/better-auth/dist/context/create-context.mjs:211`, `@better-auth/core/dist/env/env-impl.mjs:36`). `createAuth` ne fixe pas `advanced.disableOriginCheck` (`src/auth/create-auth.ts:72-120`). Même dépendance pour `getIP`, qui rend alors `127.0.0.1` à tout le monde (une seule limite pour tous).
- **Risque** : une variable `TEST=1` ajoutée un jour à l'environnement de prod Vercel (débogage, outil tiers) rouvrirait le CSRF sur `/sign-out` et les cérémonies passkey, sans aucun signe visible. Aujourd'hui, en prod comme dans le build local, le contrôle est actif (POST d'une autre origine → 403, vérifié).
- **Correction proposée** : dans `createAuth`, `advanced: { disableOriginCheck: false }` quand `NODE_ENV === "production"` (les tests unitaires gardent leur comportement), ou faire refuser `TEST` par `parseServerEnv` en production ; ajouter à la fumée un POST d'une autre origine sur `/api/auth/passkey/verify-authentication`, qui doit répondre 403.

### L4 · Workflow GitHub : permissions par défaut et actions épinglées par étiquette

- **Gravité** : faible.
- **Statut** : corrigé (commit `9a0ef04`) : `permissions: contents: read` en tête ; seul `version` l'élargit (`contents: write`, `pull-requests: write`, inchangé). Actions épinglées par SHA de commit, version en commentaire (`actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `actions/upload-artifact` v7.0.2, `googleapis/release-please-action` v4.4.1 : les mêmes commits que les étiquettes `v7`/`v4` utilisées jusque-là) ; Dependabot `github-actions` (mensuel) les met à jour.
- **Preuve** : aucun bloc `permissions:` en tête de `.github/workflows/ci.yml` (seul `version` en déclare, `ci.yml:162`) ; actions épinglées par étiquette (`actions/checkout@v7`, `googleapis/release-please-action@v4`, `ci.yml:34-183`).
- **Risque** : selon le réglage du dépôt, `GITHUB_TOKEN` peut avoir l'écriture dans tous les jobs ; une étiquette d'action déplacée exécute un autre code avec les secrets du job.
- **Correction proposée** : `permissions: contents: read` en tête du workflow, élargi dans `version` seulement ; épingler les actions par SHA (Dependabot `github-actions`, déjà configuré, sait les mettre à jour).

### I1 · En-tête `X-Powered-By: Next.js`

- **Gravité** : info.
- **Statut** : corrigé (commit `2438c43`) : `poweredByHeader: false`, testé dans `tests/next-config.test.ts` et vérifié sur le build local (aucun `X-Powered-By`).
- **Preuve** : présent sur `/connexion` et `/invitation/…` du build local ; `next.config.ts:48` sans `poweredByHeader`.
- **Correction proposée** : `poweredByHeader: false`. Gain minime (la stack se devine de toute façon).

### I2 · `constantTimeEqual` révèle la longueur

- **Gravité** : info.
- **Statut** : accepté, pour la raison ci-dessous.
- **Preuve** : retour immédiat si les longueurs diffèrent (`src/access/token.ts:3-5`), utilisé pour le code propriétaire, le secret du cron et la signature du ticket.
- **Risque** : négligeable : la signature et le secret du cron ont une longueur publique ou fixe ; pour le code propriétaire, la gigue réseau et la pause de 500 ms noient la mesure, et la limite par IP l'empêche.
- **Correction proposée** (facultative) : comparer des HMAC-SHA-256 des deux valeurs, de longueur fixe.

### I3 · `npm audit --omit=dev` : 4 vulnérabilités modérées

- **Gravité** : info.
- **Statut** : accepté, pour la raison ci-dessous.
- **Preuve** : `esbuild` ≤ 0.24.2 (GHSA-67mh-4wv8-2f99) via `@esbuild-kit/*` ← `drizzle-kit@0.31`. `drizzle-kit` est en `dependencies` parce que la CI migre la prod avec.
- **Justification** : l'avis porte sur le serveur de développement d'esbuild (`esbuild --serve`), jamais lancé ; `drizzle-kit` ne tourne qu'en CI et en local, pas dans l'appli servie. Pas de correctif sans version majeure de `drizzle-kit`. Accepté ; à revoir à la sortie de `drizzle-kit` 1.0.

### I4 · Jetons d'invitation en clair en base et dans la sauvegarde

- **Gravité** : info.
- **Statut** : corrigé (commit `77dd98d`) : `docs/bascule-2.0.md` §7, étape 7, fait régénérer le lien de chaque groupe après une restauration.
- **Preuve** : `app_group.invite_token` en clair (`src/db/invitations.ts`), sauvegardé (`app_group: "*"`, `scripts/backup-tables.mjs:24`).
- **Risque** : un lien régénéré avant une restauration redevient valable après elle. La sauvegarde est chiffrée, et l'écran doit pouvoir réafficher le lien : stockage en clair justifié.
- **Correction proposée** : ajouter au déroulé de restauration « régénérer le lien de chaque groupe après une restauration », ou mettre `invite_token` à `NULL` à la restauration.

### I5 · Recherche et decks TMDB sans limite pour un membre

- **Gravité** : info.
- **Statut** : accepté, pour la raison ci-dessous.
- **Preuve** : `searchCatalog`, `loadMoreCards`, `addFromSearch`, `decideSwipe` (`src/features/list/actions.ts`, `src/features/swipe/actions.ts`) ne sont pas limités ; `page` n'a pas de borne haute (`src/features/swipe/actions.ts:92`).
- **Risque** : un membre authentifié peut épuiser le quota TMDB. Réservé aux comptes déjà admis (invitation ou code) : accepté pour une appli à deux.

### I6 · HSTS sans `includeSubDomains`

- **Gravité** : info.
- **Statut** : accepté, pour la raison ci-dessous.
- **Preuve** : `Strict-Transport-Security: max-age=63072000` (`next.config.ts:45`).
- **Justification** : `vercel.app` est dans la liste de préchargement HSTS des navigateurs ; sur un domaine personnel futur, ajouter `includeSubDomains` si tous les sous-domaines sont en https.

## Détail des points

### 1. Server Actions

| Module | Action | Première ligne | Limite | Validation |
| --- | --- | --- | --- | --- |
| `signin/actions.ts` | `prepareSignup` | `withinLimit("signup", ip)` (public par conception) | `signup:<ip>` 10/10 min ; `owner-code:<ip>` 5/15 min si un code est saisi | `FormData` vérifié, `parseDisplayName`, `findInvitedGroup` |
| `groups/actions.ts` | `createGroup` | `assertSignedIn` | `create-group:<user>` 10/h | `parseGroupName` |
| | `chooseGroup`, `inviteLink`, `regenerateInviteLink`, `leaveGroup` | `assertMember(groupId)` | aucune (table du plan) | `isGroupId` |
| | `renameGroup` | `assertMember` | aucune | `parseGroupName` |
| | `removeMember` | `assertMember` | aucune | `userId` 1 à 64 caractères |
| | `joinGroup` | `assertSignedIn` | `join-group:<user>` 20/h | `isInviteToken` |
| `account/actions.ts` | `deletePasskey` | `assertSignedIn` | `delete-passkey:<user>` 10/h | `assertId`, filtre `userId` |
| | `revokeSession` | `assertSignedIn` | aucune | `assertId`, filtre `userId` |
| | `renameMe` | `assertSignedIn` | `rename-me:<user>` 20/h | `parseDisplayName` |
| | `deleteAccount` | `assertSignedIn` | `delete-account:<user>` 5/h | `confirmsName` |
| `list/actions.ts` | `removeFromList`, `unwatch`, `addFromSearch`, `searchCatalog` | `assertMember` | aucune | `assertTmdbId`, requête ≤ 100 caractères |
| `draw/actions.ts` | `markWatched` | `assertMember` | aucune | `assertTmdbId` |
| `swipe/actions.ts` | `decideSwipe`, `undoSwipe`, `loadMoreCards` | `assertMember` | aucune | `assertTmdbId`, `assertSwipeDecision`, `isDeckId`, `isPositiveInt` |

- Aucune action ne lit `ww_group` : seule `getActiveGroup` (pages) le lit, et ne le croit que pour un groupe de l'utilisateur (`src/server/groups.ts:39-40`). Les pages lient `groupId` (`.bind(null, group.id)`).
- Le seau global `owner-code:all` du tableau d'origine a été retiré, conformément à la correction 6 (`src/domain/rate-limit.ts:12-17`).
- Vérifié en direct : `leaveGroup` et `joinGroup` postés sans cookie sur `/invitation/<jeton>` (préfixe ouvert par le proxy) répondent l'erreur au digest `WEWATCH_SIGNED_OUT`, sans écriture.

### 3. Proxy

- Pas de `matcher` : le proxy voit toutes les requêtes. `CRON_PATH` en égalité stricte, GET/HEAD seulement ; `/connexion` en égalité stricte ; `/api/auth/` et `/invitation/` en préfixe avec barre finale, d'où le refus de `/invitationx/…` et `/api/authentification`.
- `PUBLIC_ASSET` n'ouvre que GET/HEAD, un seul segment pour une extension statique (`/list/1.png` → 307).
- Next normalise le chemin avant le proxy : `/_next/../list` et `/icon/../list` deviennent `/list` (307). `/invitation/..%2Flist` reste une page d'invitation (jeton invalide, rien lu en base).
- La session y est lue « à échec fermé » (`src/access/signed-in.ts:14-23`).

### 4. Better Auth

- Liste blanche : plugin `onlyAuthPaths` en premier (`src/auth/auth-paths.ts:54-60`, `src/auth/create-auth.ts:107-109`) ; la règle `"/**"` empêche les chemins inconnus d'écrire dans `rate_limit` (`src/auth/rate-limits.ts:28-29`).
- Origine : avec un cookie, `Origin: http://evil.example` → 403 `INVALID_ORIGIN` ; sans `Origin` → 403 `MISSING_OR_NULL_ORIGIN` ; sans cookie, la requête atteint le plugin mais échoue faute de défi (`CHALLENGE_NOT_FOUND`), le défi vivant dans un cookie `SameSite=Lax` qu'un site tiers ne fait pas envoyer en POST.
- Cookies : défi passkey `HttpOnly; SameSite=Lax; Max-Age=300` ; `Secure` et préfixe `__Secure-` dès que `BETTER_AUTH_URL` est en https (`better-auth/dist/cookies/index.mjs:23`). `ww_group` : `httpOnly`, `sameSite: lax`, `secure` selon `BETTER_AUTH_URL` (`src/domain/group.ts:17-22`), aux trois endroits.
- `serverActions.allowedOrigins` absent : Next compare `Origin` à l'hôte (vérifié : « x-forwarded-host … does not match origin … Aborting the action »).

### 5. Jetons

- Jeton d'invitation : 32 octets de `crypto.getRandomValues` (`src/db/invitations.ts:14-18`), validé par motif avant toute requête, jamais dans le ticket (qui porte l'id du groupe), lien bâti sur `BETTER_AUTH_URL` (`src/features/groups/actions.ts:65-67`).
- Ticket d'inscription : HMAC-SHA-256 avec étiquette de domaine, `exp` de 10 min, `jti` de 16 octets consommé dans la transaction d'inscription, clé primaire contre deux usages concurrents ; purge des `jti` après 15 min, donc après l'expiration.

### 8. En-têtes servis (build local, `curl -sI`)

Sur `/connexion` (200), `/` (307), `/invitation/<43 A>` (200), `/api/auth/sign-out` en GET (404) :

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://image.tmdb.org; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin   (no-referrer sur /invitation/…)
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
Strict-Transport-Security: max-age=63072000
```

Pages connectées : `Cache-Control: private, no-cache, no-store`. Pas d'`unsafe-eval` en prod.

### 9. Secrets

- `git log -p --all` : `BETTER_AUTH_SECRET=`, `OWNER_CODE=`, `CRON_SECRET=`, `TMDB_ACCESS_TOKEN=`, `DATABASE_AUTH_TOKEN=`, `BACKUP_KEY=`, `ACCESS_CODE=` n'apparaissent que vides, avec `…`, `<…>`, `$(openssl rand …)` ou une valeur de test évidente ; `eyJ` une seule fois (la liste de ce plan) ; `libsql://` sans `authToken` ; aucun `Bearer` suivi d'un jeton ; aucun fichier `.env*` hors `.env.example`, aucun `.db`, aucune sauvegarde jamais ajouté.
- Sauvegarde : AES-256-GCM, IV aléatoire de 12 octets, étiquette vérifiée ; clé absente ou mal formée → échec sans écrire (`scripts/backup-crypto.mjs`, `scripts/backup-db.mjs:22-24`) ; `session`, `verification`, `signup_ticket_use`, `rate_limit` jamais lus ; `account` lu sans `access_token`, `refresh_token`, `id_token`, `password` (`scripts/backup-tables.mjs:14-35`). Scripts : comptes par table, chemin du fichier, messages d'erreur sans valeur.

### 11. IP client

Sur Vercel, `x-forwarded-for` est réécrit par la plateforme avec la seule IP du client : Better Auth et `clientIp()` liront la même valeur. Ailleurs (proxy qui ajoute une valeur), tout le monde partage le seau `no-trusted-ip` : une gêne, pas une faille, d'où la vérification après bascule.

## Acceptés

| Risque | Raison |
| --- | --- |
| `'unsafe-inline'` dans `script-src` et `style-src` | Une CSP à nonce impose le rendu dynamique de chaque page, incompatible avec `cacheComponents` (prérendu partiel). Aucun `dangerouslySetInnerHTML` ni texte injecté en HTML : le risque XSS résiduel est faible. SRI expérimental, écarté. |
| Pas d'`upgrade-insecure-requests` | Casserait l'e2e en http ; Vercel sert tout en https et HSTS couvre le navigateur. |
| Ticket d'inscription dans `?context=` (journaux de requêtes) | Usage unique et 10 min : un ticket journalisé ne vaut plus rien. |
| Jeton d'invitation dans le chemin (journaux Vercel) | Le lien doit se partager tel quel ; `no-referrer` empêche la fuite vers des tiers ; régénérer le lien le révoque. |
| Pas de seau global pour le code propriétaire | Correction 6 : un seau global permettrait à une attaque de bloquer le propriétaire, seul à pouvoir entrer à la bascule. Compensé par L1. |
| Proxy en retard de 5 min sur une révocation | Pages et actions relisent la base à chaque fois ; seules des pages déjà en cache peuvent s'afficher, sans rien pouvoir changer. |
| Tout membre peut retirer tout membre | Choix de la spec (§7) pour un groupe de confiance ; le retiré peut revenir par le lien tant qu'il n'est pas régénéré. |
| Actions non limitées (`revokeSession`, `renameGroup`, `regenerateInviteLink`, `removeMember`, `leaveGroup`, `chooseGroup`, lectures TMDB) | Réservées à un compte ou à un membre, sans secret à deviner (I5). |
| Comptes supprimés présents 90 jours dans les sauvegardes | Rétention de l'artefact ; écrit dans le README. |
| Pas de pare-feu Vercel | Les limites en base suffisent pour deux personnes. |

## À vérifier après la bascule

1. **Journaux Vercel** (depuis l'heure de la bascule) : aucune ligne « Rate limiting could not determine a client IP ». Sinon, toutes les limites partagent un seul compteur.
2. **En-têtes de prod** : `curl -sI "$PROD_URL/connexion"` montre la même CSP, HSTS, `nosniff`, `DENY` ; `curl -sI "$PROD_URL/invitation/$(printf 'A%.0s' {1..43})"` montre `Referrer-Policy: no-referrer`.
3. **Cookies de prod** (outils du navigateur, après connexion) : `__Secure-better-auth.session_token` et `__Secure-better-auth.session_data` en `Secure; HttpOnly; SameSite=Lax` ; `ww_group` en `Secure; HttpOnly; SameSite=Lax`.
4. **Origine** : `curl -s -o /dev/null -w '%{http_code}' -X POST "$PROD_URL/api/auth/passkey/verify-authentication" -H 'Origin: https://evil.example' -H 'Content-Type: application/json' -H 'Cookie: x=1' --data '{}'` → `403`. La fumée le vérifie désormais à chaque déploiement (L3).
5. **Chemins fermés** : `/api/auth/get-session` et `/api/auth/ok` → 404 en prod.
6. **Inscription** : `/connexion` affiche « WEWATCH SE REJOINT SUR INVITATION » (`SIGNUP=invite`) ; la fumée le vérifie désormais à chaque déploiement (L2).
7. **Variables Vercel de prod** : ni `TEST`, ni `NODE_ENV` autre que `production` (L3).
8. **Code propriétaire** : une fois les deux comptes du couple dans « NOUS DEUX », retirer `OWNER_CODE` de Vercel (L1, `docs/bascule-2.0.md` §3).
9. **Protection des déploiements Vercel** : les déploiements construits par la CI (`--skip-domain`) et les anciens restent joignables à leur adresse unique, avec l'environnement de prod. Les passkeys et cookies y sont inutilisables (`rpID` et cookies liés à l'adresse de prod, origine refusée), mais activer « Standard Protection » (tout sauf le domaine de prod) ferme cette surface.
10. **Sauvegarde** : l'artefact `db-backup-<sha>` du run de bascule se déchiffre avec `BACKUP_KEY` du gestionnaire de mots de passe (par la répétition, `node scripts/rehearse-migration.mjs`, qui n'affiche que des comptes), sans jamais afficher son contenu.
