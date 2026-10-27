# Couverture du métier

Date : 2026-10-23 · mise à jour V1.2 : 2026-10-27

Porte qualité avant le front (Task 8) : la couverture de la logique métier doit atteindre les seuils ci-dessous.

## Commande

```bash
npm run test:coverage
```

Code de sortie : 0 (84 tests, 8 fichiers de test au moment de la porte ; 246 tests, 24 fichiers après la V1.1 ; 369 tests, 32 fichiers après la V1.2 ; 373 tests, 33 fichiers après la V1.2.1).

## Périmètre

`src/access/**`, `src/domain/**`, `src/db/**`, `src/tmdb/**`, `src/features/swipe/deck.ts`, `src/features/unlock/actions.ts` (V1.1 : code d'accès), `src/features/draw/tonightStorage.ts`, `src/features/refresh/**`, `src/app/api/cron/**` (V1.2 : filtres, rafraîchissement), `src/features/draw/tear.ts` (V1.2.1 : déchirure du ticket couché)

## Seuils (vitest.config.ts)

| Instructions | Fonctions | Lignes | Branches |
| ------------ | --------- | ------ | -------- |
| 95 %         | 95 %      | 95 %   | 90 %     |

## Résultat par fichier

Table générée depuis `coverage/coverage-summary.json` (reporter `json-summary`) : le reporter texte de vitest 5 n'affiche qu'un résumé global quand tous les fichiers sont couverts à 100 %.

| Fichier | Instr. | Branches | Fonctions | Lignes |
| --- | --- | --- | --- | --- |
| **Total** | 100% | 100% | 100% | 100% |
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
| src/features/draw/tear.ts | 100% | 100% | 100% | 100% |
| src/features/draw/tonightStorage.ts | 100% | 100% | 100% | 100% |
| src/features/refresh/refresh-movies.ts | 100% | 100% | 100% | 100% |
| src/features/swipe/deck.ts | 100% | 100% | 100% | 100% |
| src/features/unlock/actions.ts | 100% | 100% | 100% | 100% |
| src/tmdb/client.ts | 100% | 100% | 100% | 100% |
| src/tmdb/decks.ts | 100% | 100% | 100% | 100% |
| src/tmdb/images.ts | 100% | 100% | 100% | 100% |
| src/tmdb/movies.ts | 100% | 100% | 100% | 100% |
| src/tmdb/schemas.ts | 100% | 100% | 100% | 100% |

Résumé texte global :

```
Statements   : 100% ( 325/325 )
Branches     : 100% ( 193/193 )
Functions    : 100% ( 101/101 )
Lines        : 100% ( 290/290 )
```

## Preuve que la porte échoue en cas de manque

Les seuils sont globaux sur le périmètre. Ajout temporaire de `src/domain/scratch-uncovered.ts` (10 fonctions sans test), puis `npm run test:coverage` :

```
Statements   : 81.48% ( 132/162 )
Branches     : 80.95% ( 85/105 )
Functions    : 79.16% ( 38/48 )
Lines        : 79.86% ( 119/149 )
ERROR: Coverage for lines (79.86%) does not meet global threshold (95%)
ERROR: Coverage for functions (79.16%) does not meet global threshold (95%)
ERROR: Coverage for statements (81.48%) does not meet global threshold (95%)
ERROR: Coverage for branches (80.95%) does not meet global threshold (90%)
```

Code de sortie : **1**. Le fichier a ensuite été supprimé (aucune trace dans git).

Contre-épreuve avec un seuil relevé : `npm run test:coverage -- --coverage.thresholds.lines=101` donne `ERROR: Coverage for lines (100%) does not meet global threshold (101%)`, code de sortie **1**.
