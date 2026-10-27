# Couverture et tests

Date : 2026-10-23 · mise à jour : 2026-10-27 (V1.2.4, qualité)

## Les trois niveaux de tests

| Niveau | Où | Ce qui est vrai | Ce qui est simulé | Commande |
| --- | --- | --- | --- | --- |
| Unitaires | `src/**/*.test.ts(x)` | une fonction, un composant (Testing Library) | ses dépendances | `npm test` |
| Fonctionnels | `tests/functional/` | actions serveur → container → repository → SQLite, client TMDB → zod → mapping | TMDB (faux catalogue `tests/fake-tmdb/`), le cookie d'accès | `npm test` |
| End-to-end | `e2e/` | le build de prod dans Chromium (iPhone + desktop), 6 formats, axe | TMDB (même faux catalogue, servi en HTTP) | `npm run test:e2e` |

Tout tourne dans `npm run ci` (hook `pre-push`, et GitHub Actions en filet).

## Porte de couverture

`npm run test:coverage` : 485 tests, 52 fichiers, **100 %** partout.

Périmètre (`vitest.config.ts`) : **tous les modules `.ts` de `src/`**, sauf les hooks React (`use*.ts`, couverts par les tests UI et e2e), le câblage (`server/container.ts`, `proxy.ts`), le manifeste PWA et les couleurs des icônes. Un nouveau module de logique y entre donc tout seul.

Historique : 84 tests à la porte V1 ; 246 après la V1.1 ; 369 après la V1.2 ; 388 après la V1.2.3 ; 454 (+ 35 e2e) après la V1.2.4 ; 485 (+ 45 e2e, dont 24 captures visuelles) après la V1.3.

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
| src/access/assert-unlocked.ts | 100% | 100% | 100% | 100% |
| src/access/cookie.ts | 100% | 100% | 100% | 100% |
| src/access/cron.ts | 100% | 100% | 100% | 100% |
| src/access/decision.ts | 100% | 100% | 100% | 100% |
| src/access/paths.ts | 100% | 100% | 100% | 100% |
| src/access/token.ts | 100% | 100% | 100% | 100% |
| src/app/api/cron/refresh-movies/route.ts | 100% | 100% | 100% | 100% |
| src/db/create-database.ts | 100% | 100% | 100% | 100% |
| src/db/movies-repository.ts | 100% | 100% | 100% | 100% |
| src/db/schema.ts | 100% | 100% | 100% | 100% |
| src/domain/draw-session.ts | 100% | 100% | 100% | 100% |
| src/domain/movie.ts | 100% | 100% | 100% | 100% |
| src/domain/time.ts | 100% | 100% | 100% | 100% |
| src/domain/tonight.ts | 100% | 100% | 100% | 100% |
| src/domain/transitions.ts | 100% | 100% | 100% | 100% |
| src/features/draw/actions.ts | 100% | 100% | 100% | 100% |
| src/features/draw/drawMotion.ts | 100% | 100% | 100% | 100% |
| src/features/draw/drawView.ts | 100% | 100% | 100% | 100% |
| src/features/draw/tear.ts | 100% | 100% | 100% | 100% |
| src/features/draw/tonightStorage.ts | 100% | 100% | 100% | 100% |
| src/features/draw/tonightSummary.ts | 100% | 100% | 100% | 100% |
| src/features/list/actions.ts | 100% | 100% | 100% | 100% |
| src/features/list/searchAnswer.ts | 100% | 100% | 100% | 100% |
| src/features/list/tabs.ts | 100% | 100% | 100% | 100% |
| src/features/list/toWatchMeta.ts | 100% | 100% | 100% | 100% |
| src/features/refresh/refresh-movies.ts | 100% | 100% | 100% | 100% |
| src/features/swipe/actions.ts | 100% | 100% | 100% | 100% |
| src/features/swipe/deck.ts | 100% | 100% | 100% | 100% |
| src/features/swipe/deckState.ts | 100% | 100% | 100% | 100% |
| src/features/unlock/actions.ts | 100% | 100% | 100% | 100% |
| src/features/unlock/state.ts | 100% | 100% | 100% | 100% |
| src/server/validate.ts | 100% | 100% | 100% | 100% |
| src/tmdb/client.ts | 100% | 100% | 100% | 100% |
| src/tmdb/decks.ts | 100% | 100% | 100% | 100% |
| src/tmdb/images.ts | 100% | 100% | 100% | 100% |
| src/tmdb/movies.ts | 100% | 100% | 100% | 100% |
| src/tmdb/schemas.ts | 100% | 100% | 100% | 100% |
| src/ui/cx.ts | 100% | 100% | 100% | 100% |
| src/ui/movieMeta.ts | 100% | 100% | 100% | 100% |
