# « C'EST UN MATCH ! » (2.2.0) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un film gardé en swipant par tous les membres d'un groupe devient un match, acquis, visible partout et tirable à part ; la pile montre aux autres membres les films que le groupe veut déjà.

**Architecture:** deux colonnes additives (`group_movie.matched_at`, `matched_by`) posées par un `UPDATE … RETURNING` conditionnel dans la transaction du swipe ; une file « le groupe le veut » lue en base et placée en tête de la première fournée de la pile ; le texte (« voulu par », bandeau) en fonctions pures de `domain/` ; TIRER passe d'un booléen `favoritesOnly` à un choix `pool` à trois valeurs.

**Tech Stack:** Next 16 (cacheComponents), Drizzle/libSQL, Vitest + Testing Library + fast-check, Playwright (Docker), Stryker.

**Spec:** `docs/superpowers/specs/2026-11-05-c-est-un-match-design.md` (règles §3, pile §4, affichages §5, données §6, tests exigés §8). Maquettes : https://claude.ai/artifact/1YJBFsZ4qVR3oyQrYae9k6.

## Global Constraints

- Branche `feat/c-est-un-match` (partie de `origin/main`). Jamais de push sur `main` ; la PR finale est ouverte par le contrôleur.
- Commits : header Conventional Commits en anglais, sans body, sans trailer `Co-Authored-By`, sans mention d'IA. Une seule PR = une version : un seul commit `feat` visible suffit à faire la 2.2.0, les autres sont `feat`, `test`, `refactor` ou `docs` honnêtes.
- Toutes les règles de `CLAUDE.md` : couches (`domain` pur ← `db` ← `server` ← `features` ← `app`), 200 lignes par fichier, 80 par fonction, complexité 10, jscpd, knip, couverture 100 %, `npm run ci` vert avant chaque commit qui touche du code, noms de tests en français, code et commentaires en anglais, aucun `eslint-disable` ni seuil relevé.
- DA : couleurs uniquement depuis `src/styles/tokens.css` ; texte encre sur le rose ; `prefers-reduced-motion` respecté ; cibles ≥ 44 px.
- Aucune lecture puis écriture pour un match : un seul `UPDATE … WHERE … RETURNING` dans la transaction du swipe.
- Ne jamais compter sur une cascade de clé étrangère (`CLAUDE.md`, « Clés étrangères sur Turso »).
- Toute nouvelle action ou changement d'action serveur garde `assertMember` en premier ; le méta-test `tests/functional/server-actions.test.ts` doit passer.
- Ne jamais lancer `npm start`, ne jamais toucher la prod.

## Review Focus

1. **Deux derniers swipes simultanés** (deux appareils, deux membres) : un seul match, et un seul des deux reçoit `matched: true`. Test de dépôt avec deux `swipe` lancés en parallèle sur un fichier SQLite (Tâche 4).
2. **Un groupe à un seul membre** : aucun swipe ne fait jamais de match, et la file « le groupe le veut » est vide (Tâches 4 et 5).
3. **« ANNULER » après avoir quitté puis rejoint** : n'efface pas l'ancien match (`matched_at` ≠ `wanted_at` de l'envie supprimée) (Tâche 4).
4. **Un film de la file déjà décidé sur un autre appareil** pendant que la carte est à l'écran : le swipe répond `noop`, aucun match, la carte part (Tâches 4 et 7).
5. **TMDB en panne** : la file « le groupe le veut » s'affiche, et « ON LE VEUT ♥ » sur un film déjà listé réussit (Tâche 6).

---

### Tâche 1 : les colonnes du match

**Files:**
- Modify: `src/db/group-schema.ts` (`group_movie` : `matchedAt: timestamp("matched_at")`, `matchedBy: author("matched_by")`, commentaires comme `favoriteAt` / `favoriteBy`)
- Create: `drizzle/0014_<nom généré>.sql` par `npm run db:generate`, puis **à la main** : la clé étrangère `REFERENCES user(id) ON DELETE set null` sur `matched_by` (modèle exact : `drizzle/0012_favorites.sql`) et un commentaire d'en-tête « Matches (2.2.0). Additive… »
- Test: `src/db/match-migration.test.ts` (modèle : `src/db/favorite-migration.test.ts`)
- Modify: `tests/scripts/restore-db.test.ts` (`EVERY_TABLE` : une ligne `group_movie` avec `matched_at`, `matched_by` ; la restauration les garde)

**Interfaces:**
- Produces : `groupMovie.matchedAt` (`Date | null`), `groupMovie.matchedBy` (`string | null`).

- [ ] Step 1 : tests en échec : « 0014 ajoute matched_at et matched_by, nulles, sans toucher les lignes existantes » ; « supprimer l'utilisateur de matched_by le met à NULL (clé étrangère ON DELETE set null) » ; « une sauvegarde avec matched_at / matched_by se restaure à l'identique ».
- [ ] Step 2 : schéma, `npm run db:generate`, édition manuelle de la clé étrangère. Vérifier que le journal place 0014 après 0013.
- [ ] Step 3 : `npx vitest run src/db tests/scripts` vert, `npm run ci:checks` vert.
- [ ] Step 4 : commit `feat(db): add the match columns to the group list`

### Tâche 2 : les textes du match (domaine pur)

**Files:**
- Modify: `src/domain/movie.ts` : `Movie` gagne `matchedAt: Date | null` (« set when the whole group kept it; never recomputed ») et `groupSize: number` (« members of the group when read »). `ListCounts` gagne `matches: number`. Export `isMatch(m: Pick<Movie, "matchedAt">): boolean`.
- Modify: `src/domain/attribution.ts` :
  - `wantedLine(names: readonly string[], context: { groupSize: number; matched: boolean }): string | null` ;
  - `matchLine(m: Pick<Movie, "matchedAt">): string | null`, qui rend « match du groupe le 5 novembre 2026 » (`formatLongDate`) ou `null`.
- Create: `src/domain/wish-banner.ts` : `wishBanner(otherNames: readonly string[]): string | null`, qui rend :
  - « BECCA LE VEUT » ;
  - « LÉA ET HUGO LE VEULENT » ;
  - « LÉA, HUGO ET SAM LE VEULENT » ;
  - au-delà de 3 : « 9 MEMBRES LE VEULENT » ;
  - `null` pour une liste vide.

  Les prénoms passent en majuscules par `toLocaleUpperCase("fr")`. Constante exportée `MAX_NAMES = 3`, partagée avec `wantedLine`.
- Modify: `tests/helpers/movies.ts` (`aMovie` : `matchedAt: null`, `groupSize: 2`)
- Test: `src/domain/attribution.test.ts`, `src/domain/wish-banner.test.ts`, `src/domain/attribution.property.test.ts` (nouveau ; modèle : `src/domain/display-name.property.test.ts`)

**Interfaces:**
- Produces : `wantedLine` (nouvelle signature), `matchLine`, `wishBanner`, `MAX_NAMES`, `isMatch`, `Movie.matchedAt`, `Movie.groupSize`, `ListCounts.matches`.

Règles de `wantedLine`, de la spec §5 :
- aucun nom : `null` ;
- match **et** `names.length === groupSize` **et** `groupSize ≥ 2` : « voulu par vous deux » (2) ou « voulu par tout le groupe » (≥ 3) ;
- sinon `names.length ≤ 3` : les prénoms, comme aujourd'hui ;
- sinon : « voulu par K sur N ».

Cas aux bornes, un test chacun :
- 0, 1, 2, 3 et 4 prénoms ;
- tout le groupe à 2, à 3 et à 10, avec et sans match ;
- match avec un membre de plus que d'envies (« voulu par Léa et Hugo » à 3) ;
- groupe de 10 avec 9 envies et un match (« voulu par 9 sur 10 »).

Propriétés : jamais plus de `MAX_NAMES` prénoms dans le texte ; « K sur N » seulement si K > 3, avec K ≤ N ; « tout le groupe » seulement si `matched`.

- [ ] Step 1 : tests en échec (exemples et propriétés). Prouver que chaque propriété mord en cassant temporairement la règle (noter la commande et l'extrait dans le rapport).
- [ ] Step 2 : implémenter, puis adapter les appels :
  - `ListRow.tsx` et `MovieFacts.tsx` passent `{ groupSize: movie.groupSize, matched: isMatch(movie) }` ;
  - `MovieFacts` ajoute `matchLine` à ses lignes « CHEZ NOUS ».
  Les données réelles viennent à la Tâche 3 : d'ici là, `selectMovies` renvoie `matchedAt: null` et `groupSize` = le vrai compte des membres (requête d'un `count()` sur `membership` du groupe).
- [ ] Step 3 : `npm run ci:checks` vert. Commit `feat(list): word who wants a movie for groups of any size`

### Tâche 3 : lire les matchs

**Files:**
- Modify: `src/db/list-queries.ts` : `selectMovies` lit `matchedAt` (seulement si `status` ∈ « à voir », « vu » ; sinon `null`). `groupSize` est déjà lu depuis la Tâche 2 (un seul `count()` sur `membership` du groupe, jamais une requête par ligne) : ici, seulement ses tests.
- Modify: `src/db/group-list.ts` : `counts()` gagne `matches`, les films « à voir » dont `matched_at` est non nul, de ce groupe seulement.
- Test: `src/db/group-list.test.ts` (ou un fichier voisin `group-list.match.test.ts` si 200 lignes sont dépassées)

**Interfaces:**
- Consumes : Tâche 1 (colonnes), Tâche 2 (`Movie`, `ListCounts`).
- Produces : `GroupList.counts(groupId): Promise<ListCounts>` avec `matches`.

- [ ] Step 1 : tests en échec, à partir de lignes posées directement en base (l'écriture vient à la Tâche 4) :
  - `findInList` et `listByStatus` rendent `matchedAt` et `groupSize` (2, puis 3 après un `join`) ;
  - `counts().matches` ne compte que les « à voir » du groupe : un match vu ne compte pas, un match d'un autre groupe non plus.
- [ ] Step 2 : implémenter. Step 3 : `npm run ci:checks`. Commit `feat(db): read matches and the group's size with the list`

### Tâche 4 : poser et défaire un match

**Files:**
- Modify: `src/db/decisions.ts`
  - `keep` : dans la même transaction, après l'envie, un seul `UPDATE group_movie SET matched_at = <now>, matched_by = <userId> WHERE <ligne> AND status = 'to_watch' AND matched_at IS NULL AND (SELECT count(*) FROM membership WHERE group_id = ?) >= 2 AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.group_id = ? AND NOT EXISTS (SELECT 1 FROM movie_want w WHERE w.group_id = m.group_id AND w.tmdb_id = ? AND w.user_id = m.user_id)) RETURNING tmdb_id`. Le match ne se pose que si l'envie vient d'être créée : une envie déjà là (`onConflictDoNothing`) répond `noop` et ne pose rien.
  - `swipe` renvoie `SwipeOutcome = { result: ApplyResult; matched: boolean }`, exporté de `src/domain/transitions.ts`.
  - `undoKeep` : avant de supprimer mon envie, lire son `wanted_at` dans la même transaction. Si un match a `matched_by` = moi et `matched_at` = ce `wanted_at`, effacer `matched_at` et `matched_by` dans la même transaction.
  - `undoSwipe` renvoie toujours `ApplyResult`.
- Modify: `src/db/group-list.ts` : la branche « écarté puis rajouté » (`current.status === "rejected"`, qui supprime déjà les envies) efface aussi `matchedAt` / `matchedBy`, dans le même `update`.
- Modify: `src/db/account-deletion.ts` : `matched_by` mis à `NULL` explicitement, comme `favorite_by`.
- Modify: `src/db/membership.ts` : rien. Un test prouve que `leave` ne pose ni ne retire de match.
- Test: `src/db/decisions.test.ts` (ou `src/db/decisions.match.test.ts`), `src/db/account-deletion.test.ts`, `src/db/group-list.test.ts`

**Interfaces:**
- Consumes : Tâches 1 à 3.
- Produces : `Decisions.swipe(input): Promise<SwipeOutcome>`, `SwipeOutcome` dans `domain/transitions.ts`.

Tests à écrire, chacun nommé en français :
- le match se pose au swipe du dernier membre qui manque, pas avant ;
- jamais dans un groupe d'un seul membre ;
- jamais sur un film vu ou écarté ;
- swipe répété du même membre : `noop`, pas de second match ;
- **deux derniers swipes simultanés** : deux membres d'un groupe de trois, le troisième ayant déjà voulu, lancés avec `Promise.all` sur une base fichier (`aDatabase` en fichier si besoin ; les transactions SQLite se sérialisent). Un seul `matched: true`, et un seul `matched_at` en base ;
- un membre qui rejoint ne retire rien ;
- un membre qui part n'en crée pas (ses envies partent, les autres membres veulent tous, et toujours pas de match) ;
- compte supprimé : `matched_by` à `NULL`, `matched_at` intact ;
- « ANNULER » juste après le match : plus de match ;
- « ANNULER » d'un autre membre : le match reste ;
- quitter puis rejoindre, re-swiper et annuler : l'ancien match reste ;
- écarté puis rajouté par la recherche : plus de match ;
- vu puis « ↺ À VOIR » : le match reste ;
- un coup de cœur ne change rien au match, et inversement.

- [ ] Step 1 : tests en échec. Step 2 : implémenter, avec le texte SQL du `UPDATE` écrit en Drizzle (`sql`, `notExists`, `exists`), jamais en concaténation de chaînes. Step 3 : `npm run ci:checks` vert. Commit `feat(db): make a match when the last member keeps a movie`

### Tâche 5 : la file « le groupe le veut »

**Files:**
- Create: `src/db/group-wishes.ts`
  - `export const GROUP_WISHES_LIMIT = 30` ;
  - `export function createGroupWishes(db: Database): GroupWishes` avec `GroupWishes.pending(groupId: string, userId: string): Promise<WishCard[]>`.
- Modify: `src/domain/movie.ts`, qui exporte `WishCard = MovieSnapshot & { wish: { others: readonly string[]; matched: boolean } }`, où `others` sont les prénoms des autres membres qui le veulent, dans l'ordre des envies.
- Modify: `src/server/container.ts` : `getGroupWishes()`.
- Test: `src/db/group-wishes.test.ts`

Règles (spec §4) :
- films du groupe « à voir », voulus par au moins un **autre** membre, pas par moi, pas mis en BOF par moi ;
- ordre : nombre d'envies décroissant, puis envie la plus récente, puis `tmdb_id` ;
- au plus `GROUP_WISHES_LIMIT` ;
- données lues dans `movie_snapshot`, sans TMDB.

Tests, un par règle :
- un autre groupe ne fuit pas ;
- un film vu ou écarté n'y est pas ;
- un film voulu par moi n'y est pas ;
- un film mis en BOF par moi (dans n'importe quel groupe) n'y est pas ;
- un film ajouté par la recherche, sans envie, n'y est pas ;
- l'ordre, sur des égalités ;
- la limite (31 films donnent 30) ;
- seul dans le groupe : vide ;
- `matched` reflète `matched_at` ;
- `others` ne contient jamais mon prénom.

- [ ] Step 1 : tests en échec. Step 2 : implémenter, en une seule requête pour les films et une pour les prénoms (comme `wishes()` de `list-queries.ts`). Step 3 : `npm run ci:checks`. Commit `feat(db): list the movies the group wants and I have not swiped`

### Tâche 6 : les actions de la pile

**Files:**
- Modify: `src/features/swipe/deck.ts` : `DeckBatch.cards: DeckCard[]`, avec `DeckCard = MovieSnapshot & { wish?: WishCard["wish"] }`.
- Modify: `src/features/swipe/actions.ts`
  - `decideSwipe` renvoie `SwipeOutcome` ; `SendSwipe` se divise en `SendDecision` (renvoie `SwipeOutcome`) et `SendUndo` (renvoie `ApplyResult`) ;
  - « ON LE VEUT ♥ » sur un film **déjà dans la liste du groupe** lit l'instantané en base au lieu d'appeler TMDB. Ajouter `Snapshots.get(tmdbId): Promise<MovieSnapshot | null>` à `src/db/snapshots.ts` si absent ; un film inconnu en base passe toujours par TMDB ;
  - `loadMoreCards(groupId, deck, page)`, page 1 seulement : `getGroupWishes().pending(...)` en tête, puis la fournée TMDB. Si TMDB est en panne et que la file n'est pas vide, `{ ok: true, batch: { cards: file, nextPage: 1 } }`, pour que la page 1 du thème soit retentée à la prochaine fournée.
- Modify: `src/server/container.ts`, `src/app/swipe/page.tsx` (types seulement).
- Test: `src/features/swipe/actions.test.ts`, `src/features/swipe/deck.test.ts`, `tests/functional/swipe.test.ts`

Tests :
- `decideSwipe` d'un non-membre est refusé avant toute lecture ;
- `decideSwipe` répond `matched: true` une seule fois sur deux membres, en vrai (fonctionnel) ;
- « ON LE VEUT » sur un film listé avec le faux TMDB coupé réussit (fonctionnel) ;
- la page 1 met la file en tête, une page 2 ne la remet pas, et aucun film n'est en double entre la file et le thème ;
- TMDB en panne avec une file non vide : la file s'affiche ;
- TMDB en panne avec une file vide : `{ ok: false }`, comme aujourd'hui.

- [ ] Step 1 : tests en échec. Step 2 : implémenter. Step 3 : `npm run ci:checks`, dont `tests/functional/server-actions.test.ts`. Commit `feat(swipe): put the movies the group wants at the top of the deck`

### Tâche 7 : la pile à l'écran et le moment du match

**Files:**
- Modify: `src/features/swipe/deckState.ts`
  - la file accepte des `DeckCard` ;
  - nouvelle action `{ type: "matched"; card: DeckCard }` qui pose `state.match: DeckCard | null` ;
  - `{ type: "match_closed" }` le remet à `null` ;
  - un `undone` sur la carte du match le ferme aussi.
- Modify: `src/features/swipe/useSwipeSync.ts`
  - `decideCard` reçoit `SwipeOutcome` ;
  - quand `outcome.matched` est vrai, `dispatch({ type: "matched", card })`, mais seulement si cette opération est encore la dernière de la carte (même garde que `decide_failed`) ;
  - la chaîne d'annulation passe `outcome.result` à l'undo.
- Modify: `src/features/swipe/SwipeCard.tsx` (+ `.module.css`)
  - avec `card.wish`, un bandeau papier blanc à gauche de l'affiche (`wishBanner(card.wish.others)`) ;
  - si `card.wish.matched`, le petit tampon « ♥♥ MATCH » ;
  - sous la carte (`SwipeDeck`), la ligne :
    - « TU LE VEUX AUSSI ? C'EST UN MATCH. » si ce swipe peut le compléter : `!matched && others.length === groupSize - 1`. `groupSize` vient de la page : `SwipeDeck` reçoit `groupSize: number` ;
    - « LE GROUPE EN AVAIT FAIT UN MATCH AVANT TON ARRIVÉE : IL LE RESTE. » si `matched`.
- Create: `src/ui/MatchStamp.tsx` (+ `.module.css`)
  - variantes `size: "small" | "large"` ; le grand est le tampon à double bordure « C'EST UN / MATCH / ♥♥ », le petit est « ♥♥ MATCH » ;
  - les deux cœurs : `♥` rose puis `♥` bleu décalé, `aria-hidden`, avec un texte accessible « match ».
- Create: `src/features/swipe/MatchMoment.tsx` (+ `.module.css`)
  - le grand tampon, avec le rebond en CSS désactivé sous `prefers-reduced-motion` ;
  - « IL NE MANQUAIT QUE TOI », « Tout le monde le veut : il rejoint vos matchs » ;
  - les boutons « VOIR LA LISTE » (`Link` vers `/list`) et « CONTINUER ▸ » (ferme et rend le focus à la pile) ;
  - `role="dialog"`, `aria-modal`, `aria-labelledby`, focus initial sur « CONTINUER ▸ », Échap ferme.
- Modify: `src/features/swipe/SwipeDeck.tsx`, `src/app/swipe/page.tsx` (`groupSize` depuis `getGroups().membersOf(group.id)` ou un `count` dédié).
- Copie : tous les textes dans `src/features/swipe/messages.ts` (créé si absent).
- Test: `src/features/swipe/deckState.test.ts`, `src/features/swipe/SwipeDeck.test.tsx` (ou un fichier voisin `SwipeDeck.match.test.tsx`), `src/ui/MatchStamp.test.tsx`

Tests :
- bandeau et lignes selon `wish` et `groupSize` ;
- le moment s'ouvre quand le serveur dit `matched`, et pas sur une prédiction du client ;
- « CONTINUER » ferme et rend le focus ;
- Échap ferme ;
- « ANNULER » ferme le moment et défait côté serveur ;
- une réponse `matched` arrivée après une nouvelle décision sur la même carte n'ouvre rien ;
- mouvement réduit : pas d'animation (`SwipeDeck.motion.test.tsx`).

- [ ] Step 1 : tests en échec. Step 2 : implémenter (couleurs depuis `tokens.css` seulement). Step 3 : `npm run ci:checks`. Commit `feat(swipe): show who wants a movie and stamp the match`

### Tâche 8 : LISTE, fiche et ticket

**Files:**
- Modify: `src/features/list/ListRow.tsx`, qui pose le petit `MatchStamp` sur l'affiche de la ligne d'un match, dans les onglets « À VOIR » et « VUS ».
- Modify: `src/features/movie/MovieFacts.tsx`, qui porte la ligne `matchLine` (déjà branchée à la Tâche 2 : vérifier l'affichage).
- Modify: `src/features/draw/DrawResult.tsx`, qui pose le tampon « ♥♥ C'EST UN MATCH » en haut à gauche de l'affiche si `isMatch(movie)`, en plus du tampon coup de cœur, en bas à gauche, qui ne bouge pas.
- Test: `src/features/list/ListScreen.test.tsx`, `src/features/movie/MovieScreen.test.tsx`, `src/features/draw/DrawScreen.test.tsx`

- [ ] Step 1 : tests en échec :
  - badge présent ou absent ;
  - « voulu par vous deux » sur un match à deux ;
  - « voulu par 9 sur 10 » à côté du badge ;
  - ligne de la fiche ;
  - les deux tampons sur le ticket d'un film coup de cœur et match.
- [ ] Step 2 : implémenter. Step 3 : `npm run ci:checks`. Commit `feat(list): stamp matches in the list, the movie page and the ticket`

### Tâche 9 : TIRER parmi les matchs

**Files:**
- Modify: `src/domain/tonight.ts`
  - `TonightFilters.favoritesOnly: boolean` devient `pool: TonightPool`, avec `TonightPool = "all" | "favorites" | "matches"`, jamais stocké ;
  - `TonightMovie` gagne `matchedAt` ;
  - `sanitizeFilters` remet `pool` à `"all"` quand son choix n'a plus d'objet ;
  - `isFiltering` et `filterTonight` suivent.
- Modify: `src/features/draw/drawView.ts`
  - `drawButton` dit « TIRER UN MATCH » avec `pool === "matches"` et rien d'autre ;
  - le ton est jaune et lumineux pour les matchs, rose pour les coups de cœur (inchangé) ;
  - `homeCounts` affiche « dont n matchs » (« dont 1 match ») après « dont n ♥ », et seulement si n > 0.
- Modify: `src/features/draw/TonightPanel.tsx`
  - trois puces « TOUTE LA LISTE », « ♥ NOS COUPS DE CŒUR · n », « ♥♥ NOS MATCHS · n » ;
  - une puce sans objet n'apparaît pas ;
  - le groupe de puces entier n'apparaît que si au moins un des deux filtres a un objet.
- Modify: `src/features/draw/tonightSummary.ts` (« NOS MATCHS »), `DrawSessionProvider.tsx`, `tonightStorage.ts` (le stockage ignore toujours `pool` ; un ancien `favoritesOnly` stocké reste ignoré).
- Test: `src/domain/tonight.test.ts`, `src/domain/tonight.property.test.ts` (adapter la propriété « filtrer n'ajoute jamais de film » à `pool`), `src/features/draw/drawView.test.ts`, `src/features/draw/DrawScreen.test.tsx`, `src/features/draw/tonightStorage.test.ts`

- [ ] Step 1 : tests en échec :
  - les trois choix, combinés aux autres filtres ;
  - un choix sans objet qui retombe à « TOUTE LA LISTE » ;
  - jamais stocké ;
  - texte et ton du bouton ;
  - singulier et pluriel du décompte.
- [ ] Step 2 : implémenter, en renommant `favoritesOnly` partout (aucune trace dans `src`). Step 3 : `npm run ci:checks`. Commit `feat(draw): draw among the group's matches`

### Tâche 10 : bout en bout, captures et documentation

**Files:**
- Create: `e2e/match.spec.ts` (modèle : `e2e/favorites.spec.ts` ; fixtures `app`, `member`, `outsider`). Helpers éventuels dans `e2e/fixtures.ts` ou un `e2e/match.ts`.
- Modify: `e2e/visual.spec.ts`, avec les nouvelles captures :
  - la pile avec bandeau ;
  - le moment du match ;
  - la LISTE avec badges ;
  - TIRER avec « NOS MATCHS » ;
  - le ticket d'un match ;
  - la pile d'un nouveau membre sur un match ;
  - les références générées puis **regardées une à une** (lister dans le rapport ce qui a été regardé).
- Modify: `e2e/layout.spec.ts` (débordement et axe sur la pile avec bandeau, le moment du match, TIRER avec trois puces, sur les six formats).
- Modify: `CLAUDE.md`
  - le paragraphe des intentions ;
  - « Migrations rétrocompatibles », avec 0014, la clé étrangère écrite à la main et la limite connue du retour arrière vers la 2.1 ;
  - les règles du match et de la file ;
  - `pool` jamais stocké.
- Modify: `docs/superpowers/specs/2026-10-28-wewatch-v2-design.md` : une section §18 « 2.2.0 · C'est un match » qui pointe vers la spec.
- Modify: `docs/coverage.md`, en régénérant le tableau comme dans la PR #32.

Scénarios e2e (spec §8), tous avec WebKit, sauf ceux qui utilisent une passkey :
- Léa garde un film ; Hugo, sur un second appareil, le trouve en tête de sa pile avec « LÉA LE VEUT », le garde et voit le moment du match. « CONTINUER » le ferme ;
- les deux voient le badge dans la LISTE ;
- TIRER avec « NOS MATCHS » ne sort que le match ;
- « ANNULER » juste après le match retire le badge ;
- Sam rejoint par le lien : le match reste, et Sam trouve le film dans sa pile avec le petit tampon et la phrase du nouveau membre.

- [ ] Step 1 : écrire les scénarios et les captures. `npm run test:e2e`, tout vert sur les trois projets. Mettre à jour les captures avec `npm run test:e2e -- --update-snapshots`, puis regarder chaque image.
- [ ] Step 2 : documentation. Step 3 : `npm run ci` complet vert.
- [ ] Step 4 : `npx stryker run --mutate` sur les fichiers purs nouveaux ou changés (`src/domain/attribution.ts`, `src/domain/wish-banner.ts`, `src/domain/tonight.ts`, `src/features/draw/drawView.ts`, `src/features/swipe/deckState.ts`), avec `--incrementalFile` dans un dossier temporaire. Aucun survivant non équivalent : tuer les autres, et lister les équivalents avec leur raison.
- [ ] Step 5 : commits `test(e2e): cover the match journeys, layout and accessibility`, `test(e2e): add the match reference captures`, `docs: describe the 2.2.0 matches`.
