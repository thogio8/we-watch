# CI d'un dépôt public : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** profiter des minutes illimitées d'un dépôt public : sauvegarde et exercice de restauration chaque nuit, fumée quotidienne de la prod, e2e sur WebKit, e2e sur 4 machines, e2e en boucle la nuit, tests de mutation et Lighthouse chaque semaine, revue des dépendances et OpenSSF Scorecard.

**Architecture:** `ci.yml` reste la seule route vers la prod (on n'y change que le nombre de machines de l'e2e et une revue des dépendances sur les PR). Tout le reste vit dans des workflows planifiés à part (`nightly.yml`, `weekly.yml`), qui ne déploient rien et n'écrivent jamais en prod, à l'exception de la ligne `verification` que la fumée crée déjà. Les nouveaux scripts suivent ceux de `scripts/` : du `.mjs` testé dans `tests/scripts/`.

**Tech Stack:** GitHub Actions (épinglées par SHA), Playwright (Chromium et WebKit, dans l'image Docker), Stryker (runner Vitest), Lighthouse (API Node), `actions/dependency-review-action`, `ossf/scorecard-action`.

**Spec:** la demande validée en conversation le 2026-11-04 (les points 1 à 7 et le bloc sécurité). Le bloc sécurité est déjà fait par réglages GitHub, hors du code : scan de secrets et push protection, alertes et correctifs de sécurité Dependabot, signalement privé de failles, CodeQL (configuration par défaut, suite `extended`), ruleset `protect-main` (ni suppression ni force-push), approbation de la CI pour tout contributeur externe.

## Contraintes globales

- Branche `ci/public-repo` partie de `origin/main`. Jamais de push sur `main` sans l'accord du mainteneur.
- Commits : un header Conventional Commits en anglais, sans body, sans trailer `Co-Authored-By`, sans mention d'un outil d'IA. Types `ci`, `test`, `chore` ou `docs` : rien de tout ça ne publie de version.
- Chaque action est épinglée par le SHA de son commit, la version en commentaire (`uses: owner/action@<sha> # vX.Y.Z`) ; le SHA s'obtient par `gh api repos/<owner>/<action>/git/ref/tags/<tag>` (si c'est un tag annoté, suivre jusqu'au commit).
- `permissions: contents: read` en tête de chaque workflow ; un job n'élargit que ce dont il a besoin.
- Un secret n'est posé que sur l'étape qui s'en sert, jamais dans l'`env` d'un job ni sur `npm ci`. Un job qui lit la prod installe avec `npm ci --ignore-scripts`.
- Rien ne doit afficher un secret, un corps de réponse de la prod ni le contenu d'une sauvegarde : seulement des statuts et des comptes de lignes.
- Ne jamais lancer `npm start` (il se branche sur la prod), ne jamais lire la base Turso de prod depuis la machine locale.
- Garde-fous du dépôt (`npm run ci` vert) : ESLint (200 lignes par fichier, 80 par fonction…), jscpd, knip (toute nouvelle devDependency doit être utilisée par un fichier qu'il voit, sinon une entrée dans `knip.json`), Prettier, couverture des scripts testés.
- Noms de tests en français. Code et commentaires en anglais.

## Points d'attention de la revue

1. **Exercice de restauration sur une sauvegarde vide ou partielle** : une table absente de la base de prod est absente de la sauvegarde ; l'exercice doit le dire, pas échouer. En revanche, un compte de lignes différent après restauration doit échouer, en nommant la table (test de la tâche 2).
2. **Fumée planifiée sans le cron** : la fumée quotidienne ne doit pas appeler `/api/cron/refresh-movies` (Vercel le lance déjà) ; `SMOKE_CRON=skip` doit sauter **seulement** ce contrôle, et toute autre valeur que `skip` ou une valeur vide doit faire échouer le script (test de la tâche 1).
3. **WebKit et les clés d'accès** : l'authentificateur virtuel n'existe que sous Chromium (CDP). Sous WebKit, un test qui en a besoin doit être exclu par étiquette, pas tomber en panne (tâche 3). Un échec qui ne vient que de WebKit est peut-être un **vrai bug pour l'iPhone** : on le signale au mainteneur, on ne l'étouffe pas.
4. **Sauvegarde de nuit pendant une livraison** : la sauvegarde planifiée prend le même groupe de concurrence `production` que le job `release` (sans annulation), pour ne jamais lire la base au milieu d'une migration.
5. **Workflows planifiés désactivés** : GitHub coupe un `schedule` après 60 jours sans activité sur un dépôt public. On le documente dans `CLAUDE.md`, avec `workflow_dispatch` sur chaque workflow pour relancer à la main.

---

### Tâche 1 : fumée sans le cron (`SMOKE_CRON=skip`)

**Files:**
- Modify: `scripts/smoke-prod.sh` (le bloc final du cron, et les commentaires d'en-tête)
- Test: `tests/scripts/smoke-prod.test.ts`

**Interfaces:**
- Produces: variable d'environnement `SMOKE_CRON` : vide (défaut) = contrôle du cron comme aujourd'hui ; `skip` = affiche `– daily purge and refresh not checked (SMOKE_CRON=skip)` et n'appelle pas `/api/cron/refresh-movies` ; `CRON_SECRET` n'est alors pas requis. Toute autre valeur : `✕ SMOKE_CRON: expected skip or empty, received <valeur>`, code 1, avant toute requête.

- [ ] **Step 1 : tests en échec**, dans le style du fichier (fausse prod) :
  - « avec SMOKE_CRON=skip, la fumée passe sans appeler le cron ni connaître CRON_SECRET » : succès, la fausse prod n'a reçu aucune requête sur le chemin du cron, la sortie contient `(SMOKE_CRON=skip)`.
  - « une valeur inconnue de SMOKE_CRON fait échouer la fumée avant toute requête » : `SMOKE_CRON=yes` → code 1, sortie `✕ SMOKE_CRON: expected skip or empty, received yes`, aucune requête reçue.
- [ ] **Step 2 :** `npx vitest run tests/scripts/smoke-prod.test.ts`. Attendu : les deux nouveaux tests échouent.
- [ ] **Step 3 : implémenter** la validation près de celle d'`EXPECT_SIGNUP` et le saut du dernier bloc.
- [ ] **Step 4 :** relancer le fichier de test. Attendu : tout passe.
- [ ] **Step 5 : commit** `ci(smoke): let the daily smoke skip the cron call`

### Tâche 2 : exercice de restauration (`scripts/verify-restore.mjs`)

**Files:**
- Create: `scripts/verify-restore.mjs`
- Test: `tests/scripts/verify-restore.test.ts`

**Interfaces:**
- Consumes: `readBackup(path, keyHex)` (`scripts/read-backup.mjs`), `TABLES` (`scripts/backup-tables.mjs`), `quote` (`scripts/insert-rows.mjs`).
- Produces: CLI `BACKUP_KEY=… DATABASE_URL=… node scripts/verify-restore.mjs <backup>` ; pour chaque table de `TABLES`, dans l'ordre : `<table>: <n> rows ✓` si la base restaurée a autant de lignes que la sauvegarde, `<table>: absente de la sauvegarde` si la sauvegarde n'a pas la table ; un écart donne `<table>: <attendu> attendues, <trouvé> trouvées`, puis `restauration incomplète` et le code 1. Une sauvegarde sans aucune ligne en tout échoue aussi : `sauvegarde vide`, code 1 (une prod qui sert a forcément au moins un utilisateur). Succès : `restauration vérifiée`, code 0. N'affiche jamais de données ni la clé.

- [ ] **Step 1 : tests en échec**, comme `restore-db.test.ts` (fichiers jetables, base migrée, sauvegarde chiffrée par le vrai `backup-db.mjs`, puis `restore-db.mjs`) :
  - « une sauvegarde restaurée se vérifie table par table » : code 0, sortie contenant `user: 1 rows ✓` et `restauration vérifiée`.
  - « une ligne manquante après restauration est nommée et fait échouer » : supprimer une ligne de `group_movie` dans la cible avant de vérifier → code 1, sortie `group_movie: 2 attendues, 1 trouvées` et `restauration incomplète`.
  - « une table absente de la sauvegarde est dite, sans échec » : sauvegarde écrite sans `rate_limit` ni une autre table facultative → la ligne `absente de la sauvegarde`, code 0.
  - « une sauvegarde vide échoue » : code 1, `sauvegarde vide`.
  - « la sortie ne contient ni la clé ni une donnée » : ni `KEY` ni un prénom de la base dans stdout/stderr.
- [ ] **Step 2 :** `npx vitest run tests/scripts/verify-restore.test.ts`. Attendu : échec (script absent).
- [ ] **Step 3 : implémenter** : une lecture `select count(*)` par table, en un seul `client.batch` en lecture.
- [ ] **Step 4 :** relancer. Attendu : tout passe ; `npm run dup` sans doublon avec `restore-db.test.ts` (extraire un helper dans `tests/helpers/` si jscpd se plaint).
- [ ] **Step 5 : commit** `ci(backup): verify a restored backup table by table`

### Tâche 3 : e2e sur WebKit (iPhone)

**Files:**
- Modify: `playwright.config.ts` (projets), les specs qui ont besoin d'une clé d'accès virtuelle (`e2e/auth.spec.ts`, `e2e/account.spec.ts`, `e2e/invitations.spec.ts`) : étiquette `@passkey` (option `tag` de `test`, Playwright ≥ 1.42).
- Possibly modify: `e2e/csp.ts` si le message de console de WebKit pour une violation CSP n'est pas attrapé (`e2e/csp-watcher.spec.ts` le prouve sur chaque projet).

**Interfaces:**
- Produces: un troisième projet Playwright `iphone-webkit` : `devices["iPhone 13"]` (WebKit, son navigateur par défaut), `grepInvert: /@passkey/`, `testIgnore: /visual\.spec\.ts/` (les captures de référence restent celles de Chromium : les doubler pour un second moteur ferait 68 images de plus à garder à la main).

- [ ] **Step 1 :** étiqueter `@passkey` chaque test qui utilise `visitor`, `guest` ou `virtualAuthenticator`, puis ajouter le projet.
- [ ] **Step 2 :** `npm run test:e2e -- --project=iphone-webkit`. Attendu : tout passe. Pour chaque échec : diagnostiquer (trace). Un écart de l'environnement de test (sélecteur, minutage, message de console) se corrige dans le test. **Un comportement de l'appli faux sous WebKit est un bug pour l'iPhone : arrêter et le rapporter au mainteneur** avec la trace, sans le contourner ni l'exclure.
- [ ] **Step 3 :** `npm run test:e2e` en entier. Attendu : les trois projets passent, aucune capture modifiée.
- [ ] **Step 4 : commit** `test(e2e): run the end-to-end tests on WebKit, the iPhone's engine`

### Tâche 4 : e2e sur 4 machines et revue des dépendances des PR

**Files:**
- Modify: `.github/workflows/ci.yml` (matrice `shard: [1, 2, 3, 4]`, `--shard=${{ matrix.shard }}/4`, commentaire d'en-tête « split over four machines »), le job `dependency-review`.
- Modify: `tests/scripts/release-budget.test.ts` seulement s'il lit le nombre de shards.

**Interfaces:**
- Produces: job `dependency-review` (`if: github.event_name == 'pull_request'`, `permissions: contents: read`, `actions/checkout` puis `actions/dependency-review-action` épinglé, `fail-on-severity: high`). Il ne fait pas partie des `needs` de `release` (il ne tourne jamais sur `main`).

- [ ] **Step 1 :** modifier `ci.yml`.
- [ ] **Step 2 :** `npx vitest run tests/scripts` et `npx prettier --check .github`. Attendu : vert. Valider la syntaxe avec `npx --yes @action-validator/cli .github/workflows/ci.yml` si disponible ; sinon, avec `actionlint` par Docker (`docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`).
- [ ] **Step 3 : commit** `ci: split the e2e over four machines and review new dependencies on PRs`

### Tâche 5 : workflow de nuit (`nightly.yml`)

**Files:**
- Create: `.github/workflows/nightly.yml`
- Test: `tests/scripts/nightly-workflow.test.ts`

**Interfaces:**
- Consumes: `scripts/backup-db.mjs`, `scripts/restore-db.mjs`, `scripts/verify-restore.mjs` (tâche 2), `scripts/smoke-prod.sh` avec `SMOKE_CRON=skip` (tâche 1).
- Produces:
  - `on: schedule: - cron: "30 1 * * *"` (02:30 à Paris l'hiver, 03:30 l'été : après les soirées, loin du cron de Vercel à 14:00 UTC) et `workflow_dispatch`.
  - Job `backup` : `concurrency: { group: production, cancel-in-progress: false }`, `npm ci --ignore-scripts`, `node scripts/backup-db.mjs backup/db.json.enc` (secrets `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BACKUP_KEY` sur cette étape seule), artefact `db-backup-nightly-${{ github.run_id }}`, 90 jours, `if-no-files-found: error`.
  - Job `restore-drill` (`needs: backup`) : télécharge l'artefact, `DATABASE_URL=file:drill.db npm run db:migrate`, puis `restore-db.mjs` et `verify-restore.mjs` avec `BACKUP_KEY` et `DATABASE_URL=file:drill.db` sur ces seules étapes. Aucun secret de base de prod dans ce job.
  - Job `smoke` : `bash scripts/smoke-prod.sh` avec `PROD_URL: ${{ vars.PROD_URL }}`, `SMOKE_CRON: skip`, `EXPECT_SIGNUP: ${{ vars.EXPECT_SIGNUP || 'invite' }}`, sans aucun secret.
  - Job `e2e-repeat` : la même installation que le job `e2e` de `ci.yml`, matrice 4 shards, `npm run test:e2e -- --shard=${{ matrix.shard }}/4 --repeat-each=3 --retries=0`, rapport en artefact sur échec (7 jours).
  - Chaque job : `timeout-minutes` (backup 10, drill 10, smoke 5, e2e-repeat 30).

- [ ] **Step 1 : test en échec** `tests/scripts/nightly-workflow.test.ts`, qui lit le YAML comme du texte (comme `release-budget.test.ts`, sans nouvelle dépendance) :
  - « chaque action du dépôt est épinglée par un SHA » : toute ligne `uses:` de `.github/workflows/*.yml` hors `./` correspond à `@[0-9a-f]{40} # v` (le test couvre aussi `ci.yml` et le futur `weekly.yml`).
  - « aucun secret n'est posé dans l'env d'un job » : dans tout workflow, `secrets.` n'apparaît que sous un `env:` indenté au niveau d'une étape (indentation ≥ 10 espaces) ; dériver la règle de la forme réelle de `ci.yml`.
  - « la sauvegarde de nuit attend une livraison en cours » : le job `backup` de `nightly.yml` a `group: production` et `cancel-in-progress: false`.
  - « l'exercice de restauration ne voit aucun secret de base de prod » : le bloc du job `restore-drill` ne contient ni `secrets.DATABASE_URL` ni `secrets.DATABASE_AUTH_TOKEN`.
  - « la fumée de nuit n'appelle pas le cron » : le job `smoke` contient `SMOKE_CRON: skip` et aucun `secrets.`.
- [ ] **Step 2 :** `npx vitest run tests/scripts/nightly-workflow.test.ts`. Attendu : échec (fichier absent), mais les deux premiers tests passent déjà sur `ci.yml` seul (sinon corriger `ci.yml` d'abord).
- [ ] **Step 3 :** écrire `nightly.yml`.
- [ ] **Step 4 :** relancer le test, puis actionlint (tâche 4). Attendu : vert.
- [ ] **Step 5 : commit** `ci: back up, rehearse the restore, smoke production and repeat the e2e every night`

### Tâche 6 : tests de mutation (Stryker)

**Files:**
- Create: `stryker.config.mjs`
- Modify: `package.json` (devDependencies `@stryker-mutator/core` et `@stryker-mutator/vitest-runner` à version exacte, script `"mutation": "stryker run"`), `.gitignore` (`/reports/`, `/.stryker-tmp/`), `knip.json` si knip ne voit pas la config.

**Interfaces:**
- Produces: `npm run mutation` : mutants dans `src/domain/**/*.ts` et les `.ts` purs de `src/features/**` (hors `*.test.ts`, `use*.ts`, `actions.ts`, `__mocks__`), runner Vitest sur `vitest.config.ts`, rapports `html` et `clear-text`, `thresholds.break: null` (on mesure d'abord, aucun seuil ne bloque), `incremental: true` avec le fichier dans `reports/`.

- [ ] **Step 1 :** vérifier que la dernière version du runner Vitest de Stryker supporte Vitest 5 (`npm view @stryker-mutator/vitest-runner peerDependencies`). **Si non : arrêter et le rapporter**, sans rétrograder Vitest.
- [ ] **Step 2 :** installer, configurer, lancer `npm run mutation` en local. Attendu : un score affiché. Le noter pour le rapport final (score total et les 3 fichiers les plus faibles).
- [ ] **Step 3 :** `npm run ci:checks`. Attendu : vert (knip compris).
- [ ] **Step 4 : commit** `chore(test): measure the tests' strength with mutation testing`

### Tâche 7 : Lighthouse sur les écrans connectés

**Files:**
- Create: `playwright.lighthouse.config.ts`, `e2e/lighthouse/lighthouse.spec.ts`
- Modify: `package.json` (devDependency `lighthouse` à version exacte, script `"test:lighthouse": "PLAYWRIGHT_CONFIG=playwright.lighthouse.config.ts bash scripts/e2e.sh"` ou un argument `--config` passé à `scripts/e2e.sh`, au choix le plus simple), `playwright.config.ts` (`testIgnore` du dossier `e2e/lighthouse/`).

**Interfaces:**
- Consumes: la fixture `app` de `e2e/fixtures.ts` (Léa connectée, groupe « NOUS DEUX »), les serveurs et la base du worker.
- Produces: une config à un seul projet Chromium lancé avec `--remote-debugging-port=9222`, un worker. Le test ouvre `/connexion` (déconnecté), puis `/`, `/swipe` et `/list` (connecté, après avoir mis quelques films dans la liste avec `swipe()`), lance Lighthouse par son API Node sur ce port (`onlyCategories: ["performance", "accessibility", "best-practices"]`, profil mobile), écrit un rapport HTML par page dans `lighthouse-report/` et un résumé des scores dans `$GITHUB_STEP_SUMMARY` s'il existe. Seuils qui font échouer : `accessibility` = 1, `best-practices` ≥ 0.9, `performance` ≥ 0.8. Les seuils sont des constantes nommées en tête du fichier.

- [ ] **Step 1 :** écrire config et spec.
- [ ] **Step 2 :** `npm run test:lighthouse`. Attendu : les quatre pages mesurées. Si un seuil échoue, **ne pas l'abaisser** : laisser le test rouge, noter les scores et les principaux audits en échec, et remonter au mainteneur : c'est lui qui décide.
- [ ] **Step 3 :** `npm run ci`. Attendu : vert, et l'e2e normal ne lance pas Lighthouse.
- [ ] **Step 4 : commit** `test(perf): measure the connected screens with Lighthouse`

### Tâche 8 : workflow de la semaine (`weekly.yml`) et Scorecard

**Files:**
- Create: `.github/workflows/weekly.yml`
- Modify: `tests/scripts/nightly-workflow.test.ts` (rien si ses tests lisent déjà tous les workflows)

**Interfaces:**
- Consumes: `npm run mutation` (tâche 6), `npm run test:lighthouse` (tâche 7).
- Produces: `on: schedule: - cron: "0 3 * * 1"` (lundi, le jour de Dependabot) et `workflow_dispatch`.
  - Job `mutation` (60 min) : `npm ci`, `npm run mutation`, artefact `reports/mutation/` 30 jours ; cache `actions/cache` du fichier incrémental de Stryker.
  - Job `lighthouse` (20 min) : `npm ci`, `npm run test:lighthouse`, artefact `lighthouse-report/` 30 jours, `if: always()`.
  - Job `scorecard` : `permissions: { security-events: write, id-token: write, contents: read, actions: read }`, `actions/checkout` avec `persist-credentials: false`, `ossf/scorecard-action` épinglé (`results_format: sarif`, `publish_results: true` : décision du mainteneur, la note est publiée sur l'API publique d'OpenSSF pour le badge du README ; c'est pour cela qu'il faut `id-token: write`), puis `github/codeql-action/upload-sarif` épinglé.

- [ ] **Step 1 :** écrire `weekly.yml`.
- [ ] **Step 2 :** `npx vitest run tests/scripts` et actionlint. Attendu : vert.
- [ ] **Step 3 : commit** `ci: run mutation tests, Lighthouse and the OpenSSF Scorecard every week`

### Tâche 9 : documentation, à la façon des dépôts open source

Chaque public a son fichier, comme dans les grands dépôts : le README donne envie et oriente, les fichiers que GitHub reconnaît (`SECURITY.md`, `CONTRIBUTING.md`) servent les visiteurs, `docs/` porte le détail, `CLAUDE.md` les règles des agents.

**Files:**
- Create: `SECURITY.md` (GitHub l'affiche dans l'onglet Security) : versions suivies (la dernière seule) ; signaler une faille par « Report a vulnerability » (signalement privé), jamais par une issue publique ; délai de réponse visé (une semaine, projet perso) ; ce qui est protégé et comment, en quelques lignes renvoyant à `docs/security-audit-2.0.md` ; les outils automatiques (CodeQL, scan de secrets et push protection, Dependabot, Scorecard).
- Create: `CONTRIBUTING.md` (GitHub le propose à l'ouverture d'une issue ou d'une PR) : y déplacer la section « Contribuer » du README et l'étoffer : prérequis (Node 24, Docker pour l'e2e), commandes (`npm run ci`, `test:e2e`, `mutation`, `test:lighthouse`), Conventional Commits et leur effet sur la version, la CI d'un contributeur externe attend l'approbation du mainteneur, renvoi à `CLAUDE.md` pour les règles complètes.
- Create: `docs/qualite.md` : **ce qui tourne et quand**, en un tableau (à chaque PR / à chaque push sur `main` / chaque nuit / chaque lundi / en continu côté GitHub), puis une section par contrôle (ce qu'il prouve, où voir son résultat : onglet Actions, artefacts, onglet Security) ; la sauvegarde et l'exercice de restauration renvoient à `docs/restauration.md` ; le score de mutation et les scores Lighthouse mesurés en tâches 6 et 7, datés.
- Modify: `README.md` : le mainteneur aime les badges, mais **un badge ne doit jamais mentir**. Seuls entrent ceux qui sont calculés en direct, ou qui énoncent une règle que la CI fait respecter. On garde ceux d'aujourd'hui (CI, version, Next.js 16, PWA, licence) et on ajoute, sur deux lignes `<p align="center">` (« état » puis « pile et règles ») :
  - en direct :
    - le workflow de nuit (badge de `nightly.yml`) ;
    - CodeQL (`https://github.com/thogio8/we-watch/actions/workflows/github-code-scanning/codeql/badge.svg`) ;
    - OpenSSF Scorecard (`https://api.scorecard.dev/projects/github.com/thogio8/we-watch/badge`, lien vers `https://scorecard.dev/viewer/?uri=github.com/thogio8/we-watch`) ;
    - le dernier commit (`img.shields.io/github/last-commit/...`) ;
  - en statique (shields.io, couleurs de la DA comme les badges existants : rose `ff3fa4`, jaune `ffe600`, bleu `2f6bff`, encre `1b1b6b`), chacun avec un lien vers ce qui le prouve :
    - « couverture ≥ 95 % » vers `docs/coverage.md` (les seuils de `vitest.config.ts` la font respecter) ;
    - « testé sur Chromium + WebKit » vers `docs/qualite.md` ;
    - « accessibilité WCAG AA (axe) » ;
    - TypeScript strict ;
    - Playwright ;
    - « Conventional Commits » (lien vers le site) ;
    - « semver : release-please » ;
    - Dependabot.

  Ne pas créer de badge à valeur figée qui bouge souvent (score de mutation, Lighthouse) : ces chiffres vont, datés, dans `docs/qualite.md`. Chaque URL de badge doit répondre 200, et le badge Scorecard n'existe qu'après le premier passage de `weekly.yml` sur `main` : on l'ajoute quand même et on note dans le rapport final qu'il affichera « invalid » jusque-là. En plus du README : dans « Sous le capot », la ligne « Tests » cite WebKit et la ligne « CI/CD » les contrôles planifiés ; une ligne « Sécurité » vers `SECURITY.md` ; la section « Contribuer » réduite à deux lignes vers `CONTRIBUTING.md` et `docs/qualite.md`.
- Modify: `CLAUDE.md` (section « Pièges », le paragraphe de la CI : quatre machines, WebKit sans clé d'accès ni captures ; nouveau point « Workflows planifiés » : ce que font `nightly.yml` et `weekly.yml`, la sauvegarde de nuit dans le groupe `production`, `SMOKE_CRON=skip`, la coupure des `schedule` après 60 jours sans activité et `workflow_dispatch` pour relancer ; les réglages de sécurité GitHub du dépôt public ; `npm run mutation` et `npm run test:lighthouse` dans le tableau des commandes), `docs/restauration.md` (l'exercice de nuit et `verify-restore.mjs`).

- [ ] **Step 1 :** écrire.
- [ ] **Step 2 :** `npm run ci`. Attendu : vert.
- [ ] **Step 3 : vérifier le rendu** : `gh markdown-preview` n'existant pas, relire les liens relatifs (`grep -o '](\([^)]*\))' README.md SECURITY.md CONTRIBUTING.md docs/qualite.md`, chaque cible existe) et les badges (chaque URL répond 200 avec `curl -sI`).
- [ ] **Step 4 : commit** `docs: document quality, security and contributing like an open-source project`
