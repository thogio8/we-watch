# 2.2.0 · « C'EST UN MATCH ! » : design

Validé avec le mainteneur le 2026-11-05. Maquettes : https://claude.ai/artifact/1YJBFsZ4qVR3oyQrYae9k6 (privées, sept écrans iPhone 390 × 844). Complète la spec 2.0 (`2026-10-28-wewatch-v2-design.md`) et celle des coups de cœur (`2026-11-04-coups-de-coeur-design.md`), qui priment sur ce qu'elles ne changent pas ici.

## 1. Intention

Un **match**, c'est un film que **tout le groupe** a gardé en swipant. C'est le film qui plaît vraiment à tous, pas seulement à celui qui l'a trouvé. Le moment où le dernier membre qui manquait le garde est une petite fête (un tampon), et le groupe peut ensuite **ne tirer que parmi ses matchs**.

Aujourd'hui, ce moment ne peut presque jamais arriver : dès qu'un membre garde un film, il entre dans la liste du groupe, et la pile des autres exclut toute la liste (`deckExclusions`, `src/db/decisions.ts`). La fonctionnalité commence donc par **montrer aux autres membres les films que le groupe veut déjà**.

## 2. Objectifs, non-objectifs, anti-objectifs

- **Objectifs** : la pile propose les films voulus par les autres ; le match se forme au swipe, avec son moment ; la LISTE, la fiche, TIRER et le ticket le montrent ; TIRER peut ne tirer que parmi les matchs ; tout marche à 2 comme à 10 membres, et quand un membre arrive ou part.
- **Non-objectifs** : pas de notification hors de l'appli ; pas de seuil (« les trois quarts ») ; une recherche n'ajoute toujours pas d'envie ; pas de nouvel ordre dans la LISTE (coups de cœur en tête, puis le reste, inchangé).
- **Anti-objectifs** (un échec même si « ça marche ») :
  - un match qui disparaît parce que quelqu'un rejoint le groupe ;
  - un match qui apparaît sans que personne ait swipé (départ d'un membre, suppression d'un compte) ;
  - un texte qui énumère dix prénoms ;
  - un match dans un groupe d'une seule personne ;
  - une carte vue deux fois dans la même pile ;
  - un swipe enregistré dans le mauvais groupe.

## 3. Règles du match

1. **Définition au moment du swipe** : un « ON LE VEUT ♥ » fait un match quand, juste après lui, **chaque membre actuel** du groupe a une envie (`movie_want`) sur ce film, que le groupe compte **au moins deux membres**, que le film est « à voir » et qu'il n'est pas déjà un match.
2. **Un match est acquis** : il est enregistré (`group_movie.matched_at`, `matched_by` = celui qui l'a complété) et ne se recalcule plus. Un membre qui arrive ne le retire pas ; un membre qui part (ses envies partent avec lui, `leave`) n'en crée pas ; un compte supprimé non plus.
3. **Seul un swipe crée un match.** Ni la recherche, ni une transition, ni un départ.
4. **Ce qui le défait** :
   - « ↺ ANNULER » du swipe qui l'a complété, qui efface `matched_at` et `matched_by`. Le lien au swipe est exact, pas seulement à la personne : la pose du match écrit `matched_at` = le `wanted_at` de l'envie posée dans la même transaction, et `undoKeep` n'efface le match que si `matched_by` = moi **et** `matched_at` = le `wanted_at` de l'envie qu'il supprime. Ainsi, un membre qui a complété un match, est parti, revenu, et annule un nouveau swipe sur ce film ne défait pas l'ancien match (choix du builder, après relecture) ;
   - un film retiré puis rajouté (`search_add` sur un film écarté, qui efface déjà ses envies), qui efface les deux colonnes dans la même branche.
5. **Il survit** à « ON L'A VU » puis « ↺ À VOIR » (les envies restent) et au coup de cœur, qui est indépendant : un film peut être les deux.
6. **Concurrence** : l'envie et la pose du match sont dans la même transaction que le swipe, la pose étant un `UPDATE … WHERE matched_at IS NULL AND status = 'to_watch' AND (members ≥ 2) AND NOT EXISTS (un membre sans envie)` avec `RETURNING` : deux derniers swipes simultanés ne posent qu'un match, et seul le swipe qui l'a posé reçoit « match ». Jamais de lecture puis écriture.
7. **Suppression d'un compte** : `matched_by` passe à `NULL` explicitement (`deleteUserIn`), le match reste.

## 4. La pile (SWIPER)

- **Les films que le groupe veut déjà** : films du groupe « à voir », voulus par au moins un **autre** membre, pas voulus par moi, pas mis en BOF par moi (le BOF est personnel et vaut pour tous mes groupes : un film mis en BOF ne revient pas, même dans un autre groupe qui le veut). Ils passent **avant** les cartes du thème, sur la **première** fournée seulement (page 1, quel que soit le thème), dans cet ordre : le plus d'envies d'abord, puis l'envie la plus récente, puis `tmdb_id` (ordre total), **au plus 30** (constante nommée ; les suivants arrivent à la prochaine visite de la pile, une fois les premiers swipés). Tant que je ne les ai pas swipés, ils reviennent en tête à chaque changement de thème ou visite : ce sont des décisions en attente (choix du builder, après relecture). Leurs données viennent de la base (`movie_snapshot`), sans appel à TMDB : TMDB en panne ne les cache pas.
- **Les cartes du thème** excluent toujours toute la liste du groupe et mes BOF (inchangé) : un film n'apparaît jamais deux fois.
- **Bandeau de la carte** (sur l'affiche, à gauche, papier blanc) : jusqu'à trois autres membres, leurs prénoms (« BECCA LE VEUT », « LÉA ET HUGO LE VEULENT », « LÉA, HUGO ET SAM LE VEULENT ») ; au-delà, le nombre (« 9 MEMBRES LE VEULENT »). Un prénom absent (compte supprimé) n'existe pas ici : ses envies sont supprimées avec lui. **Écart accepté** : sur un ticket couché (colonne large, téléphone couché), l'affiche est trop étroite ; le bandeau, et le petit tampon d'un match au-dessus de lui, se placent en bas à droite du talon (captures `12` et `12f`).
- **Sous la carte**, une ligne : « TU LE VEUX AUSSI ? C'EST UN MATCH. » si ma seule envie manque ; rien sinon. Film déjà match (cas d'un nouveau membre) : petit tampon « ♥♥ MATCH » sur l'affiche et « LE GROUPE EN AVAIT FAIT UN MATCH AVANT TON ARRIVÉE : IL LE RESTE. » (texte final au builder, même sens : « DÉJÀ UN MATCH DU GROUPE : IL LE RESTE. », sur une ligne à 320 px). La ligne se tient sous l'ombre de la carte de derrière ; téléphone couché, où la hauteur manque, elle ne prend aucune hauteur et se place à gauche des boutons, qui ne bougent donc pas.
- **« ON LE VEUT ♥ » sur un film déjà listé** : ajoute mon envie, ne touche pas la ligne de la liste (déjà là), n'a pas besoin de TMDB (l'instantané est en base). **« ✕ BOF »** : mon BOF personnel, la liste n'est pas touchée (comme aujourd'hui).
- **Le moment du match** : quand le serveur répond « match » à mon swipe (jamais prédit par le client), un tampon jaune à double bordure « C'EST UN / MATCH / ♥♥ » s'imprime sur la pile (**écart accepté** à la maquette : « MATCH » est en encre avec un décalage rose, pas en rose, pour le contraste sur le jaune ; les cœurs, décoratifs, restent rose et bleu), avec un rebond (`prefers-reduced-motion` : apparaît sans mouvement), puis « IL NE MANQUAIT QUE TOI » / « Tout le monde le veut : il rejoint vos matchs », et deux boutons : « VOIR LA LISTE » (LISTE telle quelle, sans nouveau filtre : la maquette disait « VOIR NOS MATCHS », renommé pour ne pas promettre un filtre qui n'existe pas ; choix du builder, après relecture) et « CONTINUER ▸ » (ferme, focus rendu à la pile). Annoncé aux lecteurs d'écran (`role="status"` ou dialogue, au builder). Le tampon ne bloque pas la saisie au-delà de ces deux boutons.
- « ↺ ANNULER » reste possible après un match : il défait le match (règle 4).

## 5. Ailleurs dans l'appli

- **Ligne « voulu par »** (LISTE, fiche, ticket : la même fonction partout, `wantedLine` dans `domain/attribution.ts`, qui prend désormais le nombre de membres et si le film est un match). Elle décrit les envies telles qu'elles sont, et ne dit « tous » que pour un match, pour ne jamais suggérer un match qui n'existe pas (choix du builder, après relecture) :
  - match **et** tous les membres actuels le veulent : « voulu par vous deux » (2 membres), « voulu par tout le groupe » (3 et plus) ;
  - sinon, jusqu'à trois prénoms : « voulu par Léa, Hugo et Sam » (inchangé), même si ce sont tous les membres (après un départ, par exemple) ;
  - au-delà : « voulu par 8 sur 10 » (un match acquis avant l'arrivée de nouveaux membres peut ainsi dire « 9 sur 10 » à côté de son tampon : c'est la vérité).
- **LISTE** : un petit tampon jaune « MATCH » sur l'affiche de la ligne d'un match (onglets « À VOIR » et « VUS ») ; ordre inchangé.
- **Fiche** (`/list/[tmdbId]`, bloc « CHEZ NOUS ») : une ligne « match du groupe le 5 novembre 2026 » (date longue, `formatLongDate`).
- **TIRER** :
  - le filtre « ON TIRE PARMI » gagne « ♥♥ NOS MATCHS · n » à côté de « TOUTE LA LISTE » et « ♥ NOS COUPS DE CŒUR · n » : un choix parmi trois, jamais deux à la fois ;
  - un choix sans objet (zéro match) n'est pas proposé ; comme le filtre coups de cœur, il **n'est jamais stocké** sur l'appareil, et s'affiche à « TOUTE LA LISTE » tant qu'il n'a plus d'objet ;
  - avec les matchs, le gros bouton dit « TIRER UN MATCH » ;
  - le décompte d'accueil gagne « dont n matchs » (au singulier « dont 1 match »), à côté de « dont n ♥ » ;
  - les autres filtres (heure, humeur, plateformes) se combinent comme aujourd'hui.
- **Ticket du film tiré** : tampon « ♥♥ C'EST UN MATCH » (jaune, en haut à gauche de l'affiche) si le film est un match, en plus du tampon coup de cœur s'il l'est aussi (choix de placement au builder, vérifié par les captures sur les formats de la spec §12).
- **Comptes** : `counts().matches` = films « à voir » avec `matched_at` non nul, du groupe seulement.

## 6. Données

- Migration additive `0014` : `group_movie.matched_at` (timestamp, nullable) et `matched_by` (texte, nullable, clé étrangère vers `user.id` `ON DELETE set null`, **écrite à la main** comme dans `0012`, drizzle-kit la perdant sur un `ADD COLUMN`). L'ancien code (2.1) les ignore : la migration passe avant lui sans risque.
- La sauvegarde (`group_movie: "*"`) et la restauration les prennent sans changement ; un test le vérifie.
- Retour arrière vers la 2.1 : les colonnes restent remplies et sont ignorées ; au retour de la 2.2, les matchs sont toujours là. Un film « défait » par la 2.1 (retiré puis rajouté, ce qui efface les envies) garde son `matched_at` : limite connue, à écrire dans `CLAUDE.md` comme pour les coups de cœur.

## 7. Sécurité et serveur

- Aucune nouvelle action serveur exposée hors de `decideSwipe` / `undoSwipe` / `loadMoreCards` (même garde : `assertMember`, groupe lié par la page) : la pile du groupe ne sort que pour un membre, et seulement les prénoms de ses membres.
- `decideSwipe` renvoie désormais le résultat du swipe **et** si ce swipe a fait le match (forme exacte au plan) ; le méta-test des actions serveur (`tests/functional/server-actions.test.ts`) continue de passer.
- Pas de nouvelle limite de tentatives (swipe déjà non limité, idempotent).

## 8. Tests exigés (le mainteneur sera intransigeant)

Chaque règle ci-dessus a son test au bon niveau, et les cas cassants sont testés explicitement :

- **Unitaires** : `wantedLine` (0, 1, 2, 3, 4 prénoms ; tous à 2, à 3, à 10, avec et sans match ; « 8 sur 10 » ; match avec un nouveau membre) et le bandeau de la pile (mêmes bornes) ; propriétés fast-check sur ces deux textes (jamais plus de trois prénoms, toujours un compte cohérent) ; le choix du filtre de TIRER (trois choix, sans objet, jamais stocké) ; le décompte « dont n matchs ».
- **Dépôts** (SQLite réelle) :
  - le match posé au dernier swipe, et pas avant ;
  - jamais à un membre seul ;
  - jamais sur un film vu ou écarté ;
  - idempotent (deux swipes du même membre) ;
  - deux derniers swipes simultanés, un seul match ;
  - un membre qui arrive ne retire rien ;
  - un membre qui part n'en crée pas ;
  - compte supprimé : `matched_by` à `NULL`, le match reste ;
  - « ANNULER » défait le match qu'il a posé, pas un match plus ancien (y compris celui qu'il avait posé avant de quitter puis de rejoindre le groupe) ;
  - retiré puis rajouté : plus de match ;
  - « ON L'A VU » puis « ↺ À VOIR » : le match reste ;
  - la pile : quels films (voulus par d'autres, pas par moi, pas mon BOF, « à voir » seulement, groupe seulement), dans quel ordre, au plus 30, sans doublon avec le thème.
- **Fonctionnels** (vraies actions) : un swipe d'un non-membre refusé ; `decideSwipe` qui répond « match » une seule fois ; un « ON LE VEUT » sur un film listé avec TMDB en panne qui réussit ; la restauration d'une sauvegarde avec les nouvelles colonnes.
- **E2E** (deux appareils, comme les coups de cœur) :
  - Léa garde, Hugo trouve le film dans sa pile avec « LÉA LE VEUT », le garde, et voit le tampon ;
  - le badge dans la LISTE des deux ;
  - TIRER avec « NOS MATCHS » ne sort qu'un match ;
  - « ANNULER » juste après le match ;
  - un troisième membre qui rejoint : le match reste, et le film est dans sa pile avec le tampon « MATCH » ;
  - accessibilité (axe) et débordement sur les six formats, captures de référence regardées une à une ;
  - WebKit compris.
- **Mutation** : Stryker sur les nouveaux modules purs, sans survivant non équivalent.

## 9. Laissé au builder

Les textes exacts des phrases sous la carte (même sens), le placement du tampon match sur le ticket quand le film est aussi coup de cœur, la façon d'annoncer le moment du match aux lecteurs d'écran, la forme exacte du retour de `decideSwipe`.
