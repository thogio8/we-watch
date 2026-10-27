@AGENTS.md

# we-watch

Appli perso de Thomas et sa copine : on swipe des films TMDB dans une liste « à voir », puis le soir un tirage au sort choisit le film (avec filtres « ce soir » : heure de coucher, humeur, plateformes). PWA installée sur iPhone, protégée par un code d'accès partagé, sans comptes. Pas un produit commercial (licences TMDB / Vercel Hobby non commerciales).

- Prod : https://we-watch-lac.vercel.app (Vercel, fonctions en `dub1`) + base Turso `we-watch` (`aws-eu-west-1`).
- Spec de référence, versions comprises : `docs/superpowers/specs/2026-10-23-we-watch-design.md` (§1-10 V1/V1.1, §11 V1.2, §12 V1.2.1, §13 V1.2.2+). **La lire avant toute fonctionnalité** et y ajouter une section pour chaque nouvelle version.

## Commandes

| But                                           | Commande                                        |
| --------------------------------------------- | ----------------------------------------------- |
| Dev (base locale `local.db`)                  | `npm run dev`                                   |
| Tests / couverture du métier                  | `npm test` / `npm run test:coverage`            |
| **CI locale complète** (= hook pre-push)      | `npm run ci`                                    |
| Tests e2e seuls (build + Playwright)          | `npm run test:e2e`                              |
| Doublons / code mort                          | `npm run dup` / `npm run deadcode`              |
| Format                                        | `npm run format`                                |
| Migration (après modif de `src/db/schema.ts`) | `npm run db:generate` puis `npm run db:migrate` |
| Build de prod                                 | `npm run build`                                 |
| Servir le build **sur la base locale**        | `npm run start:local`                           |

## Pièges connus (déjà mordus)

- **`npm start` se branche sur la base de PROD** : en mode production, Next charge `.env.production.local` (secrets Turso). Pour tester un build en local, toujours `npm run start:local`.
- **Push sur `main` = mise en prod, mais seulement via GitHub Actions** (`.github/workflows/ci.yml`) : `npm run ci` vert, puis sauvegarde de la table (artefact 90 jours), migration Turso, déploiement Vercel, test de fumée (`scripts/smoke-prod.sh`), et retour arrière automatique si la fumée échoue. L'auto-deploy Git de Vercel est coupé (`vercel.json`). Ne jamais déployer à la main (`vercel --prod`) ni migrer la prod à la main.
- **Migrations rétrocompatibles** : la migration passe _avant_ le nouveau code, pendant que l'ancien sert encore. Ajouter des colonnes (nullables ou avec défaut), jamais renommer ni supprimer dans la même version ; supprimer dans une version suivante.
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
- Ces règles de couches sont **vérifiées par ESLint** (`eslint.config.mjs`, `no-restricted-imports`) : un import interdit casse la CI.

## Code propre : SOLID, KISS, DRY (exigence de Thomas, non négociable)

Concrètement, sur ce repo :

- **Une responsabilité par fichier** (S). Un écran = un composant qui assemble ; l'état et les effets vont dans un hook `useX.ts`, la logique dans un `.ts` pur testé, chaque vue/morceau d'UI dans son composant. Modèles à suivre : `features/draw/` (`useDraw` + `drawView` + `DrawHome`/`DrawResult`…), `features/swipe/` (`deckState` reducer + hooks + sous-composants).
- **Ouvert à l'extension** (O) : préférer une table de données à un `switch` qui grossit (`TRANSITIONS` dans `domain/transitions.ts`, `DECKS`, `MOODS`, handlers du reducer de `deckState.ts`).
- **Dépendre d'interfaces** (D) : les features déclarent leurs ports (`DeckDeps`, `RefreshDeps`), `server/container.ts` les implémente ; les composants reçoivent les actions serveur en props.
- **KISS** : pas d'abstraction « au cas où », pas de framework maison, pas de dépendance pour trois lignes. Le plus simple qui passe les tests.
- **DRY** : avant d'écrire, chercher l'existant. Briques partagées :
  - UI : `ui/Headline` (titres riso), `ui/cx` (classes), `ui/Tab.module.css` (onglets, via `composes`), `ui/Ticket`, `ui/TicketDetails`, `ui/Button`, `ui/Chip`, `ui/Stamp`, `ui/Lines`.
  - Serveur : `server/validate.ts` (contrôles d'entrée), `SWIPES` (domain).
  - Tests : `tests/helpers/movies.ts` (`aSnapshot`, `aMovie`, `NETFLIX`…), `tests/helpers/dom.ts` (`stubMatchMedia`), `tests/setup.ts` (nettoyage commun), mocks `vi.mock("@/access/assert-unlocked")` / `vi.mock("next/cache")` (dossiers `__mocks__`), `tests/helpers/functional.ts`, `tests/fake-tmdb/`, `e2e/fixtures.ts`.
- **Garde-fous automatiques** (ESLint, erreur = CI rouge) : 200 lignes max par fichier, 80 par fonction, complexité 10, imbrication 3, 4 paramètres max (sinon un objet), `===`, pas de ternaire imbriqué. **jscpd** refuse tout bloc dupliqué (6 lignes / 60 tokens), **knip** tout export ou dépendance inutilisé. Ne jamais contourner une règle (`eslint-disable`, seuil relevé) sans l'accord de Thomas : découper plutôt.

## Définition de « fini »

1. Le comportement est testé au bon niveau : logique pure → test unitaire ; action serveur ou base → test fonctionnel (`tests/functional/`) ; parcours utilisateur → scénario e2e (`e2e/`).
2. `npm run ci` passe en local (le hook pre-push le relance de toute façon).
3. Tout changement d'UI est vérifié dans un vrai navigateur sur plusieurs formats. Les captures de référence (`e2e/visual.spec.ts`) le font automatiquement : un refactor ne doit en casser aucune ; un changement voulu se valide avec `npm run test:e2e -- --update-snapshots` puis en **regardant** les nouvelles images avant de les commiter.
4. Le `CLAUDE.md` et la spec sont à jour si une règle ou une version change.

## Conventions

- **Langue** : interface en français (MAJUSCULES pour titres et boutons, typographie française : « », espaces insécables) ; code et commentaires en anglais ; noms de tests en français (ils se lisent comme la spec).
- **DA « Ticket d'entrée » (riso fluo)** non négociable : papier `#fff4d6`, encre marine, rose, jaune et bleu fluo (texte encre sur le rose, pour le contraste), Archivo Black + Space Mono, contours épais, ombres décalées pleines. Aucune couleur brute hors `src/styles/tokens.css` (exception documentée : `src/features/pwa/brand.ts` pour les icônes).
- **Responsive** (spec §12) : téléphone d'abord ; `@media (min-width: 760px)` = écrans larges (nav en haut) ; `@container shell (min-width: 640px)` = colonne large (ticket couché, grille) ; hauteurs `520px` (téléphone couché), `620px`/`700px` (petits écrans). Vérifier tout changement d'UI dans un vrai navigateur sur plusieurs formats.
- Animations légères, `prefers-reduced-motion` respecté.
- **Commits** : `type(scope): description`, header seul, en anglais. **Jamais de mention de Claude ni de `Co-Authored-By`.** Sur ce repo, Claude peut commiter et pousser seul (autorisation de Thomas) ; ailleurs non.

## Qualité et tests

- **CI locale** (lefthook, installé par `npm install`) : `pre-commit` formate et lint les fichiers indexés ; `pre-push` lance `npm run ci` (format, lint, types, doublons, code mort, tests + couverture, build + e2e, ~3 min). Ne jamais pousser au rouge ni contourner (`--no-verify`, `LEFTHOOK=0`) sans raison dite à Thomas. GitHub Actions rejoue `npm run ci` puis déploie (voir « Pièges »). Dependabot ouvre chaque lundi une PR de mises à jour : la fusionner si la CI est verte.
- **Couverture** (`vitest.config.ts`, seuils 95/95/95/90, actuellement 100 %) : tous les `.ts` de `src/` sauf hooks et câblage, donc tout nouveau module y entre seul. `docs/coverage.md` est mis à jour à la main.
- **Tests UI** : Testing Library, requêtes par rôle et texte visible, pas de détails d'implémentation.
- **Tests fonctionnels** (`tests/functional/`) : `startServerStack()` donne une vraie base SQLite et le faux TMDB ; on appelle les vraies actions serveur.
- **E2E** (`e2e/`, Playwright) : build de prod sur `e2e/.data/e2e.db` et le faux TMDB (`e2e/global-setup.ts`), ports 3217/3218, profils iPhone et desktop. La fixture `app` vide la base et déverrouille ; `swipe()` attend la fin des enregistrements (`settled`). Ne jamais supprimer la base e2e pendant qu'un serveur la tient (`SQLITE_READONLY_DBMOVED`).
- **Accessibilité** : axe sans aucun défaut grave, contraste compris (WCAG AA). Sur le rose, le texte est en encre (`--on-pink`), jamais en blanc.
- Le faux TMDB (`tests/fake-tmdb/`) sert aux deux niveaux : un film utile à un test s'ajoute dans `catalog.ts`. L'appli le joint grâce à `TMDB_API_URL` (défaut : le vrai TMDB).

## Livrer une version

1. Section de spec, puis code par petites étapes testées et commitées.
2. Build local + vérification navigateur (`npm run start:local`).
3. Si le schéma change : `npm run db:generate`, migration rétrocompatible (voir plus haut) ; la CI la passera en prod.
4. `npm version <x.y.z> --no-git-tag-version`, commit, tag `vX.Y.Z`, `git push origin main --tags`, puis suivre le run : `gh run watch`.
5. Release note riso dans `docs/releases/` si Thomas en veut une (une image PNG à copier-coller marche le mieux).
