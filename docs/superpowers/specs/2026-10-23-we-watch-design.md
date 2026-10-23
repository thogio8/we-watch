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
- **Ticket** : carte rose, affiche en haut, bordure pointillée, **encoches** de part et d'autre, tampons inclinés (« ADMIT 2 », plateforme, « FINI À … »).
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

- Variable serveur **`ACCESS_CODE`** obligatoire (4 caractères minimum), validée avec les autres dans `src/env.ts`.
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
