# Qualité : ce qui tourne, et quand

Mesures datées du 2026-11-04. Les scores bougent : ce document dit comment les relire, les chiffres d'un jour ne sont qu'un repère.

## Vue d'ensemble

| Quand                         | Quoi                                                                                                                                          | Où                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| À chaque pull request         | `checks`, `e2e` (4 machines), revue des dépendances                                                                                           | `ci.yml`                   |
| À chaque push sur `main`      | les mêmes, puis `build`, `release` (sauvegarde, migration, mise en ligne, fumée, retour arrière) et `version`                                 | `ci.yml`                   |
| Chaque nuit (01h30 UTC)       | sauvegarde chiffrée, exercice de restauration, fumée de la prod, e2e répété trois fois                                                        | `nightly.yml`              |
| Chaque lundi (03h00 UTC)      | tests de mutation, Lighthouse, OpenSSF Scorecard                                                                                              | `weekly.yml`               |
| En continu, côté GitHub       | CodeQL, détection de secrets et push protection, alertes et mises à jour de sécurité Dependabot, signalement privé de failles                 | onglet Security            |

Chaque workflow se relance à la main (`workflow_dispatch`, onglet Actions → « Run workflow »). GitHub coupe un workflow planifié après 60 jours sans activité sur le dépôt : un push, ou un lancement manuel, le réveille.

## À chaque pull request et chaque push

**`checks`** (`npm run ci:checks`) : format Prettier, ESLint (taille des fichiers et des fonctions, complexité, sens des couches), types TypeScript, jscpd (aucun bloc dupliqué), knip (aucun code mort), tests Vitest avec seuils de couverture. Il prouve que le code respecte les règles du projet. Résultat : l'onglet Actions. La couverture se lit dans [`docs/coverage.md`](coverage.md).

**`e2e`** : build de production, faux TMDB, parcours Playwright sur trois projets : `iphone` et `desktop` (Chromium) et `iphone-webkit` (WebKit, le moteur de Safari sur iPhone). Les tests de clés d'accès (`@passkey`, qui ont besoin de l'authentificateur virtuel de Chromium) et les captures de référence ne tournent que sous Chromium. Le travail est réparti sur quatre machines. Il prouve que les parcours marchent, que l'accessibilité (axe) est sans défaut grave et que l'interface n'a pas bougé. En cas d'échec, le rapport Playwright est un artefact du run.

**Revue des dépendances** (pull requests seulement) : refuse l'ajout d'une dépendance qui a une faille connue de sévérité haute.

**`build`, `release`, `version`** (push sur `main` seulement, une fois le reste vert) : la nouvelle version est construite sans être mise en ligne, la base est sauvegardée puis migrée, la version est mise en ligne et vérifiée par un test de fumée, et retirée automatiquement si la fumée échoue. Le détail est dans `CLAUDE.md` (« Pièges »).

## Chaque nuit

**Sauvegarde et exercice de restauration** : la base de production est sauvegardée, chiffrée (artefact `db-backup-nightly-<run>`, 90 jours), puis la sauvegarde est restaurée dans une base SQLite locale jetable et comparée table par table (`scripts/verify-restore.mjs`). Elle prouve qu'une sauvegarde sert vraiment à restaurer : un compte de lignes différent, ou une sauvegarde sans aucune ligne, fait échouer le run. La sauvegarde prend le même groupe de concurrence que la mise en ligne : elle ne lit jamais la base au milieu d'une migration. Marche à suivre d'une vraie restauration : [`docs/restauration.md`](restauration.md).

**Fumée de la production** : les mêmes vérifications qu'après une mise en ligne (connexion, en-têtes de sécurité, clés d'accès liées à la bonne adresse, routes fermées, requêtes d'un autre site refusées), sans le rafraîchissement quotidien, que Vercel lance déjà.

**e2e répété** : toute la suite, trois fois, sans nouvelle tentative. Un test instable apparaît ici plutôt que lors d'une livraison. Résultat : onglet Actions, rapports Playwright en artefact en cas d'échec.

## Chaque lundi

**Tests de mutation** (`npm run mutation`, Stryker) : de petites erreurs sont glissées dans le code métier (`src/domain` et la logique pure de `src/features`), et on regarde si les tests les remarquent. Le score mesure la solidité des tests, pas leur couverture ; il ne bloque rien. Dernière mesure (2026-11-04) : **93,46 %** (1 087 mutants tués, 13 arrêtés par délai, 77 survivants, aucun hors couverture, environ 4 minutes). Les moins bien gardés : `domain/genres.ts` (37,5 %) et `features/draw/drawMotion.ts` (58,7 %). Résultat : artefact `mutation-report` (rapport HTML, 30 jours).

**Lighthouse** (`npm run test:lighthouse`) : performance, accessibilité et bonnes pratiques des écrans connectés, en mobile, sous Chromium dans Docker. Seuils : performance ≥ 80, accessibilité = 100, bonnes pratiques ≥ 90. Mesures du 2026-11-04 (performance / accessibilité / bonnes pratiques) :

| Écran        | Perf. | Access. | Bonnes prat. |
| ------------ | ----- | ------- | ------------ |
| `/connexion` | 100   | 100     | 100          |
| `/`          | 100   | 100     | 100          |
| `/swipe`     | 92    | 100     | 100          |
| `/list`      | 91-92 | 100     | 100          |

Résultat : résumé du job et artefact `lighthouse-report` (30 jours).

**OpenSSF Scorecard** : note publique de l'hygiène du dépôt (actions épinglées, permissions minimales, revue des dépendances, politique de sécurité…). Résultat : le badge du README, le [rapport en ligne](https://scorecard.dev/viewer/?uri=github.com/thogio8/we-watch) et l'onglet Security (Code scanning).

## En continu, côté GitHub

- **CodeQL** (suite étendue) : analyse statique, onglet Security → Code scanning.
- **Secret scanning et push protection** : un secret poussé est signalé, ou refusé avant le push.
- **Dependabot** : alertes de sécurité, mises à jour de sécurité, et une pull request de mises à jour chaque lundi.
- **Signalement privé de failles** : voir [`SECURITY.md`](../SECURITY.md).
- **Ruleset `protect-main`** : `main` ne se supprime pas et ne se réécrit pas.

La CI d'un contributeur externe attend l'approbation du mainteneur ([`CONTRIBUTING.md`](../CONTRIBUTING.md)).
