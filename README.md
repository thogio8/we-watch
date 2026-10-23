# we-watch

Swipe des films TMDB dans une watchlist, puis tirage au sort du film de ce soir.

## Prérequis

- Node.js 22 ou plus récent, npm
- Un jeton d'accès TMDB (API Read Access Token)

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner TMDB_ACCESS_TOKEN
npm run dev
```

## Commandes

- `npm run dev` : serveur de développement
- `npm test` : tests unitaires (Vitest)
- `npm run db:migrate` : migrations de la base (disponible à partir de la Task 5)
