# Restaurer une sauvegarde (base perdue ou abîmée)

Chaque déploiement sauvegarde la base, chiffrée avec `BACKUP_KEY`, dans un artefact `db-backup-<sha>` gardé 90 jours (CLAUDE.md, « Sauvegarde chiffrée »). Une sauvegarde d'avant la 2.0 (1.3.x) n'est plus restaurable.

La restauration n'a été testée que sur des fichiers SQLite locaux. **Conseillé une fois avant d'en avoir besoin** : la répéter sur une base Turso jetable (étapes 1 à 4, puis `turso db destroy <base jetable>`).

1. [ ] Choisir l'artefact (le dernier d'avant l'incident) :

   ```bash
   gh api 'repos/{owner}/{repo}/actions/artifacts?per_page=30' \
     --jq '.artifacts[] | select(.name | startswith("db-backup-")) | "\(.created_at) \(.workflow_run.id) \(.name) expiré=\(.expired)"' | sort -r | head
   gh run download <run id> -n db-backup-<sha> -D .restore   # dossier ignoré par git
   ```

2. [ ] Créer une base Turso **neuve** (ce n'est pas la prod : elle est vide) et ouvrir ses accès sans les afficher :

   ```bash
   turso db create we-watch-<date> --location aws-eu-west-1
   DATABASE_URL="$(turso db show we-watch-<date> --url)" && export DATABASE_URL
   DATABASE_AUTH_TOKEN="$(turso db tokens create we-watch-<date>)" && export DATABASE_AUTH_TOKEN
   read -rs BACKUP_KEY && export BACKUP_KEY   # la clé en place le jour de l'artefact, depuis le gestionnaire de mots de passe
   [[ "$DATABASE_URL" == libsql://* && -n "$DATABASE_AUTH_TOKEN" && -n "$BACKUP_KEY" ]] && echo "✓ accès prêts" || echo "✕ un accès manque : ne pas continuer, refaire ces lignes"
   ```

   Attendu : `✓ accès prêts`. Ces variables servent jusqu'à l'étape 4 : rester dans **ce** terminal.

   Puis migrer la base neuve :

   ```bash
   npm run db:migrate
   ```

3. [ ] Restaurer :

   ```bash
   node scripts/restore-db.mjs .restore/db.json.enc
   ```

   Attendu : une ligne `<table>: <n> rows` par table, puis `restored`. Tout refus (`restauration refusée, rien n'est écrit : …`) laisse la base vide : base non migrée ou non vide, mauvaise clé, ou clé étrangère orpheline (essayer alors l'artefact précédent).

4. [ ] Brancher l'appli sur la nouvelle base, dans les secrets GitHub **et** dans Vercel Production, sans rien afficher :

   ```bash
   (
     set -euo pipefail
     trap 'echo "✕ arrêt : la commande ci-dessus a échoué" >&2' ERR
     : "${DATABASE_URL:?absente, étape 2 à refaire dans ce terminal}" "${DATABASE_AUTH_TOKEN:?absent, étape 2 à refaire dans ce terminal}"
     [[ "$DATABASE_URL" == libsql://* ]] || { echo "✕ DATABASE_URL n'est pas une base Turso : rien n'est changé"; exit 1; }
     for name in DATABASE_URL DATABASE_AUTH_TOKEN; do
       printf %s "${!name}" | gh secret set "$name"
       npx --no -- vercel env rm "$name" production --yes
       printf %s "${!name}" | npx --no -- vercel env add "$name" production
     done
     echo "✓ GitHub et Vercel branchés sur la nouvelle base"
   )
   ```

   Sans les deux variables (nouveau terminal, étape 2 en échec), le bloc s'arrête avant d'avoir rien changé : il ne retire jamais les valeurs de prod pour en écrire des vides. Les messages nomment la variable, jamais sa valeur.

5. [ ] Relancer la CI pour reconstruire et remettre en ligne avec ce nouvel environnement : `gh workflow run ci.yml --ref main`, puis la suivre (`gh run watch`).
6. [ ] Les sessions ne sont jamais sauvegardées : chacun se reconnecte avec sa passkey (elles sont restaurées).
7. [ ] **Régénérer le lien d'invitation de chaque groupe** : un membre par groupe, pastille → « MEMBRES ET INVITATION » → « RÉGÉNÉRER LE LIEN », confirmer. Pourquoi : les jetons sont sauvegardés tels quels (`app_group.invite_token`), donc un lien régénéré après la sauvegarde (parce qu'il avait trop circulé) redevient valable avec la restauration (audit de sécurité, I4). Le nouveau lien se repartage par un canal privé.
8. [ ] `rm -rf .restore` et `unset BACKUP_KEY DATABASE_AUTH_TOKEN DATABASE_URL`.
