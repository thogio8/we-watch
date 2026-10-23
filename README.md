# we-watch

Swipe des films TMDB dans une watchlist, puis tirage au sort du film de ce soir.

## Prérequis

- Node.js 22 ou plus récent, npm
- Un jeton d'accès TMDB (API Read Access Token) : themoviedb.org → Paramètres → API

## Démarrage local

```bash
npm install
cp .env.example .env.local   # puis renseigner TMDB_ACCESS_TOKEN
npm run db:migrate           # crée la base locale local.db (DATABASE_URL=file:local.db)
npm run dev
```

## Commandes

- `npm run dev` : serveur de développement
- `npm run build` : build de production (`next build`, ne lance pas les migrations)
- `npm start` : sert le build de production
- `npm run lint` : ESLint
- `npm run typecheck` : génération des types Next puis `tsc --noEmit`
- `npm test` : tests unitaires (Vitest)
- `npm run test:coverage` : tests avec couverture, résultat consigné dans `docs/coverage.md`
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
2. Définir `TMDB_ACCESS_TOKEN`, `DATABASE_URL` et `DATABASE_AUTH_TOKEN` pour les environnements Production et Preview.
3. Déployer.

Les migrations sont lancées à la main (étape 2) avant de déployer un changement de schéma ; le build ne les exécute pas.

## Vérifier en prod

Sur l'URL Vercel, depuis un téléphone :

- [ ] swiper 2 films
- [ ] rechercher un film et l'ajouter
- [ ] tirer au sort, puis « ON LE REGARDE »
- [ ] vérifier l'onglet VUS
- [ ] recharger : tout est persistant

## Structure

- `src/domain` : types et règles métier pures (films, tirage, transitions de statut)
- `src/db` : schéma Drizzle et repository des films (libSQL)
- `src/tmdb` : client TMDB, schémas de validation et mapping
- `src/features` : écrans et actions par fonctionnalité (swipe, list, draw)
- `src/ui` : composants partagés (boutons, navigation)
- `src/app` : routes et layout Next.js
