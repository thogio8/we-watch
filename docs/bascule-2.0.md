# Bascule de la prod : 1.3.x → 2.0.0

Le déroulé du jour où la prod passe aux comptes et aux groupes. À suivre dans l'ordre, case par case. Spec : `docs/superpowers/specs/2026-10-28-wewatch-v2-design.md`, §11.

Ces règles valent pour toute la page :

- **La prod ne se migre et ne se déploie que par la CI** (push sur `main`). Jamais `vercel --prod`, jamais `npm run db:migrate` ni un SQL lancé à la main sur la base de prod.
- **Aucun secret à l'écran ni dans un fichier suivi** : les commandes ci-dessous les lisent par une invite masquée (`read -rs`), les passent d'une commande à l'autre par un tube ou une variable (`openssl … |`, `"$(turso …)"`), ou les comparent sans les afficher. Jamais un secret en argument de commande (il resterait dans l'historique).
- Les commandes se lancent depuis la racine du dépôt. Celles qui visent l'adresse de prod commencent par la lire :

  ```bash
  PROD_URL="$(gh variable get PROD_URL)"
  ```

- Le CLI Vercel est celui du dépôt (`devDependencies`, version épinglée), lancé par `npx --no -- vercel` : `--no` refuse d'en télécharger un autre. Il faut donc un checkout de la 2.0 aux dépendances installées (`npm ci`) ; sinon `npx` s'arrête sur « npx canceled due to missing packages », sans rien changer.

## 0. Répétition de la migration

Faite le **2026-11-02**, sur la sauvegarde du dernier déploiement de `main` (run `40719347078` du 2026-10-28, artefact `db-backup-67de0aaaaea536e508f9113d00fc5761ff24b41e`, `movies.json` de la 1.3.x). Une base locale au schéma 1.3.x (0000–0001), les lignes de `movies`, puis `npm run db:migrate`, la commande de la CI.

| Contrôle | Résultat |
| --- | --- |
| Migrations | 2 (1.3.x), puis 11 |
| `movies` | 208 |
| Groupe « NOUS DEUX » | 1 groupe, 208 films |
| `movie_snapshot` | 208 |
| Statuts, avant comme après | `rejected` 137, `to_watch` 71 (aucun vu) |
| Films sans leur copie exacte (statut, dates) | 0 |
| `watched_legacy` | 0 (= nombre de vus) |
| `membership` | 0 |
| `PRAGMA foreign_key_check` / `integrity_check` | propres / `ok` |
| Durée | migration 385 ms, totale 406 ms (fichier local : sur Turso, compter quelques secondes) |
| `PRAGMA foreign_keys` de la prod | non mesuré (facultatif, voir §3) |

Verdict : **conforme**. La copie a été supprimée ensuite (`.rehearsal/` est ignoré par git).

**À refaire le jour J si `main` a été redéployée depuis** (une sauvegarde plus récente existe) :

```bash
rm -rf .rehearsal   # la cible doit être neuve : le script refuse une base qui a déjà une table
run="$(gh run list --branch main --workflow ci.yml --status success --limit 1 --json databaseId --jq '.[0].databaseId')"
sha="$(gh run view "$run" --json headSha --jq .headSha)"
gh run download "$run" -n "db-backup-$sha" -D .rehearsal/backup
node scripts/rehearse-migration.mjs .rehearsal/backup/movies.json
```

- [ ] Code de sortie 0, et chaque ligne cohérente : `nous-deux` = `movies`, `movie_snapshot` = `movies`, `membership: 0`, `foreign_key_check: ok`, `integrity_check: ok`. Un écart s'affiche `écart : <contrôle> : attendu …, reçu …` et donne le code 1 : ne pas basculer.
- [ ] Facultatif : ouvrir la copie dans l'appli. `npm run build`, puis, avec un environnement **entièrement explicite** (jamais `.env.production.local`, que `next start` chargerait pour toute variable absente) :

  ```bash
  read -rs TMDB_ACCESS_TOKEN && export TMDB_ACCESS_TOKEN   # ton jeton TMDB de dev, collé à l'invite masquée
  DATABASE_URL=file:.rehearsal/prod-copy.db DATABASE_AUTH_TOKEN= \
  BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  SIGNUP=invite OWNER_CODE="code local de test" CRON_SECRET= \
  npx next start
  ```

  Sur `http://localhost:3000` : « J’AI UN CODE PROPRIÉTAIRE », le code local, créer le compte ; « NOUS DEUX » montre les films, les écartés et les dates d'ajout.
- [ ] `rm -rf .rehearsal`

## 1. Avant la bascule

### 1.1 Le code

- [ ] Morceau 5 (« Mon compte ») fusionné dans `release/2.0.0`.
- [ ] Google, au choix du mainteneur (cocher l'une) :
  - [ ] 2.0.0 livrée sans Google : décision du mainteneur, notée dans la spec §13 ;
  - [ ] morceau 4 (Google) fusionné dans `release/2.0.0`.
- [ ] Morceau 6 (`feat/v2-blindage`) fusionné dans `release/2.0.0`, audit de sécurité (tâche 7) sans constat ouvert.
- [ ] Répétition faite sur l'artefact le plus récent (§0).
- [ ] `main` fusionnée dans `release/2.0.0`, et aucune migration venue de `main` :

  ```bash
  git fetch origin
  git diff --name-only origin/release/2.0.0...origin/main -- drizzle
  ```

  Attendu : **aucune ligne**. Drizzle ignore une migration plus ancienne que la dernière appliquée : une migration de `main` intercalée ferait sauter celles de la 2.0.
- [ ] CI verte sur la dernière PR vers `release/2.0.0` : `gh run list --branch release/2.0.0 --limit 1` (ou `gh pr checks <n°>`).
- [ ] Les deux ruptures sont dans la branche (release-please en tirera la **2.0.0**) :

  ```bash
  git log --oneline origin/main..origin/release/2.0.0 | grep '!:'
  ```

  Attendu : `feat(auth)!: accounts with passkeys` et `feat(groups)!: one list per group`.

### 1.2 Les secrets et variables

Une variable d'environnement Vercel ne s'applique qu'aux **nouveaux** déploiements : les régler maintenant ne change rien à la 1.3.x en ligne, et le retour arrière (§5) la remet avec son ancien environnement.

- [ ] **Secret GitHub `BACKUP_KEY`** : 64 caractères hexadécimaux. Sans lui, le job `release` s'arrête à la sauvegarde, avant toute migration.
  1. Générer la clé dans un fichier hors du dépôt, sans l'afficher ni fin de ligne (`scripts/backup-crypto.mjs` refuse tout ce qui n'est pas exactement 64 caractères hexadécimaux : la bascule s'arrêterait à la sauvegarde), la vérifier, et la donner à GitHub :

     ```bash
     (umask 077 && openssl rand -hex 32 | tr -d '\n' > ~/wewatch-backup-key.txt)
     if grep -Eqx '[0-9a-f]{64}' ~/wewatch-backup-key.txt && [ "$(wc -c < ~/wewatch-backup-key.txt)" -eq 64 ]; then
       echo "✓ 64 caractères hexadécimaux, sans fin de ligne" && gh secret set BACKUP_KEY < ~/wewatch-backup-key.txt
     else
       echo "✕ clé mal formée, rien n'est envoyé : recommencer"
     fi
     ```

  2. Joindre `~/wewatch-backup-key.txt` à une entrée du gestionnaire de mots de passe (« WeWatch BACKUP_KEY, créée le <date> »), puis `shred -u ~/wewatch-backup-key.txt`.
  3. `gh secret list` : `BACKUP_KEY` y figure.
  - Une clé changée ne déchiffre plus les anciens artefacts : **garder chaque clé hors ligne 90 jours** après son remplacement (la durée de vie d'un artefact).
- [ ] **Vercel, environnement Production**, depuis un dépôt lié (`npx --no -- vercel link` si `.vercel/` manque) :
  - `BETTER_AUTH_SECRET` (32 caractères au moins) :

    ```bash
    openssl rand -hex 32 | npx --no -- vercel env add BETTER_AUTH_SECRET production
    ```

  - `BETTER_AUTH_URL` = `PROD_URL` **au caractère près**, sans `/` final. Les passkeys sont liées à son nom d'hôte, et la fumée compare le `rpId` à l'hôte de `PROD_URL` : une différence fait échouer la fumée, donc revenir la prod en arrière. Le plus sûr est de le recopier :

    ```bash
    printf %s "$PROD_URL" | npx --no -- vercel env add BETTER_AUTH_URL production
    ```

  - `SIGNUP=invite` :

    ```bash
    printf invite | npx --no -- vercel env add SIGNUP production
    ```

  - `OWNER_CODE` : 12 caractères au moins, une phrase de plusieurs mots, gardée dans le gestionnaire de mots de passe (c'est elle qu'on tapera dans l'appli). La coller à l'invite masquée :

    ```bash
    read -rs v && printf %s "$v" | npx --no -- vercel env add OWNER_CODE production; unset v
    ```

  - `CRON_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `TMDB_ACCESS_TOKEN` : **inchangés**.
  - `ACCESS_CODE` : **gardé** jusqu'à la 2.1 (un retour vers la 1.3.x en a besoin ; la 2.0 l'ignore).
- [ ] **Vérifier sans rien afficher** : le fichier tiré contient des secrets, il reste dans `.vercel/` (ignoré par git) et il est supprimé aussitôt.

  ```bash
  npx --no -- vercel env pull --yes --environment=production .vercel/.env.check
  node -e '
    const env = Object.fromEntries(require("fs").readFileSync(".vercel/.env.check", "utf8")
      .split("\n").map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
    const ok = (name, test) => console.log((test(env[name] ?? "") ? "✓ " : "✕ ") + name);
    ok("BETTER_AUTH_SECRET", (v) => v.length >= 32);
    ok("BETTER_AUTH_URL", (v) => v === process.argv[1] && !v.endsWith("/"));
    ok("SIGNUP", (v) => v === "invite");
    ok("OWNER_CODE", (v) => v.trim().length >= 12);
    ok("CRON_SECRET", (v) => v.length >= 16);
    ok("ACCESS_CODE", (v) => v.length > 0);
  ' "$PROD_URL"
  rm .vercel/.env.check
  ```

  Attendu : six `✓`. Une variable marquée « Sensitive » dans Vercel se tire vide (donc `✕`) : vérifier alors sa présence avec `npx --no -- vercel env ls production` et sa valeur dans le gestionnaire de mots de passe.

### 1.3 Si une variable manque quand même

Le proxy valide l'environnement à chaque requête : une variable absente ou invalide met **tout** en 500, `/connexion` comprise. La fumée échoue dès sa première vérification et la CI remet la 1.3.x (§5.1). Rien n'est perdu, mais la migration est passée : c'est le cas « retour automatique » de §5 et §6.

## 2. La bascule

Le mainteneur l'approuve et la lance lui-même.

- [ ] **Personne n'utilise l'appli du push jusqu'à la fumée verte** : prévenir l'autre membre. Entre la copie de la liste (migration 0006) et la mise en ligne de la 2.0, la 1.3.x sert encore : un film ajouté, écarté ou marqué vu sur elle pendant ces minutes n'arriverait pas dans « NOUS DEUX » (pas de retour arrière, donc pas de rattrapage). Si cela arrive quand même : §6, dernier paragraphe.

- [ ] Fusion de `release/2.0.0` dans `main` par un **commit de fusion** (jamais en squash : les commits `feat!` doivent rester visibles pour release-please) :

  Depuis n'importe quel worktree : la commande va dans celui où `main` est extraite (le checkout principal), ou l'extrait ici si aucun ne l'a.

  ```bash
  git fetch origin
  main_dir="$(git worktree list --porcelain | awk '/^worktree /{w=substr($0,10)} $0=="branch refs/heads/main"{print w}')"
  if [ -n "$main_dir" ]; then cd "$main_dir"; else git checkout main; fi
  git status --short   # attendu : rien (arbre propre)
  git pull --ff-only
  git merge --no-ff origin/release/2.0.0 -m "chore(release): merge 2.0.0"
  git log --oneline main~1..main | grep '!:'
  ```

  Attendu : les deux `feat…!:` de §1.1. `main~1` est l'ancienne `main` (premier parent).
- [ ] Installer les dépendances de la 2.0 dans ce checkout (son `node_modules` est celui de la 1.3.x : sans Better Auth, le hook pre-push échouerait) :

  ```bash
  npm ci
  ```

- [ ] `git push origin main`. Le hook pre-push relance `npm run ci` (vérifications, tests, build et e2e dans Docker : **Docker doit tourner**, compter quelques minutes). Puis suivre le run :

  ```bash
  sleep 15   # le temps que GitHub enregistre le run
  gh run watch "$(gh run list --branch main --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
  ```

### Ce que fait la CI

`checks`, `e2e` et `build` en parallèle (`build` construit et envoie le déploiement 2.0 **sans le mettre en ligne**), puis, tous verts, `release` :

1. **Sauvegarde chiffrée** de la base 1.3.x (`scripts/backup-db.mjs`) : `movies: <n> rows`, les autres tables `absent`, `saved to backup/db.json.enc (encrypted)`. Artefact `db-backup-<sha du commit de fusion>`, 90 jours. Sans `BACKUP_KEY` valide, le job s'arrête ici : rien n'est migré ni mis en ligne (régler le secret, puis `gh run rerun <id> --failed`).
2. **Migration** `npm run db:migrate` : 0002 à 0010 (comptes, groupes, copie de la liste dans « NOUS DEUX », invitations, index, limites de tentatives). Additive : `movies` reste intacte.
3. **Mise en ligne** du déploiement construit (`scripts/vercel-prod.sh promote`), qui attend que la prod le serve : `✓ <id> in production`.
4. **Fumée** (`scripts/smoke-prod.sh`), six lignes attendues :
   - `✓ /connexion 200`
   - `✓ / 307 → /connexion`
   - `✓ /connexion content-security-policy with frame-ancestors 'none'`
   - `✓ passkey options 200, rpId <hôte de PROD_URL>`
   - `✓ /api/auth/ok 404`
   - `✓ purge and refresh {…"failed":[]…}`
5. **Fumée rouge** : la CI remet le déploiement d'avant (la 1.3.x). Voir §5.1.
6. Tout vert : le job `version` publie la **2.0.0** (release-please : PR fusionnée seule, tag, release). Jamais de version à la main.

## 3. Après la bascule

- [ ] Run vert de bout en bout, puis `gh release view v2.0.0` : la release existe.
- [ ] En-têtes servis :

  ```bash
  curl -sI "$PROD_URL/connexion" | grep -iE '^(content-security-policy|strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|cross-origin-opener-policy|permissions-policy):'
  curl -sI "$PROD_URL/invitation/x" | grep -i '^referrer-policy:'
  ```

  Attendu, sur `/connexion` : `content-security-policy: default-src 'self'; …; frame-ancestors 'none'; …`, `strict-transport-security: max-age=63072000`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: strict-origin-when-cross-origin`, `cross-origin-opener-policy: same-origin`, `permissions-policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`. Sur `/invitation/x` : `referrer-policy: no-referrer`.
- [ ] Le propriétaire, dans la **PWA installée sur iPhone** : l'ancien code d'accès est ignoré, l'appli ouvre « ENTRE DANS WEWATCH ». « J’AI UN CODE PROPRIÉTAIRE », son prénom, `OWNER_CODE`, puis Face ID. Il arrive dans « NOUS DEUX » : les films à voir et les écartés de la 1.3.x, avec leurs dates (§0 : 71 à voir, 137 écartés au 2026-10-28).
- [ ] Il invite l'autre membre : pastille → « MEMBRES ET INVITATION » → « PARTAGER » (ou « COPIER LE LIEN D’INVITATION »). L'autre ouvre le lien, « CRÉER UN COMPTE », et rejoint « NOUS DEUX ». Le lien est un secret : l'envoyer par un canal privé.
- [ ] Les deux comptes du couple sont dans « NOUS DEUX » (« MEMBRES ET INVITATION » les montre tous les deux) : **retirer `OWNER_CODE` de Vercel**, puis relancer la CI pour que la prod serve sans lui (une variable Vercel ne vaut que pour les déploiements suivants) :

  ```bash
  npx --no -- vercel env rm OWNER_CODE production --yes
  gh workflow run ci.yml --ref main   # puis la suivre (§2)
  ```

  Pourquoi : un compte créé avec ce code rejoint « NOUS DEUX » d'office, sans lien d'invitation, et le code ne s'éteint jamais tant qu'il est dans Vercel ; une fuite (capture d'écran, gestionnaire partagé) ouvrirait la liste du couple pour toujours (audit de sécurité, L1). Il ne sert qu'à créer le premier compte : ensuite, on entre par un lien d'invitation, qui marche avec `SIGNUP=invite` et se régénère. Attendu ensuite sur `/connexion` : toujours « WEWATCH SE REJOINT SUR INVITATION » ; un code tapé dans « J’AI UN CODE PROPRIÉTAIRE » est refusé. Le code reste dans le gestionnaire de mots de passe : en cas de besoin (base perdue sans sauvegarde), le remettre le temps d'une inscription (§1.2).
- [ ] Journaux Vercel (tableau de bord du projet → Logs, depuis l'heure de la bascule) : **aucune** ligne « Rate limiting could not determine a client IP ». Sinon, les limites de tentatives partagent un seul compteur entre tous : à signaler.
- [ ] Facultatif : la valeur de `PRAGMA foreign_keys` sur Turso, en lecture seule. Le code ne compte plus sur les cascades : 0 comme 1 conviennent, c'est pour la noter en §0.

  ```bash
  export DATABASE_AUTH_TOKEN="$(turso db tokens create <base> --read-only --expiration 1h)"
  DATABASE_URL="$(turso db show <base> --url)" node scripts/rehearse-migration.mjs --probe
  unset DATABASE_AUTH_TOKEN
  ```

  Attendu : `foreign_keys: 0` ou `foreign_keys: 1`, rien d'autre. Le jeton expire seul au bout d'une heure.
- [ ] Commit de suivi `docs: …` qui retire de `CLAUDE.md` la ligne « **Aucune migration sur `main` avant la bascule de la 2.0** » (elle n'a plus d'objet), poussé quand tout est vert.
- [ ] Plus tard, en **2.1** seulement : retirer `ACCESS_CODE` de Vercel, puis supprimer `movies` dans une migration.

## 4. Où en est la prod, selon le cas

| Situation | Code servi | Base | `movies` |
| --- | --- | --- | --- |
| Bascule réussie | 2.0.0 | migrée (0000–0010) | intacte, plus écrite |
| Fumée rouge, retour automatique | 1.3.x | **migrée quand même** | écrite par la 1.3.x |
| Revert manuel (§5.2) | 1.3.x | migrée | écrite par la 1.3.x |

## 5. Retour arrière

### 5.1 Automatique (fumée rouge)

La CI remet le déploiement 1.3.x d'avant. La migration, elle, est passée : la base a les tables 2.0 et « NOUS DEUX », la 1.3.x n'en voit rien et continue d'écrire dans `movies`, qu'elle sait lire. Aucune release n'est publiée.

- [ ] Lire l'échec (`gh run view <id> --log-failed`) : la ligne `✕ …: expected …, received …` dit quoi.
- [ ] Le code 2.0 est sur `main` : **le prochain push sur `main` remet la 2.0 en ligne**. Ne rien pousser d'autre que le correctif, et ce push correctif **contient la migration de rattrapage** (§6), même si le retour n'a duré que quelques minutes.
- [ ] Si la cause est une variable Vercel (`BETTER_AUTH_URL`, `SIGNUP`…), la corriger (§1.2), puis remettre en ligne par ce même push avec le rattrapage. **Pas** de `gh run rerun` ni de `gh workflow run` : ils remettraient la 2.0 sans rattrapage. Jamais `vercel --prod`.

### 5.2 Manuel, plus tard (un défaut trouvé après coup)

- [ ] `git revert -m 1 <sha du commit de fusion>` sur `main`, `npm ci` (le hook pre-push teste la 1.3.x avec ses propres dépendances), puis `git push origin main`. La CI redéploie la 1.3.x. La base reste lisible par elle : la migration est additive.
- [ ] Jamais `vercel --prod`, jamais un retour de schéma à la main.
- [ ] Bon à savoir : sur ce push, la sauvegarde redevient celle de la 1.3.x (`movies.json`, en clair, `movies` seule). Comptes et groupes restent en base, mais leur dernière sauvegarde complète est l'artefact chiffré du dernier déploiement 2.0.

## 6. Re-bascule après un retour : le rattrapage

Pendant le retour, la 1.3.x a écrit dans `movies` ; « NOUS DEUX » n'a pas bougé. `scripts/replay-legacy-movies.sql` y reporte ces changements, comme 0006 + 0007 l'avaient fait. Il est idempotent et ne fait rien sans « NOUS DEUX ». Il part **en migration**, dans le push qui remet la 2.0 : la CI l'applique, jamais la prod à la main.

- [ ] Après un revert manuel (§5.2) seulement : annuler le revert, `git revert <sha du revert>`, puis `npm ci` (retour aux dépendances de la 2.0, avant toute commande qui suit).
- [ ] Ajouter la migration :

  ```bash
  npx drizzle-kit generate --custom --name replay_legacy_movies
  cp scripts/replay-legacy-movies.sql drizzle/00NN_replay_legacy_movies.sql   # NN : le numéro que drizzle-kit vient de créer
  ```

- [ ] Le correctif lui-même, s'il y en a un (§5.1).
- [ ] `npm run ci` : les tests des migrations (`src/db/legacy-migration.test.ts`, `tests/scripts/`) rejouent toute la chaîne, la nouvelle comprise, et le rattrapage a ses propres tests (`tests/scripts/replay-legacy-movies.test.ts`).
- [ ] Un seul push sur `main` qui contient tout cela, puis §2 (« Ce que fait la CI ») et §3.

**Ce que le rattrapage reporte** : les films ajoutés pendant le retour (copiés comme en 0006 : sans auteur, « vus avant les comptes » s'ils sont vus, écartés s'ils sont BOF ou retirés) ; un film déjà dans le groupe, marqué vu sur la 1.3.x pendant le retour, s'il n'est pas vu dans le groupe : jamais marqué en 2.0, ou démarqué en 2.0 (la marque de la 1.3.x, plus récente que la bascule, l'emporte alors).

**Ce qu'il ne reporte pas** (à refaire à la main dans l'appli après la re-bascule, si besoin) : pour un film **déjà dans « NOUS DEUX »** :

- mis en BOF ou retiré sur la 1.3.x pendant le retour : il garde son statut 2.0 ;
- démarqué « vu » sur la 1.3.x : il reste vu ;
- remarqué vu sur la 1.3.x alors qu'il l'était déjà dans le groupe : le groupe garde sa première date ;
- marqué vu sur la 1.3.x alors qu'un membre l'avait marqué en 2.0 : la marque du membre et sa date restent ;
- tout changement de date de décision, et toute mise à jour d'un instantané TMDB existant.

Et rien du tout si « NOUS DEUX » n'existe plus (son dernier membre l'a quitté).

**Si quelqu'un a utilisé la 1.3.x pendant la bascule** (entre la migration et la fumée verte, §2) : ce SQL couvre aussi cette fenêtre, car sa limite (`watched_at` postérieur à la création du groupe) part de la copie de 0006. Le livrer en migration dans un push sur `main` (étapes ci-dessus, sans revert), avec les mêmes limites.

## 7. Restaurer une sauvegarde (base perdue ou abîmée)

La restauration n'a été testée que sur des fichiers SQLite locaux. **Conseillé une fois avant d'en avoir besoin** : la répéter sur une base Turso jetable (étapes 1 à 4, puis `turso db destroy <base jetable>`).

1. [ ] Choisir l'artefact (le dernier d'avant l'incident) :

   ```bash
   gh api 'repos/{owner}/{repo}/actions/artifacts?per_page=30' \
     --jq '.artifacts[] | select(.name | startswith("db-backup-")) | "\(.created_at) \(.workflow_run.id) \(.name) expiré=\(.expired)"' | sort -r | head
   gh run download <run id> -n db-backup-<sha> -D .rehearsal/restore   # dossier ignoré par git
   ```

2. [ ] Créer une base Turso **neuve** (ce n'est pas la prod : elle est vide) et ouvrir ses accès sans les afficher :

   ```bash
   turso db create we-watch-<date> --location aws-eu-west-1
   export DATABASE_URL="$(turso db show we-watch-<date> --url)"
   export DATABASE_AUTH_TOKEN="$(turso db tokens create we-watch-<date>)"
   read -rs BACKUP_KEY && export BACKUP_KEY   # la clé en place le jour de l'artefact, depuis le gestionnaire de mots de passe
   ```

   Puis, **selon la sauvegarde**, avant toute migration de la base neuve :
   - **D'avant les groupes** : le `movies.json` de la 1.3.x, ou le `db.json.enc` **du jour de la bascule** (sauvegardé avant la migration, il n'a que `movies`). `restore-db` la refuserait (« sauvegarde d'avant 2.0 »). La répétition migre elle-même la base, **ne pas** lancer `npm run db:migrate` :

     ```bash
     node scripts/rehearse-migration.mjs .rehearsal/restore/<movies.json ou db.json.enc> --db "$DATABASE_URL"
     ```

     Attendu : les mêmes contrôles qu'en §0, conformes, code 0. Passer à l'étape 4.
   - **D'après la bascule** (`db.json.enc` avec les groupes) : migrer la base neuve, puis étape 3.

     ```bash
     npm run db:migrate
     ```

3. [ ] Restaurer :

   ```bash
   node scripts/restore-db.mjs .rehearsal/restore/db.json.enc
   ```

   Attendu : une ligne `<table>: <n> rows` par table, puis `restored`. Tout refus (`restauration refusée, rien n'est écrit : …`) laisse la base vide : base non migrée ou non vide, mauvaise clé, ou clé étrangère orpheline (essayer alors l'artefact précédent).

4. [ ] Brancher l'appli sur la nouvelle base, dans les secrets GitHub **et** dans Vercel Production, sans rien afficher :

   ```bash
   for name in DATABASE_URL DATABASE_AUTH_TOKEN; do
     printf %s "${!name}" | gh secret set "$name"
     npx --no -- vercel env rm "$name" production --yes
     printf %s "${!name}" | npx --no -- vercel env add "$name" production
   done
   ```

5. [ ] Relancer la CI pour reconstruire et remettre en ligne avec ce nouvel environnement : `gh workflow run ci.yml --ref main`, puis la suivre (§2).
6. [ ] Les sessions ne sont jamais sauvegardées : chacun se reconnecte avec sa passkey (elles sont restaurées).
7. [ ] **Régénérer le lien d'invitation de chaque groupe** : un membre par groupe, pastille → « MEMBRES ET INVITATION » → « RÉGÉNÉRER LE LIEN », confirmer. Pourquoi : les jetons sont sauvegardés tels quels (`app_group.invite_token`), donc un lien régénéré après la sauvegarde (parce qu'il avait trop circulé) redevient valable avec la restauration (audit de sécurité, I4). Le nouveau lien se repartage par un canal privé.
8. [ ] `rm -rf .rehearsal` et `unset BACKUP_KEY DATABASE_AUTH_TOKEN DATABASE_URL`.
