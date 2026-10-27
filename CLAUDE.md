@AGENTS.md

# we-watch

Appli perso de Thomas et sa copine : on swipe des films TMDB dans une liste « à voir », puis le soir un tirage au sort choisit le film (avec filtres « ce soir » : heure de coucher, humeur, plateformes). PWA installée sur iPhone, protégée par un code d'accès partagé, sans comptes. Pas un produit commercial (licences TMDB / Vercel Hobby non commerciales).

- Prod : https://we-watch-lac.vercel.app (Vercel, fonctions en `dub1`) + base Turso `we-watch` (`aws-eu-west-1`).
- Spec de référence, versions comprises : `docs/superpowers/specs/2026-10-23-we-watch-design.md` (§1-10 V1/V1.1, §11 V1.2, §12 V1.2.1). **La lire avant toute fonctionnalité** et y ajouter une section pour chaque nouvelle version.

## Commandes

| But                                           | Commande                                        |
| --------------------------------------------- | ----------------------------------------------- |
| Dev (base locale `local.db`)                  | `npm run dev`                                   |
| Tests / couverture du métier                  | `npm test` / `npm run test:coverage`            |
| Qualité avant commit                          | `npm run lint && npm run typecheck && npm test` |
| Format                                        | `npm run format`                                |
| Migration (après modif de `src/db/schema.ts`) | `npm run db:generate` puis `npm run db:migrate` |
| Build de prod                                 | `npm run build`                                 |
| Servir le build **sur la base locale**        | `npm run start:local`                           |

## Pièges connus (déjà mordus)

- **`npm start` se branche sur la base de PROD** : en mode production, Next charge `.env.production.local` (secrets Turso). Pour tester un build en local, toujours `npm run start:local`.
- **Migration avant push** : le build Vercel ne migre pas. Tout changement de schéma = `DATABASE_URL=… DATABASE_AUTH_TOKEN=… npm run db:migrate` (valeurs de `.env.production.local`) **avant** de pousser sur `main`, sinon la prod lit des colonnes absentes et tout casse. Sauvegarder la table avant (voir `docs/releases/v1.2/deliver.sh`).
- **Push sur `main` = déploiement en prod** (auto-deploy Vercel). Pas de branche de preview configurée.
- **Next 16 ≠ ce que tu connais** (voir AGENTS.md) : `src/proxy.ts` remplace `middleware`, `cacheComponents` est actif (tout accès à `searchParams`, `cookies()`, `connection()` doit être sous un `<Suspense>`, sinon le build échoue), `PageProps<"/route">` est global.
- **Le proxy valide l'environnement à chaque requête** : une variable invalide (ex. `CRON_SECRET` < 16 caractères) met **tout** en 500, `/unlock` compris.
- Ne jamais afficher ni committer `ACCESS_CODE`, `CRON_SECRET`, les jetons TMDB / Turso.

## Architecture

```
src/
  domain/    règles métier PURES (aucun import hors domain) : films, transitions de statut, tirage, filtres « ce soir »
  db/        Drizzle : schéma + repository (dépend de domain)
  tmdb/      client TMDB + schémas zod + mapping + decks thématiques (dépend de domain)
  access/    code d'accès : jeton HMAC, cookie, décision du proxy, secret du cron
  server/    container.ts : SEUL endroit qui assemble base, TMDB et repository
  features/  un dossier par écran : composants, actions serveur, logique locale testée
  ui/        composants partagés sans logique métier (Ticket, Button, Chip, Stamp…)
  styles/    tokens.css : SEUL fichier autorisé à contenir couleurs, ombres, rayons
  app/       routes Next (pages fines : lecture des données + Suspense), API cron, icônes PWA
```

Règles :

- **Sens des dépendances** : `domain` ← `db`/`tmdb` ← `server` ← `features` ← `app`. Un composant client n'importe jamais un module serveur : la page lui passe les actions serveur en props.
- Modules serveur marqués `import "server-only"`.
- **Server Actions** = endpoints publics : chacune commence par `assertUnlocked()` puis valide ses arguments. Convention d'erreur : une **lecture** qui dépend de TMDB renvoie `{ ok: false }` (panne attendue, affichée dans la DA) ; une **écriture** lève une exception (le client la rattrape et affiche un message).
- Logique non triviale = fonction pure dans `domain/` ou `features/x/*.ts`, testée à part ; les composants restent de l'affichage.

## Conventions

- **Langue** : interface en français (MAJUSCULES pour titres et boutons, typographie française : « », espaces insécables) ; code et commentaires en anglais ; noms de tests en français (ils se lisent comme la spec).
- **DA « Ticket d'entrée » (riso fluo)** non négociable : papier `#fff4d6`, encre marine, rose, jaune et bleu fluo, Archivo Black + Space Mono, contours épais, ombres décalées pleines. Aucune couleur brute hors `src/styles/tokens.css` (exception documentée : `src/features/pwa/brand.ts` pour les icônes).
- **Responsive** (spec §12) : téléphone d'abord ; `@media (min-width: 760px)` = écrans larges (nav en haut) ; `@container shell (min-width: 640px)` = colonne large (ticket couché, grille) ; hauteurs `520px` (téléphone couché), `620px`/`700px` (petits écrans). Vérifier tout changement d'UI dans un vrai navigateur sur plusieurs formats.
- Animations légères, `prefers-reduced-motion` respecté.
- **Commits** : `type(scope): description`, header seul, en anglais. **Jamais de mention de Claude ni de `Co-Authored-By`.** Sur ce repo, Claude peut commiter et pousser seul (autorisation de Thomas) ; ailleurs non.

## Qualité

- Porte de couverture du métier (`vitest.config.ts`, seuils 95/95/95/90, actuellement 100 %) : tout nouveau module de logique pure y entre. `docs/coverage.md` est mis à jour à la main.
- La CI GitHub (`.github/workflows/ci.yml`) lance lint, types et tests sur chaque push : ne jamais pousser au rouge.
- Tests UI : Testing Library, requêtes par rôle et texte visible, pas de détails d'implémentation.

## Livrer une version

1. Section de spec, puis code par petites étapes testées et commitées.
2. Build local + vérification navigateur (`npm run start:local`).
3. Si le schéma change : sauvegarde + migration de la prod **avant** le push.
4. `npm version <x.y.z> --no-git-tag-version`, commit, tag `vX.Y.Z`, push `main` (+ `--tags`), vérifier la prod.
5. Release note riso dans `docs/releases/` si Thomas en veut une (une image PNG à copier-coller marche le mieux).
