# Durcissement OpenSSF (2.0.x) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remonter la note OpenSSF Scorecard du dépôt par de vraies bonnes pratiques, sans fonctionnalité nouvelle. Concrètement : traiter les failles des dépendances de développement, ajouter des tests de propriétés (fast-check) sur le métier pur, donner une vraie vérification aux PR de version, et faire passer tout changement par une PR.

**Architecture:** des `overrides` npm limités aux montées compatibles (même version majeure), chacune prouvée par la CI complète et un vrai `vercel build`. Les tests de propriétés vivent à côté des tests unitaires du domaine. Le job `version` vérifie que la PR de release-please ne touche que les fichiers de version, puis pose un statut de commit. La protection de `main` (ruleset) et les réglages de fusion du dépôt viennent en dernier, une fois ce travail fusionné.

**Tech Stack:** npm overrides, fast-check (Vitest), GitHub Actions (statuts de commit), GitHub rulesets.

**Spec:** la demande validée en conversation le 2026-11-04. Retenu : le passage par des PR, les failles, fast-check, et la vérification des PR de version. Écarté pour l'instant : un second relecteur humain, et le questionnaire OpenSSF Best Practices (plus tard, fait par le mainteneur).

## Contraintes globales

- Branche `chore/openssf-hardening` partie de `origin/main` (a66ff7b, 2.0.3).
- Commits : un header Conventional Commits en anglais, sans body, sans trailer `Co-Authored-By`, sans mention d'un outil d'IA. Types `chore`, `test`, `ci` ou `docs` : rien ne publie de version.
- Les règles de `CLAUDE.md` s'appliquent : 200 lignes par fichier, 80 par fonction, complexité 10, jscpd, knip, couverture 100 %. Noms de tests en français, code et commentaires en anglais.
- Les actions sont épinglées par SHA, la version en commentaire. Le jeton est en lecture seule par défaut, et un job n'élargit que ce dont il a besoin.
- Ne jamais lancer `npm start`. Ne jamais lire ni écrire la prod. Ne jamais pousser sur `main` : tout passe par une PR.
- Aucun `--force` ni `--legacy-peer-deps` avec npm. Aucune montée de version majeure par override.

## Points d'attention de la revue

1. **Un override qui casse la CLI Vercel** casserait le déploiement de la prod, et la CI des PR ne lance pas `vercel build`. Chaque override doit être prouvé par un `vercel build` local hors ligne (tâche 1), en plus de `npm run ci`.
2. **Un override qui satisfait npm audit sans corriger** : la version résolue dans le lockfile doit être la version corrigée, pour chaque copie du paquet (`npm ls <paquet>`).
3. **Un test de propriété qui ne teste rien** : chaque propriété doit pouvoir échouer. Le prouver en cassant temporairement une règle métier et en vérifiant que fast-check trouve un contre-exemple.
4. **Une PR de version qui toucherait autre chose que la version** : la vérification doit échouer (et ne rien fusionner) si un autre fichier change. Elle doit être testée sur une liste de fichiers, sans appel réseau.
5. **Le ruleset qui bloquerait la release automatique** : la PR de release-please, créée et fusionnée par le jeton du workflow, doit pouvoir passer. Seule l'app GitHub Actions peut contourner la règle, et personne d'autre, administrateur compris.

---

### Tâche 1 : failles des dépendances de développement

**Files:**
- Modify: `package.json` (`overrides`), `package-lock.json`
- Create: `docs/dependances.md`, qui fait le point des failles : pour chaque paquet, la version corrigée retenue ou la raison de l'écart (montée majeure exigée, outil cassé), et la date.
- Modify: `docs/security-audit-2.0.md` (une ligne vers `docs/dependances.md`), `CLAUDE.md` (« Pièges » : les overrides se revoient à chaque montée de la CLI Vercel ou des outils concernés, et se retirent dès que l'outil embarque la version corrigée).

**Interfaces:**
- Produces : `npm audit --omit=dev` à 0. `npm audit` ne garde que les failles écartées et justifiées dans `docs/dependances.md`.

- [ ] **Step 1 :** pour chaque paquet vulnérable (`@fastify/busboy`, `ajv`, `esbuild`, `glob`, `js-yaml`, `minimatch`, `path-to-regexp`, `smol-toml`, `tar`, `undici`, `zod`), trouver la première version corrigée **dans la même version majeure** que chaque copie présente (`npm ls <paquet>`, avis GHSA). Une copie sans correction dans sa version majeure est écartée.
- [ ] **Step 2 :** ajouter les overrides **imbriqués par parent** quand un paquet existe en plusieurs versions majeures (ex. `"vercel": { "undici": "6.29.1" }`), sinon un override global en `^x.y.z`. `npm install`, puis vérifier avec `npm ls` que chaque copie résolue est corrigée.
- [ ] **Step 3 : preuve que la CLI Vercel marche encore.** Un `vercel build` hors ligne dans un dossier temporaire du scratchpad, avec un `.vercel/project.json` factice (`{"projectId":"prj_local","orgId":"team_local","settings":{"framework":"nextjs"}}`) et les variables de `.env.example` : la commande doit produire `.vercel/output`. Aussi : `npx --no vercel --version`, `npx drizzle-kit --version`, `npm run lint`, `npm run mutation` (Stryker et son minimatch) et `npm run test:lighthouse` (glob). Si un outil casse, retirer l'override en cause et l'écarter, avec la raison.
- [ ] **Step 4 :** `npm run ci`. Attendu : vert. Rédiger `docs/dependances.md`.
- [ ] **Step 5 : commit** `chore(deps): override vulnerable transitive dev dependencies with patched versions`

### Tâche 2 : tests de propriétés (fast-check)

**Files:**
- Modify: `package.json` (devDependency `fast-check` à version exacte)
- Create: `src/domain/*.property.test.ts` pour les modules suivants, si leurs règles s'y prêtent (lire chaque module et ses tests avant de choisir) : `draw-session.ts` (le tirage ne rend qu'un film de la liste, jamais un film écarté pour la soirée ; une liste non vide donne toujours un film tant qu'il en reste), `tonight.ts` (filtrer n'ajoute jamais de film ; chaque film gardé respecte chaque filtre ; sans filtre, rien n'est retiré), `transitions.ts` (toute suite de transitions autorisées laisse un statut valide), `label.ts` / `display-name.ts` / `group.ts` (normaliser est idempotent ; un nom accepté reste accepté après normalisation ; les bornes de longueur), `time.ts` si une propriété simple existe (ex. « FINI À » toujours postérieur au départ).
- Modify: `vitest.config.ts` seulement si le motif `*.property.test.ts` n'est pas déjà couvert par `include`.

**Interfaces:**
- Produces : des tests nommés en français, par exemple « pour toute liste et tout filtre, filtrer ne rajoute jamais de film ». Nombre d'exécutions par défaut de fast-check, et une graine affichée en cas d'échec (le défaut de fast-check).

- [ ] **Step 1 :** écrire les propriétés, avec des arbitraires construits sur les vrais types du domaine (réutiliser `tests/helpers/movies.ts` quand c'est possible).
- [ ] **Step 2 : prouver que chaque propriété mord.** Casser temporairement la règle visée et montrer que fast-check trouve un contre-exemple, puis restaurer (noter dans le rapport la commande et l'extrait de l'échec).
- [ ] **Step 3 :** `npm run ci:checks`. Attendu : vert, aucun doublon jscpd, temps de `npm test` augmenté de moins de 10 s.
- [ ] **Step 4 : vérifier la détection par Scorecard.** Lire la règle de détection fast-check dans le code source d'ossf/scorecard (checks/raw/fuzzing.go : motif de fichier et d'import) et confirmer que nos fichiers y correspondent.
- [ ] **Step 5 : commit** `test(domain): check the business rules with property-based tests`

### Tâche 3 : une vraie vérification pour les PR de version

**Files:**
- Create: `scripts/release-pr-files.mjs` (sur l'entrée standard, la liste des fichiers changés d'une PR, un par ligne ; code 0 si tous sont des fichiers de version, sinon code 1 et la liste des intrus)
- Test: `tests/scripts/release-pr-files.test.ts`
- Modify: `.github/workflows/ci.yml` (job `version`), `CLAUDE.md` (« Livrer une version », point 5)

**Interfaces:**
- Produces : les fichiers de version sont exactement `CHANGELOG.md`, `version.txt` et `.release-please-manifest.json`, la même liste que `paths-ignore` (un test le garantit en lisant `ci.yml`). Dans le job `version`, avant la fusion : `gh pr diff "$number" --name-only | node scripts/release-pr-files.mjs`, puis un statut de commit sur le SHA de tête de la PR (`gh api repos/$GITHUB_REPOSITORY/statuses/<sha> -f state=success -f context=ci/release-files -f description="version files only"`). Si un autre fichier change : statut `failure`, aucune fusion, et le job échoue. Le job prend `statuses: write`, en plus de ses permissions actuelles.

- [ ] **Step 1 : tests en échec** : « une PR qui ne touche que les fichiers de version passe », « un autre fichier fait échouer et il est nommé », « une liste vide échoue », « la liste suit paths-ignore de ci.yml ».
- [ ] **Step 2 :** implémenter le script, puis le job. Vérifier ensuite avec `npx vitest run tests/scripts` et actionlint (Docker).
- [ ] **Step 3 : vérifier la détection par Scorecard.** Lire la règle CI-Tests dans ossf/scorecard (checks/evaluation/ci_tests.go ou raw : quels contextes de statut et quelles apps de check comptent) et choisir le `context` en conséquence. S'il ne compte pas, le dire dans le rapport : la vérification reste utile en elle-même.
- [ ] **Step 4 : commit** `ci(release): check that release PRs only touch version files`

### Tâche 4 : tout passe par une PR (documentation)

**Files:**
- Modify: `CLAUDE.md`
  - « Livrer une version » : branche, PR, CI verte, fusion `gh pr merge --rebase`, jamais `--squash` ni `--merge`, sinon release-please perd les types de commits. Un push = une version devient une PR = une version.
  - « Conventions » : « L'agent du mainteneur peut commiter et pousser seul » devient pousser une branche, ouvrir la PR et la fusionner une fois verte.
  - « Pièges » : `main` est protégée (PR et checks requis, seule l'app GitHub Actions contourne pour la PR de version).
- Modify: `CONTRIBUTING.md` (le même déroulé), `docs/qualite.md` (le tableau « à chaque PR » / « à chaque fusion sur main »).

- [ ] **Step 1 :** écrire. **Step 2 :** `npx prettier --check` sur les fichiers modifiés. **Step 3 : commit** `docs: work through pull requests only`

### Tâche 5 (contrôleur, après la fusion de cette branche) : protéger `main`

Faite par le contrôleur avec `gh api`, après la fusion, car ce sont des réglages du dépôt et non du code.
- Le ruleset `protect-main` (id 26540395) garde suppression et non-fast-forward interdits, et gagne :
  - `pull_request` (0 approbation requise, résolution des conversations requise) ;
  - `required_status_checks` en `strict` : `checks`, `e2e (1)`, `e2e (2)`, `e2e (3)`, `e2e (4)`, `dependency-review` ;
  - un seul acteur de contournement, l'app GitHub Actions (`actor_type: Integration`, `actor_id: 15368`, `bypass_mode: always`).
- Réglages du dépôt : `allow_rebase_merge: true`, `allow_squash_merge: false`, `allow_merge_commit: false`, `delete_branch_on_merge: true`.
- Vérification : une PR de test qui ne change qu'un commentaire doit être bloquée tant que la CI n'est pas verte, puis fusionnable. La release suivante doit encore se fusionner seule.
