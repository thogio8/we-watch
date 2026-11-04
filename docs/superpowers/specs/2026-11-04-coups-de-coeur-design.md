# WeWatch 2.1.0 · Coups de cœur

> Complète la spec 2.0 (`2026-10-28-wewatch-v2-design.md`), qui reste la référence pour tout ce qui ne change pas ici. Maquettes validées : `assets/2026-11-04-coups-de-coeur-mockup.html` (variantes retenues : **L2**, **F2**, **T2** ; la variante S1, SWIPER, est écartée).
> Idée de Becca, décisions du mainteneur du 2026-11-04. Les choix marqués *(choix du concepteur)* n'ont pas été tranchés par le mainteneur : à lui de les relire.

## 1. Pourquoi

La liste « à voir » d'un groupe s'allonge, et tous les films n'y font pas envie au même degré. Certains, on est sûrs de vouloir les voir **en priorité**. Le groupe doit pouvoir les marquer, les repérer d'un coup d'œil, et certains soirs **ne tirer que parmi eux**.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Marquer / démarquer un film « à voir » comme **coup de cœur** du groupe, depuis la LISTE et depuis la fiche.
- Les coups de cœur en tête d'« À VOIR ».
- Au tirage, un filtre « seulement nos coups de cœur ».
- Savoir qui a mis un film en coup de cœur, et quand.

**Non-objectifs**
- Pas de nombre maximal : on en marque autant qu'on veut (décision du mainteneur).
- Pas de classement fin (1er, 2e…), pas de note, pas de coups de cœur personnels : un coup de cœur est celui **du groupe**.
- Pas de pondération du tirage : c'est un **filtre**, pas des chances en plus.
- Rien dans SWIPER (décision du mainteneur : l'info n'y est pas utile).

**Anti-objectifs** (ce qui ferait rater la fonctionnalité, même si elle « marche »)
- Un marquage qui demande plus d'un tap depuis la liste.
- Une liste plus chargée pour qui ne s'en sert pas : sans aucun coup de cœur, LISTE et TIRER restent **exactement** comme en 2.0 (ni intertitre, ni ligne de filtre).
- Sortir de la DA « Ticket d'entrée » (riso fluo).

## 3. Modèle

- Un coup de cœur est un **état d'un film du groupe** (`group_movie`), pas une table à part : un film l'est ou ne l'est pas, pour tout le groupe.
- Deux colonnes nullables sur `group_movie`, migration **additive** `0012` (voir CLAUDE.md, « Migrations rétrocompatibles ») :
  - `favorite_at` (timestamp) : non nul = coup de cœur, depuis cette date ;
  - `favorite_by` (auteur, même forme que `added_by` / `watched_by` : référence vers `user`, nullable), avec un index (la suppression de compte le cherche, comme `0009`).
- `favorite_at` non nul et `favorite_by` nul = coup de cœur d'un compte supprimé (« un ancien membre »).
- Seul un film **« à voir »** peut être coup de cœur. Toute transition qui le fait quitter « à voir » efface le coup de cœur (`favorite_at` et `favorite_by` à `NULL`) : « ON L'A VU » (fiche, liste, « ON LE REGARDE » du tirage), « retirer » (✕). Un film remis « à voir » (« ↺ À VOIR », ré-ajout par la recherche ou un swipe) revient **sans** coup de cœur. Dans le code : la table `CHANGES` de `src/db/group-list.ts` (un swipe ne remet jamais un film « à voir » : `keep` ne touche pas une ligne `rejected`). Par prudence, « ↺ À VOIR » et le ré-ajout par la recherche effacent **aussi** les deux colonnes, et toute lecture ou tout compte de coups de cœur filtre sur `status = 'to_watch'` : si la fumée échoue et que la CI remet la 2.0, son code peut marquer vu un coup de cœur sans effacer `favorite_at`, et ces restes ne doivent jamais réapparaître.
- **Annuler un swipe** (`undoKeep`, `src/db/decisions.ts`) supprime la ligne du film si personne d'autre ne le veut : il ne la supprime **pas** si elle est coup de cœur (garde `favorite_at IS NULL`), pour ne pas effacer le coup de cœur qu'un autre membre vient d'y mettre.
- **Supprimer un compte** (`deleteUserIn`, `src/db/account-deletion.ts`) : `favorite_by` mis à `NULL` explicitement, comme `added_by` / `watched_by` ; le film reste coup de cœur. **Quitter un groupe** ne touche pas aux coups de cœur posés (comme les ajouts).
- **Sauvegarde / restauration** : `group_movie` est lue en entier (`*`, `scripts/backup-tables.mjs`), donc les deux colonnes y passent sans rien changer ; le prouver par un test (sauvegarde puis `restore-db`, `tests/scripts/`).

## 4. Écriture : une action serveur

- `setFavorite(groupId, tmdbId, on: boolean)` dans `src/features/list/actions.ts`, appelée par la liste et par la fiche. Un **état voulu**, pas une bascule : deux appareils qui tapent en même temps ne s'annulent pas.
- Ordre CLAUDE.md : `assertMember(groupId)`, puis validation (`tmdbId` entier positif, `on` booléen), puis une seule requête `UPDATE group_movie SET … WHERE group_id = ? AND tmdb_id = ? AND status = 'to_watch'`. Poser : `favorite_at = now`, `favorite_by = moi` **seulement s'il ne l'était pas** (re-marquer ne change ni l'auteur ni la date) ; enlever : les deux à `NULL`. Résultat `ApplyResult` (`"applied" | "noop"`) ; un film absent ou plus « à voir » donne `"noop"`, pas une exception.
- **Pas de limite de tentatives** *(choix du concepteur)* : réservée aux membres, idempotente, rien à deviner, comme `renameGroup` ; l'écrire dans la liste des actions non limitées de CLAUDE.md.
- `revalidateListPages()` après écriture (TIRER et LISTE sont gardées 5 minutes sur l'appareil).
- Ajouter l'action au méta-test `tests/functional/server-actions.test.ts` (table `ARGUMENTS`).
- Côté client : `catch` → `leaveIfRefused(error)`, puis le message générique de la liste en cas de panne (même schéma que `useListAction`). Mise à jour optimiste ou non : au builder, en restant cohérent avec les autres actions de la liste.

## 5. Lecture

- `Movie` (`src/domain/movie.ts`) gagne `favoriteAt: Date | null` et `favoriteBy: string | null` (nom résolu, comme `addedBy`).
- `listByStatus(groupId, "to_watch")` : coups de cœur d'abord, du plus récemment marqué au plus ancien, puis les autres dans l'ordre d'aujourd'hui (`decided_at` décroissant) *(choix du concepteur pour l'ordre interne des coups de cœur)*. « VUS » ne change pas.
- `counts(groupId)` gagne `favorites` (nombre de coups de cœur « à voir »).
- Attribution (`src/domain/attribution.ts`) : `favoriteLine(m)` → « coup de cœur de Becca le 4 novembre » ; compte supprimé : « coup de cœur d’un ancien membre le 4 novembre » ; `null` si pas coup de cœur. **Élision** devant une voyelle (y compris accentuée) : « coup de cœur d’Inès », avec l'apostrophe typographique `’` comme le reste de l'interface. Tests unitaires de ces cas.

## 6. Écrans

Toutes les couleurs dans `src/styles/tokens.css` (un rose pâle pour le fond de ligne y entre comme nouveau token). Les maquettes donnent l'intention, pas les pixels : tailles, espacements et ombres suivent les composants existants (`MovieRow`, `Ticket`, `Stamp`, `Chip`).

### 6.1 LISTE (variante L2)
- Onglet « À VOIR » : s'il y a au moins un coup de cœur, intertitre « ♥ COUPS DE CŒUR · n » puis leurs lignes, puis intertitre « LE RESTE · n » et les autres. Sans coup de cœur : la liste de la 2.0, sans intertitre. Si tous sont coups de cœur : pas d'intertitre « LE RESTE ». L'onglet garde son libellé « À VOIR · total ».
- Ligne coup de cœur : fond rose pâle, ombre décalée rose, et un **mini-tampon ♥** rond dans le coin bas-droit de la petite affiche (rappel du gros tampon). **Pas** de tampon au-dessus du titre (refusé par le mainteneur).
- Chaque ligne d'« À VOIR » a un bouton **♡ / ♥** juste avant le ✕ : ♡ sur fond papier = pas coup de cœur, ♥ sur fond rose = coup de cœur. Un tap bascule. Accessibilité : `aria-pressed`, nom accessible « Coup de cœur : <titre> » ; cible tactile d'au moins 44 px comme le ✕.
- Onglet « VUS » : rien ne change (un film vu n'est jamais coup de cœur).

### 6.2 Fiche d'un film (variante F2)
- Film « à voir » coup de cœur : gros tampon « ♥ COUP DE CŒUR » sur l'affiche, en bas à gauche, incliné, mots à l'encre (du rose sur le papier ne passe pas le contraste : 2,95:1) et seul le glyphe ♥ en rose, contour encre, ombre décalée.
- Film « à voir » pas coup de cœur : à la même place, un tampon **en pointillés**, semi-transparent, « ♡ COUP DE CŒUR ? ».
- Le tampon **est le bouton** : taper le fantôme marque, taper le vrai tampon démarque. Un vrai `<button>` avec `aria-pressed` et un nom accessible explicite, focus visible. Pas d'autre bouton ni de pastille dans les infos (F1 et la pastille de la v1 refusées par le mainteneur). Le mainteneur trouvait F2 moins facile à découvrir : c'est accepté, car le marquage principal reste le ♡ de la liste, toujours visible.
- Film « vu » : ni tampon ni fantôme.
- Dans « CHEZ NOUS » (`MovieFacts`, `ourHistory`), une ligne `favoriteLine` après « Voulu par… » quand le film est coup de cœur.

### 6.3 TIRER (variante T2)
- Dans le panneau « LA SOIRÉE », une première ligne « ON TIRE PARMI » avec deux puces : « TOUTE LA LISTE » / « ♥ NOS COUPS DE CŒUR · n » (la seconde, sélectionnée, en rose ; texte encre sur le rose). Elle n'apparaît que s'il y a au moins un coup de cœur parmi les films « à voir ».
- Le filtre se **cumule** avec l'heure, l'humeur et les plateformes (`filterTonight`). `TonightFilters` gagne `favoritesOnly: boolean` ; `isFiltering` le compte ; le résumé fermé du panneau (`tonightSummary`) le dit (« COUPS DE CŒUR »).
- **Pas mémorisé sur l'appareil** *(choix du concepteur)* : comme l'humeur, c'est un choix de la soirée ; `tonightStorage` ne le sauvegarde pas. Plus aucun coup de cœur (le dernier démarqué ou vu) : le filtre retombe à « TOUTE LA LISTE » et la ligne disparaît (comme `sanitizeFilters` pour une plateforme disparue).
- Filtre actif : le gros bouton rond passe au **rose** et dit « TIRER UN COUP DE CŒUR » (au lieu du jaune « TIRER UN FILM »), avec sa lueur rose. Accessibilité : contraste encre sur rose déjà validé ailleurs.
- Le sous-titre « n FILMS À REGARDER · m VU » gagne « · DONT k ♥ » quand k > 0 *(montré dans les maquettes ; au builder de le garder s'il tient sur un petit écran, sinon le laisser)*.
- **Film tiré** : son affiche porte le gros tampon « ♥ COUP DE CŒUR » dès qu'il est coup de cœur, **filtre actif ou non**. « FINI À 23H19 » garde sa place (en haut à droite). Le tampon n'est **pas** un bouton ici.
- Filtres qui ne laissent aucun film : comportement existant (rien de nouveau à concevoir).

### 6.4 SWIPER
Aucun changement.

## 7. Tests et « fini »

Selon CLAUDE.md (« Définition de fini »), notamment :
- **Unitaires** : `favoriteLine` (auteur, ancien membre, élision), `filterTonight` avec `favoritesOnly`, `isFiltering`, `tonightSummary`, le nettoyage du filtre sans coup de cœur, l'ordre de la liste et les intertitres (logique pure dans `features/list`).
- **Fonctionnels** : `setFavorite` (membre seulement, `groupId` forgé refusé avant toute lecture, idempotence, auteur et date gardés au re-marquage, `noop` sur un film vu ou absent) ; chaque transition qui quitte « à voir » efface le coup de cœur ; suppression de compte → « un ancien membre » ; sauvegarde et restauration des deux colonnes.
- **E2E** : marquer depuis la liste (le film passe en tête, sous son intertitre) ; démarquer ; marquer depuis la fiche (tampon fantôme → tampon) ; la ligne « Coup de cœur de Léa » dans « CHEZ NOUS » ; second appareil (`member`) qui voit le coup de cœur ; TIRER avec le filtre (bouton rose, seul un coup de cœur peut sortir) ; le tampon sur le film tiré sans le filtre ; « ON LE REGARDE » qui efface le coup de cœur. Accessibilité (axe) et débordements sur tous les formats, captures de référence mises à jour et **regardées**.
- Migration : `0012` passe sur une base neuve et sur une base 2.0 remplie (tests de migration existants).
- Docs : section « 2.1.0 » dans la spec v2 renvoyant ici, CLAUDE.md (colonnes, action non limitée, transitions), README (fonctionnalités).

## 8. Livraison

- Une seule pull request (branche `feat/coups-de-coeur` partie de `main` après la 2.0.3), fusionnée en `--rebase` une fois la CI verte : son commit `feat` fait publier la **2.1.0** par release-please (CLAUDE.md, « Livrer une version »).
- La migration `0012` se génère sur cette branche à jour de `main` ; si `main` reçoit une migration avant la fusion, rebaser et régénérer `0012` (CLAUDE.md, « Migrations dans l'ordre »).
- La suppression des restes d'avant les comptes (`movies`, `legacy`, `watched_legacy`, `ACCESS_CODE`) n'est **pas** dans cette version : CLAUDE.md, la spec v2 et le README la disaient en 2.1 : corrigé en « dans une version suivante » avec cette livraison.

## 9. Laissé au builder

Le découpage en composants et hooks (dans l'esprit de `features/draw/` et `features/list/`), l'optimisme de l'interface, les animations du tampon (légères, `prefers-reduced-motion` respecté), les tailles exactes des tampons selon les formats (téléphone, couché, écran large), et les noms de code.
