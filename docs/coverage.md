# Couverture et tests

Date : 2026-10-23 · mise à jour : 2026-11-04 (V2.1, coups de cœur)

## Les trois niveaux de tests

| Niveau | Où | Ce qui est vrai | Ce qui est simulé | Commande |
| --- | --- | --- | --- | --- |
| Unitaires | `src/**/*.test.ts(x)` | une fonction, un composant (Testing Library) | ses dépendances | `npm test` |
| Fonctionnels | `tests/functional/`, `tests/scripts/` | actions serveur → container → repository → SQLite, client TMDB → zod → mapping, Better Auth et ses limites de tentatives (`rate_limit` vidée par `reset`) ; les scripts de la CI (sauvegarde chiffrée, restauration, répétition, rattrapage, fumée, mise en ligne) lancés pour de vrai | TMDB (faux catalogue `tests/fake-tmdb/`), la session (`@/server/session`) ; la prod et l'API Vercel (faux serveurs HTTP) | `npm test` |
| End-to-end | `e2e/` | le build de prod dans Chromium (iPhone + desktop), 6 formats, axe, les passkeys (authentificateur virtuel, WebAuthn via CDP), plusieurs membres d'un groupe et plusieurs appareils d'un même compte (un contexte de navigateur chacun), les liens d'invitation (copiés par le presse-papiers), en mode `SIGNUP=open` (le mode `invite` est couvert par les fonctionnels) ; chaque test échoue sur une violation CSP ou un 404 sous `/api/auth/*` (`e2e/csp.ts`) | TMDB (même faux catalogue, servi en HTTP) ; la session des parcours hors connexion (écrite en base) | `npm run test:e2e` |

Tout tourne dans `npm run ci` (hook `pre-push`, et GitHub Actions en filet).

## Porte de couverture

`npm run test:coverage` : 1697 tests, 158 fichiers, **100 %** partout.

Périmètre (`vitest.config.ts`) : **tous les modules `.ts` de `src/`**, sauf les hooks React (`use*.ts`, couverts par les tests UI et e2e), le câblage (`server/container.ts`, `proxy.ts`, la route `/api/auth/*` et le client navigateur de Better Auth `features/signin/authClient.ts`), le manifeste PWA et les couleurs des icônes. Un nouveau module de logique y entre donc tout seul.

Historique : 84 tests à la porte V1 ; 246 après la V1.1 ; 369 après la V1.2 ; 388 après la V1.2.3 ; 454 (+ 35 e2e) après la V1.2.4 ; 485 (+ 45 e2e, dont 24 captures visuelles) après la V1.3 ; 715 (+ 61 e2e, dont 32 captures visuelles) après la V2.0 (comptes et passkeys) ; 920 (+ 96 e2e, dont 44 captures visuelles) après la V2.0 (groupes) ; 1145 (+ 150 e2e, dont 60 captures visuelles) après la V2.0 (invitations) ; 1344 (+ 143 e2e exécutés, dont 68 captures visuelles) après la V2.0 (« MON COMPTE ») ; 1532 (+ 157 e2e exécutés, dont 68 captures visuelles) après la V2.0 (blindage) ; 1697 après la V2.1 (coups de cœur).

## Seuils

| Instructions | Fonctions | Lignes | Branches |
| ------------ | --------- | ------ | -------- |
| 95 %         | 95 %      | 95 %   | 90 %     |

## Résultat par fichier

Table générée depuis `coverage/coverage-summary.json` (`npx vitest run --coverage --coverage.reporter=json-summary`).

| Fichier | Instr. | Branches | Fonctions | Lignes |
| --- | --- | --- | --- | --- |
| **Total** | 100% | 100% | 100% | 100% |
| src/env.ts | 100% | 100% | 100% | 100% |
| src/access/cron.ts | 100% | 100% | 100% | 100% |
| src/access/decision.ts | 100% | 100% | 100% | 100% |
| src/access/paths.ts | 100% | 100% | 100% | 100% |
| src/access/signed-in.ts | 100% | 100% | 100% | 100% |
| src/access/signed-out.ts | 100% | 100% | 100% | 100% |
| src/access/signup-ticket.ts | 100% | 100% | 100% | 100% |
| src/access/signup.ts | 100% | 100% | 100% | 100% |
| src/access/token.ts | 100% | 100% | 100% | 100% |
| src/app/api/cron/refresh-movies/route.ts | 100% | 100% | 100% | 100% |
| src/auth/auth-paths.ts | 100% | 100% | 100% | 100% |
| src/auth/create-auth.ts | 100% | 100% | 100% | 100% |
| src/auth/group-join.ts | 100% | 100% | 100% | 100% |
| src/auth/passkey-registration.ts | 100% | 100% | 100% | 100% |
| src/auth/passkey-signup.ts | 100% | 100% | 100% | 100% |
| src/auth/rate-limits.ts | 100% | 100% | 100% | 100% |
| src/auth/signup-transaction.ts | 100% | 100% | 100% | 100% |
| src/db/account-deletion.ts | 100% | 100% | 100% | 100% |
| src/db/account.ts | 100% | 100% | 100% | 100% |
| src/db/auth-schema.ts | 100% | 100% | 100% | 100% |
| src/db/create-database.ts | 100% | 100% | 100% | 100% |
| src/db/decisions.ts | 100% | 100% | 100% | 100% |
| src/db/group-list.ts | 100% | 100% | 100% | 100% |
| src/db/group-schema.ts | 100% | 100% | 100% | 100% |
| src/db/favorites.ts | 100% | 100% | 100% | 100% |
| src/db/groups.ts | 100% | 100% | 100% | 100% |
| src/db/housekeeping.ts | 100% | 100% | 100% | 100% |
| src/db/invitations.ts | 100% | 100% | 100% | 100% |
| src/db/list-queries.ts | 100% | 100% | 100% | 100% |
| src/db/membership.ts | 100% | 100% | 100% | 100% |
| src/db/rate-limit-schema.ts | 100% | 100% | 100% | 100% |
| src/db/rate-limit.ts | 100% | 100% | 100% | 100% |
| src/db/schema.ts | 100% | 100% | 100% | 100% |
| src/db/snapshots.ts | 100% | 100% | 100% | 100% |
| src/domain/attribution.ts | 100% | 100% | 100% | 100% |
| src/domain/device.ts | 100% | 100% | 100% | 100% |
| src/domain/display-name.ts | 100% | 100% | 100% | 100% |
| src/domain/draw-session.ts | 100% | 100% | 100% | 100% |
| src/domain/genres.ts | 100% | 100% | 100% | 100% |
| src/domain/group.ts | 100% | 100% | 100% | 100% |
| src/domain/label.ts | 100% | 100% | 100% | 100% |
| src/domain/movie.ts | 100% | 100% | 100% | 100% |
| src/domain/rate-limit.ts | 100% | 100% | 100% | 100% |
| src/domain/time.ts | 100% | 100% | 100% | 100% |
| src/domain/tonight.ts | 100% | 100% | 100% | 100% |
| src/domain/transitions.ts | 100% | 100% | 100% | 100% |
| src/features/account/actions.ts | 100% | 100% | 100% | 100% |
| src/features/account/load.ts | 100% | 100% | 100% | 100% |
| src/features/account/messages.ts | 100% | 100% | 100% | 100% |
| src/features/draw/actions.ts | 100% | 100% | 100% | 100% |
| src/features/draw/drawMotion.ts | 100% | 100% | 100% | 100% |
| src/features/draw/drawView.ts | 100% | 100% | 100% | 100% |
| src/features/draw/tear.ts | 100% | 100% | 100% | 100% |
| src/features/draw/tonightStorage.ts | 100% | 100% | 100% | 100% |
| src/features/draw/tonightSummary.ts | 100% | 100% | 100% | 100% |
| src/features/group-members/messages.ts | 100% | 100% | 100% | 100% |
| src/features/group-members/share.ts | 100% | 100% | 100% | 100% |
| src/features/groups/actions.ts | 100% | 100% | 100% | 100% |
| src/features/groups/messages.ts | 100% | 100% | 100% | 100% |
| src/features/groups/pillFocus.ts | 100% | 100% | 100% | 100% |
| src/features/invitation/load.ts | 100% | 100% | 100% | 100% |
| src/features/invitation/messages.ts | 100% | 100% | 100% | 100% |
| src/features/list/actions.ts | 100% | 100% | 100% | 100% |
| src/features/list/searchAnswer.ts | 100% | 100% | 100% | 100% |
| src/features/list/tabs.ts | 100% | 100% | 100% | 100% |
| src/features/list/toWatchMeta.ts | 100% | 100% | 100% | 100% |
| src/features/list/toWatchSections.ts | 100% | 100% | 100% | 100% |
| src/features/movie/load.ts | 100% | 100% | 100% | 100% |
| src/features/refresh/refresh-movies.ts | 100% | 100% | 100% | 100% |
| src/features/signin/actions.ts | 100% | 100% | 100% | 100% |
| src/features/signin/messages.ts | 100% | 100% | 100% | 100% |
| src/features/signin/passkeys.ts | 100% | 100% | 100% | 100% |
| src/features/swipe/actions.ts | 100% | 100% | 100% | 100% |
| src/features/swipe/deck.ts | 100% | 100% | 100% | 100% |
| src/features/swipe/deckState.ts | 100% | 100% | 100% | 100% |
| src/server/groups.ts | 100% | 100% | 100% | 100% |
| src/server/invitations.ts | 100% | 100% | 100% | 100% |
| src/server/rate-limit.ts | 100% | 100% | 100% | 100% |
| src/server/revalidate.ts | 100% | 100% | 100% | 100% |
| src/server/session.ts | 100% | 100% | 100% | 100% |
| src/server/sign-out.ts | 100% | 100% | 100% | 100% |
| src/server/validate.ts | 100% | 100% | 100% | 100% |
| src/tmdb/client.ts | 100% | 100% | 100% | 100% |
| src/tmdb/credits.ts | 100% | 100% | 100% | 100% |
| src/tmdb/decks.ts | 100% | 100% | 100% | 100% |
| src/tmdb/images.ts | 100% | 100% | 100% | 100% |
| src/tmdb/movies.ts | 100% | 100% | 100% | 100% |
| src/tmdb/schemas.ts | 100% | 100% | 100% | 100% |
| src/tmdb/search-rank.ts | 100% | 100% | 100% | 100% |
| src/ui/cx.ts | 100% | 100% | 100% | 100% |
| src/ui/favorite.ts | 100% | 100% | 100% | 100% |
| src/ui/movieMeta.ts | 100% | 100% | 100% | 100% |
| src/ui/quoted.ts | 100% | 100% | 100% | 100% |
