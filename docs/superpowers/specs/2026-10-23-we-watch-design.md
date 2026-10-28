# we-watch — Design V1

> Date : 2026-10-23 · Statut : validé
> Maquette de référence : [`assets/2026-10-23-we-watch-mockup.html`](assets/2026-10-23-we-watch-mockup.html) (à ouvrir dans un navigateur)

## 1. Intention

Thomas et sa copine ont une très longue liste de films à voir ensemble, et ils sont tous les deux indécis : chaque soir, choisir un film devient une épreuve. Le problème n'est pas de *trouver* des films mais de *trancher*.

we-watch règle ça en séparant les deux moments :

1. **Remplir la liste ensemble**, tranquillement, en swipant des films comme sur Tinder.
2. **Le soir venu, laisser le hasard décider** : un bouton, un film.

C'est une mini-appli perso pour deux personnes, pour le fun. Elle doit être légère, gratuite à héberger et joyeuse à utiliser.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs V1**
- Swiper des films bien notés, **sans aucun filtre de disponibilité** : c'est leur liste qui compte, pas le catalogue d'une plateforme. Ajout en un geste à la liste « à voir ».
- **Rechercher un film par titre** (API TMDB) et l'ajouter directement, qu'il soit en streaming ou non.
- Afficher partout (swipe, tirage, liste, recherche) **les plateformes de streaming FR** sur lesquelles le film est disponible, quelles qu'elles soient, ou « PAS EN STREAMING ». C'est une **information**, jamais un filtre.
- Tirer au hasard un film de la liste « à voir », avec affichage de l'**heure de fin** si on le lance maintenant.
- Gérer la liste : parcourir les films « à voir » et « vus », retirer un ajout par erreur, annuler un « vu » par erreur.

**Non-objectifs V1** (pistes pour plus tard, à ne pas implémenter)
- Recommandations personnalisées.
- Système de « match » à deux (vous swipez ensemble sur un seul appareil).
- Catégories / « mood » pour orienter le swipe.
- Tirage parmi les films déjà vus (« à revoir »). Le modèle de données doit le permettre (cf. `watched_at`), mais aucune UI en V1.
- Revenir sur un « BOF » : un film refusé ne revient jamais.
- Lien direct vers la plateforme de streaming.
- **Filtres par plateforme** (V2, explicitement voulue par Thomas). Le modèle doit garder la liste des plateformes de chaque film pour le permettre.
- Comptes utilisateurs, authentification, code d'accès. L'URL publique non devinée est jugée suffisante (choix explicite de Thomas).
- Mise à jour de la disponibilité streaming après l'ajout.

**Anti-objectifs** (ce qui ferait échouer le projet même si « ça marche »)
- **Une UI « générique IA »** : dark mode sobre, dégradé violet, cartes grises arrondies. La direction visuelle (§5) n'est pas négociable.
- **Du code bâclé.** Thomas est développeur et sera exigeant : typage strict, séparation claire des responsabilités, logique métier testée, pas de code mort ni de raccourcis « pour que ça passe ».
- Une appli lourde ou payante à faire tourner.

## 3. Contraintes

- **Hébergement : Vercel (Hobby) + Turso (offre gratuite)**. Pas de Docker. Vercel n'a pas de disque persistant, d'où Turso (SQLite hébergé via libSQL).
- **Source de données : API TMDB** (v3), avec une clé gardée **côté serveur** uniquement.
- **Repo privé** GitHub : `thogio8/we-watch`.
- **Mobile first.** Sur desktop, la même colonne centrée suffit.
- **Langue de l'UI : français.** Données TMDB demandées en `fr-FR`.
- Attributions obligatoires : TMDB (« This product uses the TMDB API but is not endorsed or certified by TMDB », avec logo) et JustWatch pour les données de disponibilité. Elles vont dans un endroit discret (pied de page de l'onglet Liste par exemple), sans rien casser de la DA.

## 4. Parcours (le scénario validé)

La maquette illustre chaque étape. Une barre de navigation basse à trois onglets est toujours visible : **TIRER · SWIPER · LISTE**. L'appli s'ouvre sur **TIRER**.

### 4.1 Tirer (écran 1 → 2 → 3)

1. **Accueil** : titre « CE SOIR ON REGARDE », compteur (« 23 films à regarder · 4 vus »), heure actuelle, gros bouton rond **TIRER UN FILM**.
2. **Résultat** : un ticket avec affiche, titre, année, durée, note, plateforme(s) et résumé court. Un tampon affiche **« FINI À HH:MM »**, soit l'heure de l'appareil + la durée du film, au format 24 h (« 23H12 »).
   - **RETIRER** : le film rejoint la **pile « Pas ce soir »** (tickets déchirés + compteur) et un autre film est tiré parmi ceux qui ne sont pas dans la pile.
   - **ON LE REGARDE** : le film passe en « vu », avec la date du jour. Retour à l'accueil (ou écran de confirmation léger : au choix du builder).
3. **Pile épuisée** : quand tous les films « à voir » sont dans la pile, écran « VOUS ÊTES DIFFICILES CE SOIR » avec **ON REMET TOUT** (vide la pile, retire) et **ALLER SWIPER**.
   - **Liste vide** : même écran, avec un message adapté et seulement **ALLER SWIPER**.

**Règles de la pile « Pas ce soir »** : elle vit uniquement côté client, en mémoire, pour la session de tirage en cours. Elle n'est **pas** persistée : recharger la page la vide. Elle garantit qu'on ne retombe pas tout de suite sur un film refusé.
- La pile **et** le film tiré en cours **survivent aux changements d'onglet** (TIRER → SWIPER → TIRER) : l'état vit au-dessus des routes, dans le layout. *(Choix de conception.)*
- **ON LE REGARDE** vide la pile : la soirée est réglée.
- Les films ajoutés entre-temps (par exemple via « ALLER SWIPER » depuis l'écran « pile épuisée ») sont tirables dès le retour, sans vider la pile.

**Durée inconnue** (TMDB renvoie `runtime` nul ou 0) : on remplace le tampon par « DURÉE INCONNUE ».

### 4.2 Swiper (écran 4)

**Usage** : vous swipez **ensemble, sur un seul téléphone** (Thomas : « on va la remplir quand on sera ensemble »). Il n'y a pas de synchronisation temps réel à prévoir. Par robustesse, si l'appli est ouverte sur deux appareils, une décision déjà enregistrée ne doit pas être écrasée par une seconde décision venue du swipe : la première l'emporte. *(Choix de conception.)*

- Une carte-ticket à la fois : affiche, titre, année, durée, note, plateforme(s), résumé.
- **Geste de swipe** (droite = garder, gauche = bof) **et** boutons équivalents **✕ BOF** / **ON LE VEUT ♥**. Les deux doivent marcher : le geste pour le fun, les boutons pour l'accessibilité et le desktop.
- **ON LE VEUT** : le film entre dans la liste « à voir ».
- **BOF** : le film est mémorisé comme refusé et **ne revient jamais**.
- Un film déjà présent en base (quel que soit son statut) n'est jamais reproposé.
- **Ordre** : les films les mieux notés d'abord. **Aucun filtre de plateforme ni de disponibilité** (décision de Thomas : « on ne se contente pas de filtrer Amazon ou Netflix, c'est notre liste qui compte »).
- La carte affiche les **logos ou noms de toutes les plateformes FR** où le film est disponible.
- Quand il n'y a plus rien à proposer : écran de fin dans la même DA.

### 4.3 Liste (écrans 5 et 6)

- Deux onglets avec compteurs : **À VOIR** et **VUS**.
- Chaque ligne : vignette d'affiche, titre, durée + plateforme (à voir) ou « Vu le JJ/MM » (vus).
- **À VOIR → ✕** : retire le film de la liste. Il passe en statut « refusé », donc ne revient pas au swipe. *(Choix de conception, cf. §8.)*
- **VUS → ↺ À VOIR** : remet le film dans « à voir » et efface `watched_at`.
- Tri : à voir par date d'ajout décroissante, vus par date de visionnage décroissante. *(Choix de conception.)*

### 4.4 Recherche (écrans 5′ et 7)

- Une barre **« AJOUTER UN FILM… »** en haut de l'onglet LISTE, visible quel que soit le sous-onglet.
- La saisie interroge TMDB (`/search/movie`, `fr-FR`), avec un délai anti-rebond. Les résultats remplacent temporairement la liste ; ✕ dans le champ ramène à la liste.
- Chaque résultat : vignette, titre, année, durée, note, et **les plateformes FR**, ou un tag pointillé **« PAS EN STREAMING »**.
- Actions :
  - film absent de la base ou **refusé** : **+ AJOUTER**, qui le passe en « à voir ». Chercher exprès un film refusé, c'est avoir changé d'avis. *(Choix de conception.)*
  - film déjà « à voir » ou « vu » : état inactif **✓ À VOIR** / **✓ VU**.
- **Aucun blocage** : on peut ajouter un film disponible nulle part en streaming. Il est tirable comme les autres, et son ticket affiche « PAS EN STREAMING ».

## 5. Direction visuelle : « Ticket d'entrée » (riso fluo)

Direction choisie par Thomas parmi plusieurs pistes. Ce qu'il aime : **ça sort du commun, c'est coloré et lumineux, les gros boutons et le texte en majuscules**. Il a explicitement rejeté le néon sur fond sombre et le style « décalage d'impression ».

- **Papier** : fond crème `#fff4d6` avec une trame de points fine (impression riso).
- **Encres** : marine `#1b1b6b` (texte, contours, ombres), rose fluo `#ff3fa4`, jaune fluo `#ffe600`, bleu `#2f6bff`.
- **Typo** : **Archivo Black** pour les titres, boutons et titres de films, toujours en MAJUSCULES. **Space Mono** pour les méta et le texte courant.
- **Formes** : contours épais (3 px) à l'encre marine ; **ombres décalées pleines** (pas floues) ; un léger **halo coloré** (rose ou jaune) sur les éléments clés, pour le côté « glowy ».
- **Ticket** : carte rose, affiche en haut, bordure pointillée, **encoches** de part et d'autre, tampons inclinés (plateforme, « FINI À … »). Le tampon « ADMIT 2 » a été retiré en V1.2 à la demande de Thomas.
- **Pile « Pas ce soir »** : petits tickets déchirés empilés.
- **Boutons** : rectangles arrondis à contour épais et ombre décalée. Action principale en jaune (ou rose pour « ON LE VEUT »), secondaire en blanc.
- Les vraies affiches TMDB remplacent les aplats de couleur de la maquette.
- Les **animations** sont bienvenues tant qu'elles restent légères : carte qui part au swipe, ticket qui se déchire, tampon qui « tombe ». Respecter `prefers-reduced-motion`.
- Les tokens de design (couleurs, ombres, rayons, typos) sont **centralisés** et non dupliqués dans les composants.
- Les textes d'interface de la maquette sont des propositions ; Thomas pourra les réécrire.

## 6. Décisions techniques (prises avec Thomas)

| Sujet | Décision |
|---|---|
| Framework | **Next.js** (App Router) en **TypeScript strict** |
| Base | **SQLite via Turso** (libSQL). En local, fichier SQLite via le même client libSQL (`file:`). |
| ORM / migrations | **Drizzle** + drizzle-kit |
| Hébergement | **Vercel Hobby** |
| Données films | **TMDB API**, appelée uniquement côté serveur |
| Auth | Aucun compte ; code d'accès partagé depuis la V1.1 (§10) |

## 7. Données

### 7.1 Ce qu'on stocke

Une seule entité **film décidé**, identifiée par son id TMDB. On stocke un instantané des infos nécessaires à l'affichage, pour que le tirage et la liste n'aient pas besoin d'appeler TMDB.

Champs nécessaires (nommage et types laissés au builder) :
- id TMDB (clé)
- titre (fr), année de sortie, durée en minutes (nullable), résumé, chemin de l'affiche, note moyenne
- liste des plateformes de streaming FR (abonnement) au moment de l'ajout (id et nom TMDB du provider, logo). Elle peut être vide (« PAS EN STREAMING »). Le stockage doit permettre un futur filtre par plateforme.
- **statut** : `to_watch` | `watched` | `rejected`
- date de décision (ajout ou refus), date de visionnage (nullable)

Les films refusés peuvent ne garder que le strict nécessaire, mais une seule table avec un statut est le choix le plus simple. *(Choix de conception, le builder peut affiner.)*

### 7.2 Côté TMDB (indications, à vérifier dans la doc TMDB)

- Pile de swipe : `GET /discover/movie` avec `watch_region=FR`, **sans** paramètre de provider ni de monétisation, `sort_by=vote_average.desc`, un plancher `vote_count.gte` pour écarter les films à trois votes (valeur de départ suggérée : 1000, ajustable), `language=fr-FR`.
- Pagination : on récupère les pages suivantes au fil du swipe, en filtrant côté serveur les ids déjà en base.
- La durée n'est pas dans `/discover` : il faut `GET /movie/{id}` (avec `append_to_response=watch/providers` pour avoir les plateformes FR exactes). Le builder choisit s'il enrichit à l'affichage de la carte ou à l'ajout. Dans tous les cas, l'heure de fin doit être disponible au tirage sans appel réseau.
- Affiches : CDN images TMDB, avec une taille adaptée au mobile.

## 8. Choix de conception à vérifier (pris par moi, pas par Thomas)

- Retirer un film de « à voir » le passe en **refusé** (il ne revient pas au swipe) plutôt que de le supprimer.
- Tri des listes (ajout décroissant, visionnage décroissant).
- `vote_count.gte = 1000` comme seuil de « bien noté / classique ».
- Les plateformes affichées sont celles de l'offre **abonnement** en France (pas la location ni l'achat).
- La barre de recherche est dans l'onglet LISTE.
- Un film refusé peut être ré-ajouté via la recherche.
- Durée inconnue → tampon « DURÉE INCONNUE ».
- Attributions TMDB/JustWatch en pied de page de l'onglet Liste.

## 9. Laissé au builder

- Structure du projet, découpage en modules et frontière client/serveur (Server Actions ou Route Handlers).
- Approche CSS, à condition de respecter la DA et la centralisation des tokens (§5).
- Librairie de geste ou implémentation maison du swipe.
- Stratégie de cache/pagination TMDB.
- Outillage qualité : lint, format, tests. Attendu au minimum : **tests unitaires sur la logique métier** (tirage avec pile d'exclusion, calcul de l'heure de fin, filtrage de la pile de swipe, transitions de statut).
- Gestion des erreurs TMDB et réseau, dans la DA.
- Conventions de commit : `type(scope): description`, header seul. **Thomas commite lui-même.**

## 10. V1.1 — code d'accès et app iPhone (décidé avec Thomas le 2026-10-23)

### 10.1 Code d'accès partagé

L'URL de prod est publique : un code partagé, saisi une fois par appareil, tient les inconnus dehors. Toujours pas de comptes.

- Variable serveur **`ACCESS_CODE`** obligatoire (8 caractères minimum ; phrase de passe de 12+ caractères recommandée, la pause sur mauvais code ne bloquant pas les essais en parallèle), validée avec les autres dans `src/env.ts`.
- **Jeton** = HMAC-SHA256 (clé `ACCESS_CODE`, message `we-watch-access-v1`), en hexadécimal, calculé avec Web Crypto et comparé en temps constant. Changer `ACCESS_CODE` déconnecte tous les appareils.
- **Cookie `ww_access`** : httpOnly, `Secure` en production (pas en dev http local / LAN), SameSite=Lax, Path=/, un an.
- **`src/proxy.ts`** (le `middleware` renommé de Next 16) protège toutes les requêtes, pages et POST de Server Actions, sauf `/unlock`, `/_next/*`, les fichiers statiques (polices, images, `/tmdb-logo.svg`), le manifest et les icônes (iOS les charge sans cookie). Sans cookie valide : une page est redirigée vers `/unlock`, un POST reçoit un 401. La décision est une fonction pure testée (`accessDecision`).
- **Écran `/unlock`** dans la DA : titre « CE SOIR ON REGARDE », ticket « ENTREZ LE CODE », un champ masqué, bouton « ENTRER », sans barre de navigation. Bon code → cookie posé puis retour à `/`. Mauvais code → « MAUVAIS CODE », sans détail, champ vidé, après une pause fixe d'environ 500 ms (frein simple aux essais en série, sans stockage).

### 10.2 « Ajouter à l'écran d'accueil » (iPhone d'abord)

- **Manifest** `src/app/manifest.ts` : nom et nom court « we-watch », `start_url` `/`, `display: standalone`, fond et thème `#fff4d6` (papier), `lang: fr`, icônes 192 et 512, plus une icône maskable.
- **Icônes générées en code** (`next/og`, aucun binaire dans git) : ticket rose à contour marine, ombre décalée bleue, encoches et « WW » massif, sur papier crème. `icon` (32, 192, 512), `apple-icon` (180) et `/maskable-icon` (512, ticket réduit dans la zone sûre). Le `favicon.ico` du scaffold est supprimé.
- **Métadonnées iOS** : `appleWebApp` (capable, titre « we-watch », barre d'état `default`, claire avec texte foncé, adaptée au fond crème), `applicationName`.
- **Viewport** `viewport-fit=cover` : la colonne, la barre de navigation fixe et `/unlock` respectent les `env(safe-area-inset-*)` pour ne rien cacher sous l'encoche ni l'indicateur d'accueil.
- **Pas de service worker** ni de mode hors ligne.

## 11. V1.2 « Ce soir » (décidé le 2026-10-27)

Thomas : « on reste pour nous, on oublie la partie business ». Première étape de la roadmap du 2026-10-26 (`docs/roadmap/`), maquette A. Objectif : attaquer les 26 minutes de choix, sans changer le tirage par défaut. Arbitrages pris par Claude (Thomas a délégué) : les plateformes deviennent un **filtre optionnel** du tirage, jamais un filtre du swipe.

### 11.1 Filtres « ce soir » (TIRER)

Sur l'accueil du tirage, un panneau « LA SOIRÉE » au-dessus du bouton, trois rangées de puces, toutes optionnelles :

- **FINI AVANT** (choix unique) : PEU IMPORTE · 22H30 · 23H · 23H30 · MINUIT · 1H. Un film est gardé si `maintenant + durée ≤ heure de coucher`. L'heure de coucher est la prochaine occurrence de cette heure ; si elle est passée de moins de 12 h (il est 23h50, coucher 23h30), plus rien ne rentre. Durée inconnue : exclu (on ne peut rien promettre).
- **ON A ENVIE DE…** (choix multiple, « ou ») : RIRE (comédie) · FRISSONNER (horreur, thriller, mystère, policier) · S'ÉMOUVOIR (drame, romance) · RÉFLÉCHIR (documentaire, histoire, guerre, SF) · S'ÉVADER (aventure, fantastique, animation, familial, action, western). Genres TMDB.
- **DISPO CHEZ NOUS** (choix multiple, « ou ») : les plateformes présentes dans la liste « à voir », plus TOUT (aucun filtre, actif par défaut).
- Le bouton devient **TIRER PARMI N** dès qu'un filtre est actif. Zéro film : « AUCUN FILM NE COLLE » et **ENLEVER LES FILTRES**. La pile « Pas ce soir » et l'écran « difficiles » raisonnent sur les films filtrés.
- Les filtres vivent dans la session de tirage (survivent aux onglets). L'heure de coucher et les plateformes sont **mémorisées sur l'appareil** (localStorage) ; l'humeur repart de zéro à chaque ouverture.

### 11.2 Données enrichies et rafraîchies

- Instantané : **genres** (ids TMDB) et **clé YouTube de la bande-annonce** (vidéo `Trailer` YouTube, VF d'abord, sinon VO). Deux colonnes, migration additive.
- **Rafraîchissement quotidien** (Vercel Cron, 1/jour, permis en Hobby) : les films « à voir » et « vus » reprennent leur instantané TMDB (plateformes, durée, genres, bande-annonce) ; statut et dates intacts. Le filtre plateformes ne ment donc pas plus d'un jour. Route `GET /api/cron/refresh-movies`, hors cookie d'accès, protégée par `Authorization: Bearer CRON_SECRET` (variable facultative, 16+ caractères ; absente → 401). Le premier appel manuel sert de remplissage des films existants.

### 11.3 Bande-annonce

Bouton « ▶ BANDE-ANNONCE » sur la carte de swipe et sur le ticket tiré, s'il y a une vidéo : lien `youtube.com/watch` dans un nouvel onglet (l'app YouTube s'ouvre sur iPhone). Pas d'iframe.

### 11.4 Decks thématiques (SWIPER)

Une rangée de puces défilante sous le titre : LES MIEUX NOTÉS (défaut) · ANNÉES 80 · ANNÉES 90 · MOINS DE 1H40 · ANIMATION · CINÉMA FRANÇAIS · CINÉMA CORÉEN. Le deck est dans l'URL (`/swipe?deck=…`), chaque deck est un `discover` TMDB trié par note avec son propre plancher de votes. Toujours aucun filtre de plateforme.

### 11.5 Annuler le dernier swipe

Après chaque décision, un bandeau « ↺ ANNULER » pendant 5 s. Annuler remet la carte en tête et efface la décision en base, **seulement si c'est bien ce swipe qui l'a créée** (suppression conditionnée au statut attendu ; un swipe « noop » ne s'annule pas).

### 11.6 Hors périmètre V1.2

Identité toi/moi, notes, vetos (V1.3) ; page crédits et hors ligne (les attributions restent en pied de LISTE).

## 12. V1.2.1 : responsive sur tous les appareils (2026-10-27)

Thomas : « on ne se contente plus du mobile first ». Seul sujet de la version : que chaque écran rende bien du petit Android (360×640) au grand écran (1920×1080), téléphone couché compris. Aucune nouvelle fonctionnalité.

Constat de l'audit (9 formats, 8 écrans) : aucun débordement horizontal, mais (1) sur les petits téléphones le ticket et la carte ont une affiche de hauteur fixe, les boutons passent sous la barre ; (2) téléphone couché inutilisable (barre du bas sur un quart de l'écran, on ne voit que l'affiche) ; (3) tablette et ordinateur : une colonne de 480 px perdue au milieu, barre en bas, liste interminable, rangée de thèmes coupée.

Règles retenues :

- **Téléphone portrait** : DA inchangée ; l'affiche du ticket tiré et de la carte de swipe suit la hauteur de l'écran (`clamp` sur `dvh`) pour que les boutons restent visibles dès 360×640.
- **Dès 760 px de large** (tablette, ordinateur, téléphone couché) : barre de navigation **en haut**, compacte ; colonne élargie à 960 px.
- **Ticket horizontal** dès que la colonne fait 640 px : affiche à gauche (2:3), perforation **verticale** avec ses encoches en haut et en bas, infos à droite, comme un vrai billet. Concerne le ticket tiré et les cartes de swipe ; le ticket du code d'accès et celui d'erreur restent verticaux. Le ticket déchiré (RETIRER) se déchire le long de la perforation, verticale ou horizontale.
- **Éléments étroits par nature** (accueil du tirage, panneau « la soirée », code d'accès, erreur) : centrés, 480 px au plus.
- **Liste et recherche** : grille de lignes (`auto-fill`, 300 px min) en large.
- **Thèmes du swipe** : défilement avec fondu au bord sur téléphone, sur plusieurs lignes centrées en large.
- Bandeaux (« ↺ ANNULER », erreurs) : hors des boutons dans chaque disposition.

## 13. V1.2.2 et V1.2.3 : finitions et entretien (2026-10-27)

- **V1.2.2** : sur le ticket couché, l'affiche est trop petite pour porter le tampon « FINI À… » ; il passe sur la partie rose (en haut à droite), le titre lui laisse la place.
- **V1.2.3** (audit du code, aucune fonctionnalité) : `CLAUDE.md` pour les agents, CI GitHub (lint, types, tests + couverture), `npm run start:local` (un build servi sur la base locale, `npm start` visant la prod), bouton TIRER enfin réduit en paysage (ordre CSS), texte du ticket partagé entre TIRER et SWIPER (`ui/TicketDetails`), règle des swipes et contrôles des actions définis une seule fois, échecs du rafraîchissement quotidien journalisés (500 si tout échoue), plateformes regroupées par marque aussi dans la liste, valeurs CSS nommées (`--gutter`, `--ticket-max`).
- Versions taguées dans git (`v1.1.0` … `v1.2.3`) et numéro de `package.json` tenu à jour.
- **V1.2.4** (qualité, aucune fonctionnalité, rendu identique au pixel près) :
  - code découpé selon SOLID / KISS / DRY : écrans TIRER, SWIPER et LISTE en hooks + logique pure testée + un composant par vue ; transitions de statut en table ; briques partagées (`Headline`, `cx`, style d'onglet, helpers de test) ;
  - garde-fous automatiques : taille et complexité (ESLint), sens des couches (ESLint), doublons (jscpd), code mort (knip), couverture de tous les modules non UI ;
  - tests fonctionnels (actions serveur sur SQLite et faux TMDB) et e2e Playwright (build de prod, iPhone et desktop, 6 formats, axe) ;
  - CI locale `npm run ci` derrière des hooks git (lefthook), rejouée par GitHub Actions ;
  - `TMDB_API_URL` (facultatif) pour pointer l'appli vers le faux TMDB des tests.
- **V1.2.5** (2026-10-27) : texte **encre marine sur le rose** (tickets, bouton ♥, onglet actif) au lieu du blanc, pour un contraste conforme WCAG AA (5:1 au lieu de 3,2:1), décidé avec Thomas ; le titre « ENTREZ LE CODE » garde son décalage riso, imprimé en papier. Mise en prod uniquement par GitHub Actions après CI verte (sauvegarde, migration, test de fumée, retour arrière) ; tests visuels par captures ; Dependabot.

## 14. V1.3 : revenir en arrière, fiche film, versions semver (décidé le 2026-10-27)

Demandes de Thomas après usage.

### 14.1 Revenir en arrière au tirage

- **← RETOUR** sur le ticket tiré : retour à l'accueil (filtres, gros bouton). Le film affiché n'est **pas** mis dans la pile « pas ce soir » : il reste tirable ; la pile est gardée.
- **↺ RESSORTIR « TITRE »** sous la pile, sur le ticket tiré et sur « VOUS ÊTES DIFFICILES CE SOIR » : le dernier ticket déchiré qui colle encore aux filtres revient comme ticket tiré et quitte la pile. Le ticket qu'il remplace (tiré au hasard) n'est pas mis dans la pile.

### 14.2 Fiche d'un film (LISTE)

- Toucher une ligne de la liste ouvre **une page** `/list/<tmdbId>` (le retour du téléphone ramène à la liste).
- Contenu : grand ticket (affiche, titre, année, durée, note, genres en clair, plateformes, bande-annonce), résumé **complet** ; **réalisation et têtes d'affiche** (TMDB `credits`, 24 h de cache ; absent si TMDB ne répond pas, la fiche s'affiche quand même) ; **notre histoire** du film (« Ajouté le … », « Vu le … ») ; **actions** selon le statut (ON L'A VU / À REVOIR / RETIRER), qui ramènent à la liste.
- Un film absent de la liste (refusé, inconnu) : page « introuvable » avec retour à la liste.

### 14.3 Versions

Semver calculé depuis les commits (Conventional Commits) par release-please : `fix` → correctif, `feat` → mineure, `!` → majeure. Une PR « release » publie numéro, `CHANGELOG.md`, tag et release GitHub. Les déploiements suivent toujours chaque push vert.

### 14.4 V1.3.1 et V1.3.2 : correctifs

- **V1.3.1** (2026-10-27) : le téléphone garde les pages visitées 5 minutes (`staleTimes`), rafraîchies à chaque écriture : passer d'un onglet à l'autre ne recharge plus rien.
- **V1.3.2** (2026-10-28), trouvés en testant l'appli comme une utilisatrice :
  - TIRER restait figé sur son dernier écran (ticket d'un film déjà vu, boutons morts ; ou « RIEN À TIRER » avec une liste remplie) quand la liste changeait pendant qu'on était sur une autre page. Cause : Next garde la page en mémoire, endormie, et l'animation de sortie lancée là ne finit jamais. Hors écran, les vues se remplacent désormais sans animation.
  - Les titres et résumés TMDB perdent leurs marques de direction invisibles (U+200E…) ; les films déjà en base sont nettoyés par le rafraîchissement quotidien.
