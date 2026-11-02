<p align="center">
  <img src="docs/readme/poster.webp" alt="WeWatch : on swipe des films à deux, le soir le hasard tranche" width="100%">
</p>

<p align="center">
  <a href="https://github.com/thogio8/we-watch/actions/workflows/ci.yml"><img src="https://github.com/thogio8/we-watch/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/thogio8/we-watch/releases"><img src="https://img.shields.io/github/v/release/thogio8/we-watch?label=version&color=ff3fa4" alt="Version"></a>
  <img src="https://img.shields.io/badge/Next.js-16-1b1b6b" alt="Next.js 16">
  <img src="https://img.shields.io/badge/PWA-ffe600" alt="PWA">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-2f6bff" alt="Licence MIT"></a>
</p>

# WeWatch

**Une longue liste de films à voir, et chaque soir le même débat.** WeWatch sépare les deux moments : on remplit la liste à deux, tranquillement, en swipant des films ; le soir venu, un bouton, un film, et c'est le hasard qui tranche.

Une petite appli web pour un couple (ou une coloc, ou une bande d'amis), installable sur l'écran d'accueil du téléphone, gratuite à héberger, en français, et volontairement joyeuse : direction artistique « ticket d'entrée », riso fluo.

## Ce qu'elle fait

**🎟️ TIRER** : le film de ce soir

- Un gros bouton, un film tiré au sort dans la liste « à voir », avec l'heure à laquelle il finira si on le lance maintenant (« FINI À 23H12 »).
- **RETIRER** déchire le ticket et en tire un autre ; les tickets déchirés s'empilent (« PAS CE SOIR ») et ne ressortent pas de la soirée, sauf si on les **↺ RESSORT**.
- **La soirée** : filtres facultatifs pour réduire le choix : heure de coucher (« FINI AVANT MINUIT »), envie du moment (RIRE, FRISSONNER, S'ÉMOUVOIR…), plateformes auxquelles on est abonnés.

**💘 SWIPER** : remplir la liste

- Des films bien notés, un par un : glisser à droite (ON LE VEUT ♥) ou à gauche (✕ BOF), ou utiliser les boutons.
- Des thèmes : les mieux notés, années 80, années 90, moins de 1h40, animation, cinéma français, cinéma coréen.
- Bande-annonce en un geste, et **↺ ANNULER** pendant quelques secondes après chaque choix.

**📋 LISTE** : notre liste

- Les films « à voir » et « vus », une recherche TMDB pour ajouter un film précis, et une fiche par film : résumé complet, genres, réalisation, têtes d'affiche, actions.
- Qui a fait quoi : « voulu par Léa et Hugo », « ajouté par Léa le 12 octobre », « vu le 18/10 · marqué par Hugo » (sur la fiche, le bloc « CHEZ NOUS »).
- Sur chaque film, **les plateformes de streaming françaises** où il est disponible, ou « PAS EN STREAMING » : une information, jamais un filtre. C'est la liste qui compte, pas le catalogue d'une plateforme.
- Les données des films (plateformes, durées…) se rafraîchissent chaque jour.

**👥 LES GROUPES** : une liste par groupe

- La pastille « ● NOUS DEUX ▾ », en haut de TIRER, SWIPER et LISTE, dit quel groupe est affiché. Son panneau liste mes groupes (nombre de membres, ✓ sur celui affiché), propose « + CRÉER UN GROUPE », « MEMBRES ET INVITATION », « MON COMPTE » et « SE DÉCONNECTER ».
- Chaque groupe a sa liste et sa soirée (la pile « PAS CE SOIR », les filtres). Le groupe choisi est retenu sur l'appareil.
- **ON LE VEUT ♥** met le film dans la liste du groupe et ajoute mon nom à « voulu par ». **✕ BOF** ne vaut que pour moi : le film disparaît de ma pile de swipe, dans tous mes groupes, sans toucher la liste ni la pile des autres. Ajouter un film depuis la recherche efface mon BOF ; **✕** dans la liste l'écarte pour tout le groupe.
- Un compte sans groupe arrive sur **CRÉER TON PREMIER GROUPE**.

**✉️ MEMBRES ET INVITATION** : inviter, rejoindre, quitter

- **Inviter** : chaque groupe a son lien d'invitation. « COPIER LE LIEN D’INVITATION » (« PARTAGER » sur un téléphone, qui ouvre son menu de partage) ; on l'envoie par message à qui l'on veut. « RÉGÉNÉRER LE LIEN » en donne un nouveau : l'ancien ne marche plus.
- **Rejoindre** : qui ouvre le lien voit « TU ES INVITÉ·E DANS « NOM » ». Sans compte, il en crée un sur place (prénom, puis Face ID) et arrive directement dans le groupe ; avec un compte, « REJOINDRE ». Déjà membre, « Y ALLER » bascule sur ce groupe. Un lien régénéré ou d'un groupe disparu répond « CE LIEN N’EST PLUS VALABLE ».
- **Les membres** : qui est là et depuis quand (« depuis le 23/10 »), le nom du groupe à « RENOMMER ». Chaque membre peut en retirer un autre (« RETIRER ») ou « QUITTER LE GROUPE », toujours après confirmation. Qui part perd ses « voulu » dans ce groupe ; ses ajouts restent. **Le dernier membre qui part supprime le groupe et sa liste** (l'écran le dit avant).

**🪪 MON COMPTE** : à moi, rien qu'à moi

- **Mon prénom** : on le change d'un geste, il change partout (« voulu par… », la liste des membres).
- **Mes clés d'accès** : une par appareil, nommée d'après lui (« iPhone · Safari », ajoutée le…). « AJOUTER UNE CLÉ D’ACCÈS » en crée une pour l'appareil en main : on ouvre ensuite WeWatch sur l'ordinateur sans le téléphone. On en supprime une après confirmation, **jamais la dernière** (« GARDE AU MOINS UNE CLÉ D’ACCÈS ») : sans elle, la porte serait fermée.
- **Mes appareils** : où je suis connecté·e et quand, « CET APPAREIL » en rose. « DÉCONNECTER » un téléphone perdu le met dehors **tout de suite** : ses actions sont refusées aussitôt et le renvoient sur l'écran de connexion, comme toute page qu'il n'a pas encore en mémoire (celles déjà vues peuvent encore s'afficher jusqu'à 5 minutes). Déconnecter un appareil ne retire pas sa clé d'accès : une clé synchronisée (iCloud, Google) est la même sur tous tes appareils, donc la supprimer la retire partout.
- **Supprimer mon compte** : on tape son prénom, puis « SUPPRIMER DÉFINITIVEMENT ». Partent mes clés, mes appareils, mes BOF et les groupes où j'étais seul·e ; ailleurs, mes films restent aux autres, « ajouté par un ancien membre ».

<p align="center">
  <img src="docs/readme/desktop.webp" alt="Le ticket tiré sur un écran large" width="74%">
  &nbsp;
  <img src="docs/readme/fiche.webp" alt="La fiche d'un film sur téléphone" width="22%">
</p>

Pensée pour le téléphone, elle s'adapte à tous les écrans : petit Android, iPhone couché, tablette, grand écran (le ticket se couche comme un vrai billet).

## Essayer en local

Il faut **Node.js 24** et un jeton d'accès TMDB gratuit (themoviedb.org → Paramètres → API → « API Read Access Token »).

```bash
git clone https://github.com/thogio8/we-watch.git && cd we-watch
npm install
cp .env.example .env.local   # renseigner TMDB_ACCESS_TOKEN et BETTER_AUTH_SECRET
npm run db:migrate           # crée la base SQLite locale (local.db)
npm run dev                  # http://localhost:3000
```

Dans `.env.local` (`BETTER_AUTH_URL` et `SIGNUP` sont déjà préremplis par `.env.example`) :

- `BETTER_AUTH_SECRET` : le secret des sessions, 32 caractères au moins (`openssl rand -hex 32`) ;
- `BETTER_AUTH_URL` : l'adresse de l'appli, `http://localhost:3000` en local ;
- `SIGNUP` : `open` (par défaut, tout le monde peut créer un compte) ou `invite` ;
- `OWNER_CODE` : le code propriétaire, qui ouvre l'inscription avec `SIGNUP=invite` et fait rejoindre le groupe « NOUS DEUX » (voir « Les comptes »).

L'appli s'ouvre sur **ENTRE DANS WEWATCH** : « CRÉER UN COMPTE », un prénom, « CRÉER MON COMPTE » (Face ID, empreinte ou code du téléphone), puis **CRÉER TON PREMIER GROUPE** : un nom, et c'est parti sur TIRER. La liste est vide, direction SWIPER.

## Héberger votre propre WeWatch

Tout tient dans les offres gratuites de **Vercel** (l'appli), **Turso** (la base SQLite) et **GitHub Actions** (tests et déploiement). Le déploiement passe uniquement par GitHub Actions : chaque push sur `main` est testé, puis la base est sauvegardée et migrée, la nouvelle version mise en ligne, vérifiée, et retirée automatiquement si la vérification échoue.

1. **Turso** : créer la base et un jeton.

   ```bash
   turso db create we-watch --location aws-eu-west-1
   turso db show we-watch --url        # → DATABASE_URL (libsql://…)
   turso db tokens create we-watch     # → DATABASE_AUTH_TOKEN
   ```

2. **Vercel** : créer le projet depuis votre copie du dépôt, sans le déployer.
   - `npx vercel link` crée le projet ; `.vercel/project.json` donne `orgId` et `projectId`.
   - Variables d'environnement **Production** : `TMDB_ACCESS_TOKEN`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `CRON_SECRET` et `BETTER_AUTH_SECRET` (chacun `openssl rand -hex 32`), `BETTER_AUTH_URL` (l'adresse de production, la même que `PROD_URL` au caractère près, sans `/` final : la vérification d'après déploiement le contrôle), `SIGNUP=invite` (conseillé : sinon n'importe qui connaissant l'adresse crée un compte) et, le temps de créer le premier compte, `OWNER_CODE` (voir « Les comptes »). Ne pas les donner aux previews : elles écriraient dans la même base.
   - `ACCESS_CODE`, l'ancien code partagé, reste dans Vercel jusqu'à la 2.1 : un retour arrière vers la 1.3.x en a encore besoin. La 2.0 l'ignore.
   - Un jeton dans Account Settings → Tokens.
   - La région des fonctions (`vercel.json`, `dub1` = Dublin) se règle au plus près de la base.
3. **GitHub** (Settings → Secrets and variables → Actions) :
   - secrets : `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `CRON_SECRET`, et `BACKUP_KEY`, la clé qui chiffre les sauvegardes : 64 caractères hexadécimaux (`openssl rand -hex 32`), dont vous gardez une copie hors ligne (gestionnaire de mots de passe). Sans elle, la CI refuse de sauvegarder, donc de migrer et de déployer ; perdue, plus aucune sauvegarde ne se relit ;
   - variable : `PROD_URL`, l'adresse de production (par exemple `https://votre-projet.vercel.app`) ;
   - variable facultative : `EXPECT_SIGNUP`. La vérification d'après déploiement exige par défaut que l'écran de connexion annonce l'inscription sur invitation (`SIGNUP=invite`) ; mettez `open` si vous ouvrez l'inscription exprès.
4. **Pousser sur `main`** : la CI crée les tables au premier passage, puis chaque push déploie. Avant chaque migration, elle sauvegarde la base, chiffrée (voir « Vos données »). Après la mise en ligne, elle vérifie la prod : connexion, en-têtes de sécurité, clés d'accès liées à la bonne adresse, routes inutilisées fermées, requêtes d'un autre site refusées, rafraîchissement quotidien ; un échec remet la version d'avant.

## Les comptes

Chacun a son compte, et **aucun mot de passe** : le compte se crée et s'ouvre avec une passkey, c'est-à-dire Face ID, empreinte ou code du téléphone ; sur un ordinateur sans rien de tout ça, le navigateur propose un QR code à scanner avec son téléphone. Rien à retenir, rien à se faire voler, aucun email envoyé. Sans compte, toutes les pages mènent à **ENTRE DANS WEWATCH**.

- **Créer un compte** : un prénom ou un surnom (30 caractères au plus), puis « CRÉER MON COMPTE » et le verrou de l'appareil. La passkey reste sur l'appareil, ou se synchronise avec le trousseau (iCloud, Google).
- **Revenir** : « SE CONNECTER ». La session dure 60 jours et se prolonge toute seule tant qu'on revient ; « SE DÉCONNECTER » est dans le panneau de la pastille du groupe et dans « MON COMPTE ». Se déconnecter oublie aussi le groupe affiché : le compte suivant sur ce téléphone repart de ses propres groupes.
- **Ouvert ou sur invitation** : avec `SIGNUP=open` (par défaut), n'importe qui connaissant l'adresse peut créer un compte. Avec `SIGNUP=invite`, **conseillé pour une instance en ligne**, l'écran affiche « WEWATCH SE REJOINT SUR INVITATION » et un compte ne se crée que de deux façons : depuis un **lien d'invitation** d'un groupe (le nouveau compte en devient membre), ou avec le **code propriétaire** (`OWNER_CODE`, 12 caractères au moins) : choisissez **une phrase de plusieurs mots** (« pop corn sous la couette »), longue plutôt que compliquée. Un lien d'invitation marche aussi en mode `open`. Une fois les comptes du couple créés et dans « NOUS DEUX », **retirer `OWNER_CODE` de Vercel** (puis redéployer) : le code ne sert qu'au premier compte, et tant qu'il existe, quiconque le connaît entre dans « NOUS DEUX » sans invitation.
- **Le groupe « NOUS DEUX »** : la liste d'avant les comptes (1.x) y est gardée telle quelle, films, statuts et dates. Un compte créé avec le code propriétaire le rejoint aussitôt ; ensuite, on y invite par son lien, comme dans tout groupe. En mode `open`, le lien « J’AI UN CODE PROPRIÉTAIRE » reste proposé, avec un code facultatif.
- Un navigateur trop ancien pour les passkeys affiche « CE NAVIGATEUR NE GÈRE PAS LES CLÉS D’ACCÈS… » à la place des boutons.
- Les passkeys sont liées à l'adresse de l'appli (`BETTER_AUTH_URL`) : changer d'adresse oblige à recréer les comptes.

- **Tentatives limitées** : la connexion, la création de compte, le code propriétaire et les actions sensibles (créer ou rejoindre un groupe, changer de prénom, supprimer une clé ou son compte) sont limités par adresse IP ou par compte, sur une fenêtre de 10 minutes à une heure. Au-delà, l'écran répond « TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT. ».

- **Le lien d'invitation est un secret** : qui l'a peut entrer dans le groupe. L'appli ne l'écrit jamais dans ses journaux et ne le transmet pas aux sites ouverts depuis la page (`Referrer-Policy: no-referrer`), mais l'hébergeur peut journaliser les adresses visitées : s'il a trop circulé, « RÉGÉNÉRER LE LIEN ».

> À venir : la connexion avec Google (on pourra alors supprimer sa dernière clé d'accès).

## Vos données

- **Ce qui est gardé** : votre prénom, vos clés d'accès (leur partie publique : la partie secrète ne quitte jamais l'appareil), vos groupes et leurs listes, et pour chaque appareil connecté sa session (navigateur et adresse IP). Ni email, ni mot de passe. Les compteurs de tentatives (par adresse IP ou par compte) s'effacent au bout d'un jour, les sessions expirées aussi. Un compte supprimé part tout de suite de la base (voir « MON COMPTE »).
- **Sauvegardes chiffrées** : avant chaque mise à jour de la base, la CI sauvegarde les listes, les groupes et les comptes (prénom, clés publiques), **jamais** les sessions ni aucun jeton. Le fichier est chiffré (AES-256-GCM, clé `BACKUP_KEY`) : sans la clé, il est illisible. Il est gardé **90 jours** comme artefact GitHub, puis effacé ; un compte supprimé peut donc y rester jusqu'à 90 jours (son prénom et ses clés publiques).
- **Restaurer** : une sauvegarde se remet dans une base neuve, jamais par-dessus des données ; la marche à suivre est dans [`docs/bascule-2.0.md`](docs/bascule-2.0.md) (§7). Après une restauration, chacun se reconnecte avec sa clé d'accès, et chaque groupe régénère son lien d'invitation.
- **En-têtes de sécurité** sur chaque page : une politique de contenu stricte (`Content-Security-Policy` : scripts, styles et polices de l'appli seule, images de l'appli et de TMDB, aucune intégration dans un autre site), `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy` (ni caméra, ni micro, ni position).

## L'installer comme une appli

C'est une PWA : une fois installée, elle s'ouvre en plein écran depuis son icône de ticket, comme une appli.

- **iPhone / iPad** (Safari) : Partager → « Sur l'écran d'accueil ».
- **Android** (Chrome) : menu ⋮ → « Installer l'application ».
- **Ordinateur** (Chrome, Edge) : icône d'installation dans la barre d'adresse.

## Sous le capot

|         |                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appli   | Next.js 16 (App Router, Server Actions, Cache Components), React 19, TypeScript strict                                                                    |
| Données | SQLite via Turso / libSQL, Drizzle ORM ; API TMDB appelée côté serveur uniquement                                                                         |
| Style   | CSS Modules, design tokens centralisés, animations Motion (`prefers-reduced-motion` respecté)                                                             |
| Tests   | Vitest (unitaires et fonctionnels sur une vraie base et un faux TMDB), Playwright (parcours, 6 formats d'écran, accessibilité axe, captures de référence) |
| Qualité | ESLint (taille, complexité, sens des couches), jscpd (doublons), knip (code mort)                                                                         |
| CI/CD   | lefthook en local, GitHub Actions en parallèle, versions semver automatiques (release-please)                                                             |

```
src/
  domain/    règles métier pures : films, tirage, filtres « ce soir », transitions de statut, groupes, « voulu par »
  db/        schéma Drizzle et dépôts : groupes, membres et liens d'invitation, liste d'un groupe, swipes de chacun, données TMDB
  tmdb/      client TMDB, validation, mapping, thèmes de swipe
  auth/      comptes Better Auth : passkeys, sessions
  access/    qui entre : décision du proxy, inscription ouverte ou sur invitation
  server/    assemblage base + TMDB (un seul endroit), groupe affiché, appartenance, lien d'invitation résolu
  features/  un dossier par écran : composants, actions serveur, logique testée
  ui/        composants partagés sans logique métier
  app/       routes Next, manifest et icônes générées
```

La conception complète, version par version, est dans [`docs/superpowers/specs/`](docs/superpowers/specs/2026-10-23-we-watch-design.md).

## Contribuer

```bash
npm run ci          # tout ce que vérifie la CI : format, lint, types, doublons, code mort, tests, e2e
npm run test:e2e    # tests de bout en bout seuls (Docker requis)
```

Les règles du projet (architecture, conventions, définition de « fini ») sont dans [`CLAUDE.md`](CLAUDE.md), écrit pour les humains comme pour les agents de code. En bref : petits fichiers, logique pure testée, commits [Conventional Commits](https://www.conventionalcommits.org) (`feat`, `fix`… fixent le numéro de version), et la direction artistique ne se négocie pas.

## Crédits

<img src="public/tmdb-logo.svg" alt="TMDB" height="14"> This product uses the TMDB API but is not endorsed or certified by TMDB. Disponibilités en streaming : [JustWatch](https://www.justwatch.com/fr), via TMDB.

## Licence

[MIT](LICENSE) : réutilisez, modifiez, hébergez, en gardant la mention de copyright. Les données de films appartiennent à TMDB et restent soumises à [leurs conditions](https://www.themoviedb.org/api-terms-of-use).
