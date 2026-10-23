# we-watch

Swipe des films TMDB dans une watchlist, puis tirage au sort du film de ce soir.

## Prérequis

- Node.js 22 ou plus récent, npm
- Un jeton d'accès TMDB (API Read Access Token) : themoviedb.org → Paramètres → API

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis renseigner TMDB_ACCESS_TOKEN et ACCESS_CODE
npm run db:migrate           # crée la base locale local.db (DATABASE_URL=file:local.db)
npm run dev
```

## Code d'accès

L'URL de prod est publique : un code partagé, saisi une fois par appareil sur `/unlock`, protège l'app (pas de comptes).

- `ACCESS_CODE` est obligatoire, en local comme sur Vercel : 8 caractères minimum, mais choisir une **phrase de passe de 12 caractères ou plus** (3 ou 4 mots, ex. « pop corn sous la couette »), facile à taper sur un téléphone. La pause de 500 ms après un mauvais code ne freine pas des essais lancés en parallèle : c'est la longueur du code qui protège.
- Le bon code pose le cookie `ww_access` (httpOnly, SameSite=Lax, un an). Le cookie est `Secure` dès que `NODE_ENV=production` : `npm start` servi en http sur une IP du réseau local ne garde donc pas le cookie (`localhost` est accepté par les navigateurs) ; pour tester depuis un téléphone en LAN, utiliser `npm run dev`.
- Changer `ACCESS_CODE` déconnecte tous les appareils.

## Installer sur iPhone

Safari → Partager → « Sur l'écran d'accueil ». L'app s'ouvre en plein écran (manifest `display: standalone`, icône ticket générée par `src/app/icon.tsx` et `src/app/apple-icon.tsx`). Pas de mode hors ligne.

## Commandes

- `npm run dev` : serveur de développement
- `npm run build` : build de production (`next build`, ne lance pas les migrations)
- `npm start` : sert le build de production
- `npm run lint` : ESLint
- `npm run typecheck` : génération des types Next puis `tsc --noEmit`
- `npm test` : tests unitaires (Vitest)
- `npm run test:coverage` : tests avec couverture, la couverture s'affiche en console ; `docs/coverage.md` est mis à jour à la main à partir de ce résultat
- `npm run format` : formatage Prettier
- `npm run db:generate` : génère une migration SQL à partir de `src/db/schema.ts`
- `npm run db:migrate` : applique les migrations à la base ciblée par `DATABASE_URL`

## Déployer

Hébergement : Vercel (app) + Turso (base libSQL).

### 1. Turso

```bash
turso db create we-watch --location cdg
turso db show we-watch --url        # → DATABASE_URL (libsql://…)
turso db tokens create we-watch     # → DATABASE_AUTH_TOKEN
```

### 2. Migrer la base distante

> `drizzle-kit` ne lit pas `.env.local` : `drizzle.config.ts` lit `process.env`
> directement. Sans `DATABASE_URL` explicite, la commande se rabat sur
> `file:local.db` et migre la base locale, pas Turso.

```bash
DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:migrate
turso db shell we-watch ".tables"   # la table movies doit apparaître
```

### 3. Vercel

1. Importer le dépôt `thogio8/we-watch`.
2. Définir `TMDB_ACCESS_TOKEN`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN` et `ACCESS_CODE` pour l'environnement Production.
   > Attention : si Preview reçoit les mêmes variables, les déploiements de preview pointent vers la même base Turso et écrivent dans les données de prod. Préférer une base Turso séparée pour Preview, ou ne définir les variables que pour Production.
3. Régler Settings → Functions → Region : Paris (cdg1), pour rester proche de la base Turso (`cdg`).
4. Déployer.

Les migrations sont lancées à la main (étape 2) avant de déployer un changement de schéma ; le build ne les exécute pas.

## Vérifier en prod

Sur l'URL Vercel, depuis un téléphone :

- [ ] l'URL renvoie vers `/unlock` ; un mauvais code affiche « MAUVAIS CODE », le bon ouvre l'app
- [ ] ajouter l'app à l'écran d'accueil, la rouvrir : pas de nouvelle demande de code, rien sous l'encoche
- [ ] swiper 2 films
- [ ] rechercher un film et l'ajouter
- [ ] tirer au sort, puis « ON LE REGARDE »
- [ ] vérifier l'onglet VUS
- [ ] recharger : tout est persistant

## Structure

- `src/domain` : types et règles métier pures (films, tirage, transitions de statut)
- `src/db` : schéma Drizzle et repository des films (libSQL)
- `src/tmdb` : client TMDB, schémas de validation et mapping
- `src/access` : code d'accès partagé (jeton HMAC, cookie, décision du proxy)
- `src/proxy.ts` : proxy Next.js qui verrouille toutes les requêtes sans cookie valide
- `src/features` : écrans et actions par fonctionnalité (swipe, list, draw, unlock, pwa)
- `src/ui` : composants partagés (boutons, navigation, affiche, tags de plateformes, tampon, ticket, pile déchirée, lignes)
- `src/app` : routes et layout Next.js, manifest et icônes générées
- `src/server` : composition côté serveur (container : base, client TMDB, repository)
- `src/styles` : design tokens CSS
- `src/env.ts` : lecture et validation des variables d'environnement
