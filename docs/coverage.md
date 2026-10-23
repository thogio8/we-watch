# Couverture du métier

Date : 2026-10-23

Porte qualité avant le front (Task 8) : la couverture de la logique métier doit atteindre les seuils ci-dessous.

## Commande

```bash
npm run test:coverage
```

Code de sortie : 0 (84 tests, 8 fichiers de test).

## Périmètre

`src/domain/**`, `src/db/**`, `src/tmdb/**`, `src/features/swipe/deck.ts`

## Seuils (vitest.config.ts)

| Instructions | Fonctions | Lignes | Branches |
| ------------ | --------- | ------ | -------- |
| 95 %         | 95 %      | 95 %   | 90 %     |

## Résultat par fichier

Table générée depuis `coverage/coverage-summary.json` (reporter `json-summary`) : le reporter texte de vitest 5 n'affiche qu'un résumé global quand tous les fichiers sont couverts à 100 %.

| Fichier                     | Instr. | Branches | Fonctions | Lignes |
| --------------------------- | ------ | -------- | --------- | ------ |
| **Total**                   | 100%   | 100%     | 100%      | 100%   |
| src/db/create-database.ts   | 100%   | 100%     | 100%      | 100%   |
| src/db/movies-repository.ts | 100%   | 100%     | 100%      | 100%   |
| src/db/schema.ts            | 100%   | 100%     | 100%      | 100%   |
| src/domain/draw-session.ts  | 100%   | 100%     | 100%      | 100%   |
| src/domain/movie.ts         | 100%   | 100%     | 100%      | 100%   |
| src/domain/time.ts          | 100%   | 100%     | 100%      | 100%   |
| src/domain/transitions.ts   | 100%   | 100%     | 100%      | 100%   |
| src/features/swipe/deck.ts  | 100%   | 100%     | 100%      | 100%   |
| src/tmdb/client.ts          | 100%   | 100%     | 100%      | 100%   |
| src/tmdb/movies.ts          | 100%   | 100%     | 100%      | 100%   |
| src/tmdb/schemas.ts         | 100%   | 100%     | 100%      | 100%   |

Résumé texte global :

```
Statements   : 100% ( 132/132 )
Branches     : 100% ( 85/85 )
Functions    : 100% ( 38/38 )
Lines        : 100% ( 119/119 )
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
