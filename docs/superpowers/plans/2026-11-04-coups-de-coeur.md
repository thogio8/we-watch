# Coups de cœur (2.1.0) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un groupe peut marquer un film « à voir » comme **coup de cœur** (un tap depuis la LISTE, ou le tampon de la fiche), le retrouve en tête d'« À VOIR » sous son intertitre, lit « coup de cœur de Becca le 4 novembre 2026 » dans « CHEZ NOUS », et peut, au tirage, ne tirer que parmi ses coups de cœur. Sans aucun coup de cœur, LISTE et TIRER restent exactement ceux de la 2.0.

**Architecture:** deux colonnes nullables sur `group_movie` (`favorite_at`, `favorite_by`, migration additive `0012`), lues par `selectMovies` (masquées hors « à voir ») et écrites par un petit dépôt `db/favorites.ts` (un seul `UPDATE` conditionnel, état voulu). Les transitions qui quittent ou retrouvent « à voir » effacent les colonnes (table `CHANGES`). Une action serveur `setFavorite` (réservée aux membres, non limitée). Côté écrans : une logique pure par écran (`toWatchSections`, `favoritesOnly` dans `domain/tonight.ts`, `drawButton` / `homeCounts` dans `drawView.ts`), des composants d'affichage, un tampon partagé dans `ui/`.

**Tech Stack:** Next 16 (App Router, Server Actions, `cacheComponents`), Drizzle + libSQL (SQLite / Turso), Vitest + Testing Library, Playwright (Docker) + axe.

**Spec:** `docs/superpowers/specs/2026-11-04-coups-de-coeur-design.md` (maquette : `docs/superpowers/specs/assets/2026-11-04-coups-de-coeur-mockup.html`, variantes **L2**, **F2**, **T2** ; rien dans SWIPER).

## Contraintes globales

- Branche `feat/coups-de-coeur` (déjà créée depuis `main`). Une seule PR, fusionnée par le contrôleur en `gh pr merge --rebase` une fois la CI verte. Jamais de push sur `main`, jamais `npm start` (prod), jamais `git stash` nu.
- Commits : header Conventional Commits seul, en anglais, **sans body ni trailer `Co-Authored-By`**, sans mention d'un outil d'IA. `feat` pour les trois écrans visibles (LISTE, fiche, TIRER) : ce sont eux qui font publier la 2.1.0 ; `chore` pour la plomberie invisible (schéma, domaine, base, action), `test` pour l'e2e et les captures, `docs` pour la doc.
- Migration **additive** `0012`, générée par `npm run db:generate -- --name favorites` après modif de `src/db/group-schema.ts` : deux `ALTER TABLE … ADD` et un `CREATE INDEX`, rien d'autre (ni `DROP`, ni table `__new_`, ni `PRAGMA`). Si `main` reçoit une migration avant la fusion : rebaser et régénérer `0012`.
- `favorite_at` (timestamp ms, nullable) : non nul = coup de cœur. `favorite_by` = `author("favorite_by")` (référence `user.id`, `onDelete: "set null"`, nullable), avec l'index `group_movie_favorite_by_idx`.
- **Seul un film `status = 'to_watch'` est coup de cœur** : toute lecture (`favoriteAt` / `favoriteBy` de `Movie`), tout ordre et tout compte filtrent sur `status = 'to_watch'`, même si les colonnes sont restées remplies (retour arrière de la CI vers la 2.0).
- Ne jamais compter sur une cascade : `deleteUserIn` met `favorite_by` à `NULL` explicitement.
- `setFavorite` : `assertMember(groupId)` puis validation (`tmdbId` entier positif, `on` booléen), puis l'écriture, puis `revalidateListPages()`. **Pas de `withinLimit`** (choix du concepteur : réservée aux membres, idempotente, rien à deviner) ; à écrire dans la liste des actions non limitées de `CLAUDE.md`. Résultat `ApplyResult` (`"applied" | "noop"`), jamais une exception pour un film absent ou plus « à voir ».
- Côté client, chaque `catch` d'action appelle `leaveIfRefused(error)` puis affiche le message générique de l'écran (`PAS RÉUSSI À ENREGISTRER, RÉESSAIE` sur la LISTE, `PAS RÉUSSI, RÉESSAIE` sur la fiche). Pas de mise à jour optimiste : comme ✕, la ligne est « en cours » (`useTransition`) jusqu'au nouveau rendu.
- Couleurs, ombres et lueurs **uniquement** dans `src/styles/tokens.css` (nouveaux tokens : `--pink-pale: #ffe1f0`, `--shadow-offset-pink: 4px 4px 0 var(--pink)`, `--glow-pink-lg: 0 0 60px rgba(255, 63, 164, 0.9)`).
- Contraste : texte encre (`--on-pink`) sur le rose ; **jamais de mots en rose sur le papier** (2,95:1, sous le 3:1 d'axe même en gros caractères) : dans un tampon, seul le glyphe ♥ est rose, dans son propre `<span aria-hidden="true">`, les mots restent à l'encre.
- Typographie française : apostrophe `’`, espace insécable `\u00A0` avant `:` `?` `;` et à l'intérieur de « ». Libellés exacts : `♥ COUPS DE CŒUR · n`, `LE RESTE · n`, `♥ COUP DE CŒUR`, `♡ COUP DE CŒUR\u00A0?`, `Coup de cœur\u00A0: <titre>` (nom accessible des boutons), `ON TIRE PARMI`, `TOUTE LA LISTE`, `♥ NOS COUPS DE CŒUR · n`, `TIRER UN COUP DE CŒUR`, `COUPS DE CŒUR` (résumé du panneau), `dont k ♥`.
- `revalidateListPages()` après toute écriture ; aucune action ne lit le cookie `ww_group` (la page lie `setFavorite.bind(null, groupId)`).
- Règles ESLint (200 lignes par fichier de `src`, 80 par fonction, complexité 10, 4 paramètres), jscpd, knip, couverture 100 % : découper plutôt que contourner. Noms de tests en français, code et commentaires en anglais. Caractères invisibles bruts interdits (écrire `\u00A0`).
- Chaque tâche finit sur `npm run ci:checks` vert ; les tâches e2e sur `npm run ci` vert.
- Limite connue, acceptée : si la CI remet la 2.0 et que la 2.0 marque vu puis remet « à voir » un coup de cœur, la ligne revient « à voir » avec ses anciennes colonnes et réapparaît coup de cœur une fois la 2.1 revenue. Rien à coder ; le dire dans la PR.

## Points d'attention de la revue

1. **Prénoms qui commencent par une voyelle, sous toutes leurs formes** : l'élision « d’ » doit couvrir minuscule (`émilie`), majuscule accentuée (`Émile`, `Île`), ligatures (`Œdipe`, `Æsa`), forme décomposée NFD (`E\u0301mile`) et « un ancien membre » ; elle ne doit **pas** toucher `Hugo`, `Yasmine`, un chiffre ou un emoji en tête (`🎬 Léa`). Épinglé par la tâche 2.
2. **Colonnes restées remplies sur une ligne qui n'est plus « à voir »** (retour arrière vers la 2.0, ou bug) : une ligne `watched` ou `rejected` avec `favorite_at` non nul ne doit ni ressortir coup de cœur sur la fiche, ni compter dans `counts().favorites`, ni remonter dans l'ordre ; « ↺ À VOIR » et le ré-ajout par la recherche doivent la ramener sans coup de cœur. Épinglé par les tâches 3 et 4.
3. **Appels concurrents, répétés ou forgés de `setFavorite`** : double tap, deux appareils qui posent en même temps (le premier auteur et sa date restent), démarquer un film déjà démarqué, marquer un film qu'un autre vient de passer « vu » ou de retirer, `on` venu du réseau sous une autre forme (`"true"`, `1`, `null`, absent), `groupId` d'un autre groupe. Épinglé par les tâches 4 et 5.
4. **Petits écrans et titres longs** : deux boutons (♡/♥ et ✕) plus un titre long (« Le Fabuleux Destin d'Amélie Poulain ») sur 320 px ; le tampon de la fiche et du film tiré sur une affiche écrasée (`clamp(120px, …)` de TIRER, téléphone couché, ticket couché du grand écran) sans recouvrir « FINI À » ; le bouton rose de TIRER qui doit rester visible sans défiler. Épinglé par les tâches 6, 7, 9 et 10.
5. **Le filtre « coups de cœur » qui perd son objet** : le dernier coup de cœur démarqué ou vu (sur un autre appareil) pendant que le filtre est actif, un changement de groupe, une ancienne valeur `favoritesOnly: true` trouvée dans `localStorage`, un filtre cumulé qui ne laisse aucun film (« ENLEVER LES FILTRES » doit aussi le remettre à « TOUTE LA LISTE »), un film tiré qui cesse d'être coup de cœur pendant qu'il est affiché. Épinglé par les tâches 8 et 9.

---

### Tâche 1 : colonnes, migration `0012` et sauvegarde

**Files:**

- Modify: `src/db/group-schema.ts`
- Create: `drizzle/0012_favorites.sql` (généré), `drizzle/meta/0012_snapshot.json` (généré), `drizzle/meta/_journal.json` (généré)
- Create: `src/db/favorite-migration.test.ts`
- Modify: `tests/helpers/migrations.ts` (extraire `migrationsUpTo`), `src/db/legacy-migration.test.ts` (s'en servir à la place de `migrationsBeforeGroups`, sinon jscpd)
- Modify: `tests/scripts/restore-db.test.ts` (`EVERY_TABLE`)

**Interfaces:**

- Produces : `groupMovie.favoriteAt` (`timestamp("favorite_at")`, `Date | null`), `groupMovie.favoriteBy` (`author("favorite_by")`, `string | null`), index `group_movie_favorite_by_idx` sur `favorite_by`.
- Produces : `migrationsUpTo(dir: string, count: number): string` dans `tests/helpers/migrations.ts` : copie `drizzle/` dans `dir` avec un journal arrêté aux `count` premières migrations, et renvoie le dossier.

- [ ] **Step 1 : tests en échec** dans `src/db/favorite-migration.test.ts` (`describe("migration des coups de cœur")`) :

```ts
const favorites = migrationTag("0012");

it("vient juste après celle qui rejoue l’ancienne liste", () => {
  expect(migrationTags.indexOf(favorites)).toBe(12);
});

it("ne fait qu’ajouter deux colonnes et un index", () => {
  const statements = statementsOf(favorites);
  expect(statements).toHaveLength(3);
  expect(statements[0]).toBe(
    "ALTER TABLE `group_movie` ADD `favorite_at` integer;",
  );
  expect(statements[1]).toMatch(
    /^ALTER TABLE `group_movie` ADD `favorite_by` text REFERENCES/,
  );
  expect(statements[2]).toBe(
    "CREATE INDEX `group_movie_favorite_by_idx` ON `group_movie` (`favorite_by`);",
  );
  expect(statements.join(" ")).not.toMatch(/\b(DROP|PRAGMA)\b|__new_/i);
});

it("favorite_by désigne un utilisateur, mis à NULL à sa suppression", async () => {
  const db = await aDatabase();
  const keys = await db.all<{ from: string; table: string; on_delete: string }>(
    sql`SELECT "from", "table", on_delete FROM pragma_foreign_key_list('group_movie') WHERE "from" = 'favorite_by'`,
  );
  expect(keys).toEqual([
    { from: "favorite_by", table: "user", on_delete: "SET NULL" },
  ]);
});

it("sur une base 2.0 remplie : chaque ligne reste, sans coup de cœur", async () => {
  // migrate(…, migrationsUpTo(dir, 12)), insérer user, movie_snapshot,
  // app_group, membership, deux group_movie (to_watch et watched), puis
  // migrate(…, "drizzle") : mêmes lignes, favorite_at et favorite_by à null.
});
```

Dans `tests/scripts/restore-db.test.ts`, l'insert `group_movie` de `EVERY_TABLE` gagne une seconde ligne « à voir » coup de cœur : `('nous-deux', 129, 'to_watch', 4, NULL, 'u-1', 'search', 0, 0, 8, 'u-1')` sur les colonnes `…, favorite_at, favorite_by` (et l'instantané 129 dans `movie_snapshot`) ; le test « dans une base neuve migrée : les mêmes lignes, table par table » prouve alors que la sauvegarde puis `restore-db` gardent les deux colonnes.

- [ ] **Step 2 :** `npx vitest run src/db/favorite-migration.test.ts tests/scripts/restore-db.test.ts`. Attendu : échec (`migrationTag("0012")` vide ; colonne `favorite_at` inconnue).
- [ ] **Step 3 :** ajouter les deux colonnes et l'index à `groupMovie` (même commentaire que les autres index d'auteur : la suppression de compte le cherche), puis `npm run db:generate -- --name favorites`. Si drizzle-kit propose de recréer la table au lieu de deux `ALTER TABLE … ADD`, garder le snapshot généré mais réécrire `drizzle/0012_favorites.sql` à la main avec les trois instructions attendues. Ajouter en tête du SQL un commentaire comme `0009` (« Favourites (2.1.0). Additive: older code ignores them. »). Extraire `migrationsUpTo` et l'utiliser dans `legacy-migration.test.ts`. `scripts/backup-tables.mjs` ne change pas (`group_movie: "*"`).
- [ ] **Step 4 :** `npx vitest run src/db tests/scripts`, puis `npm run ci:checks`. Attendu : vert.
- [ ] **Step 5 : commit** `chore(db): add the favourite columns to the group list (migration 0012)`

### Tâche 2 : domaine (le film coup de cœur, `favoriteLine` et l'élision)

**Files:**

- Modify: `src/domain/movie.ts`, `src/domain/attribution.ts`, `src/db/list-queries.ts` (lire les deux colonnes telles quelles, pour que tout compile)
- Test: `src/domain/attribution.test.ts`
- Modify: `tests/helpers/movies.ts` (`aMovie` : `favoriteAt: null`, `favoriteBy: null`)

**Interfaces:**

- Produces (`src/domain/movie.ts`) : `Movie.favoriteAt: Date | null` (non nul seulement pour un film « à voir ») ; `Movie.favoriteBy: string | null` (prénom résolu ; `null` avec `favoriteAt` non nul = compte supprimé) ; `isFavorite(m: Pick<Movie, "favoriteAt">): boolean` ; `interface ListCounts { toWatch: number; watched: number; favorites: number }`.
- Produces (`src/domain/attribution.ts`) : `favoriteLine(m: Pick<Movie, "favoriteAt" | "favoriteBy">): string | null`.

- [ ] **Step 1 : tests en échec** (`describe("favoriteLine")`, `NOV_4 = new Date("2026-11-04T10:00:00Z")`) :

```ts
it("ne dit rien si le film n’est pas coup de cœur", () => {
  expect(favoriteLine({ favoriteAt: null, favoriteBy: null })).toBeNull();
});

it("nomme qui l’a mis en coup de cœur, et quand", () => {
  expect(favoriteLine({ favoriteAt: NOV_4, favoriteBy: "Becca" })).toBe(
    "coup de cœur de Becca le 4 novembre 2026",
  );
});

it("parle d’un ancien membre quand le compte est supprimé", () => {
  expect(favoriteLine({ favoriteAt: NOV_4, favoriteBy: null })).toBe(
    "coup de cœur d’un ancien membre le 4 novembre 2026",
  );
});

it.each([
  ["Inès", "d’Inès"],
  ["émilie", "d’émilie"],
  ["Émile", "d’Émile"],
  ["Île", "d’Île"],
  ["Œdipe", "d’Œdipe"],
  ["Æsa", "d’Æsa"],
  ["E\u0301mile", "d’E\u0301mile"],
  ["Ugo", "d’Ugo"],
])("élide devant une voyelle : %s", (name, of) => {
  expect(favoriteLine({ favoriteAt: NOV_4, favoriteBy: name })).toBe(
    `coup de cœur ${of} le 4 novembre 2026`,
  );
});

it.each(["Hugo", "Yasmine", "🎬 Léa", "2Pac"])(
  "n’élide pas devant %s",
  (name) => {
    expect(favoriteLine({ favoriteAt: NOV_4, favoriteBy: name })).toBe(
      `coup de cœur de ${name} le 4 novembre 2026`,
    );
  },
);

it("isFavorite suit favoriteAt", () => {
  expect(isFavorite({ favoriteAt: NOV_4 })).toBe(true);
  expect(isFavorite({ favoriteAt: null })).toBe(false);
});
```

- [ ] **Step 2 :** `npx vitest run src/domain/attribution.test.ts`. Attendu : échec (`favoriteLine` n'existe pas).
- [ ] **Step 3 :** implémenter. La date passe par `formatLongDate` (comme `addedLine` : « 4 novembre 2026 », année comprise). L'élision est une fonction privée d'`attribution.ts` qui teste la première lettre contre `/^[aeiouàâäéèêëîïôöùûüœæ]/iu` (le `h` et le `y` n'élident pas, choix du concepteur) et renvoie `d’` (U+2019) ou `de `. `aMovie` gagne les deux champs à `null`. Pour que tout compile, `selectMovies` lit déjà `favoriteAt: groupMovie.favoriteAt` et `favoriteBy: favoriter.name` (nouvel alias `favoriter` de `user`, jointure gauche sur `favorite_by`), telles quelles : le masque hors « à voir », l'ordre et le compte viennent en tâche 3. Corriger les fixtures de test que le type `Movie` signale.
- [ ] **Step 4 :** `npx vitest run src/domain`, puis `npm run ci:checks`. Attendu : vert.
- [ ] **Step 5 : commit** `chore(domain): describe a group's favourite and who marked it`

### Tâche 3 : lecture en base (ordre, masque hors « à voir », comptes)

**Files:**

- Modify: `src/db/list-queries.ts` (`selectMovies`), `src/db/group-list.ts` (`listByStatus`, `counts`, interface `GroupList`)
- Test: `src/db/group-list.test.ts`

**Interfaces:**

- Consumes : `groupMovie.favoriteAt` / `favoriteBy` (tâche 1), `Movie.favoriteAt` / `favoriteBy`, `ListCounts` (tâche 2).
- Produces : `selectMovies` (qui lit déjà les deux colonnes depuis la tâche 2) les renvoie à `null` quand `status !== "to_watch"`. `GroupList.listByStatus(groupId, "to_watch")` : coups de cœur d'abord, `favorite_at` décroissant, puis les autres en `decided_at` décroissant ; `"watched"` inchangé. `GroupList.counts(groupId): Promise<ListCounts>`.

- [ ] **Step 1 : tests en échec** dans `group-list.test.ts`, avec un helper local qui écrit les colonnes directement (le dépôt d'écriture vient en tâche 4) : `const favorite = (tmdbId, userId: string | null, at: Date, groupId = groupA) => db.update(groupMovie).set({ favoriteAt: at, favoriteBy: userId }).where(and(eq(groupMovie.groupId, groupId), eq(groupMovie.tmdbId, tmdbId)))`.

```ts
it("listByStatus met les coups de cœur en tête, le plus récent d’abord, puis le reste par date", async () => {
  // T3 = new Date(2026, 9, 4), à ajouter aux dates du fichier.
  await keep(1, groupA, lea, T0);
  await keep(2, groupA, lea, T1);
  await keep(3, groupA, lea, T2);
  await keep(4, groupA, lea, T3);
  await favorite(1, hugo, T3);
  await favorite(2, lea, T2);

  const movies = await list.listByStatus(groupA, "to_watch");
  // Favourites by the date they were marked, not the date they were added.
  expect(movies.map((m) => m.tmdbId)).toEqual([1, 2, 4, 3]);
  expect(movies[0]).toMatchObject({ favoriteAt: T3, favoriteBy: "Hugo" });
  expect(movies[2]).toMatchObject({ favoriteAt: null, favoriteBy: null });
});

it("un film vu ou écarté n’est jamais coup de cœur, même si ses colonnes sont restées remplies", async () => {
  // 1 marqué coup de cœur puis passé watched par une écriture directe
  // (ce que ferait la 2.0) ; 2 idem puis rejected.
  expect(await list.findInList(groupA, 1)).toMatchObject({
    status: "watched",
    favoriteAt: null,
    favoriteBy: null,
  });
  expect((await list.counts(groupA)).favorites).toBe(0);
});

it("counts compte les coups de cœur à voir du groupe seulement", async () => {
  // 2 à voir dont 1 coup de cœur dans A, 1 coup de cœur dans B
  expect(await list.counts(groupA)).toEqual({
    toWatch: 2,
    watched: 0,
    favorites: 1,
  });
});

it("coup de cœur d’un compte supprimé : la date reste, sans prénom", async () => {
  // favorite(1, hugo, T1), puis suppression de la ligne user de Hugo
  // (FK set null, comme le test d’attribution existant)
  expect(await list.findInList(groupA, 1)).toMatchObject({
    favoriteAt: T1,
    favoriteBy: null,
  });
});
```

Mettre à jour le test existant « counts compte les films à voir et vus du groupe seulement » (`favorites: 0`).

- [ ] **Step 2 :** `npx vitest run src/db/group-list.test.ts`. Attendu : échec (ordre `[4, 3, 2, 1]`, `favorites` absent).
- [ ] **Step 3 :** implémenter. Masque : dans le `map` final de `selectMovies` (`row.status === "to_watch" ? … : null`). Ordre : ``[sql`${groupMovie.favoriteAt} IS NULL`, desc(groupMovie.favoriteAt), desc(groupMovie.decidedAt)]`` pour `to_watch` seulement. Compte : `count(groupMovie.favoriteAt)` (ne compte que les non nuls) dans la requête groupée par statut, lu sur la ligne `to_watch`. Mettre à jour le commentaire de `listByStatus` dans l'interface.
- [ ] **Step 4 :** `npx vitest run src/db`, puis `npm run ci:checks`. Attendu : vert (les appelants de `counts` compilent : `ListCounts` est un sur-ensemble).
- [ ] **Step 5 : commit** `chore(db): read favourites first, only while to watch`

### Tâche 4 : écriture en base (poser, enlever, effacer, annuler un swipe, supprimer un compte)

**Files:**

- Create: `src/db/favorites.ts`, `src/db/favorites.test.ts`
- Modify: `src/db/group-list.ts` (`CHANGES`), `src/db/decisions.ts` (`undoKeep`), `src/db/account-deletion.ts`
- Test: `src/db/group-list.test.ts`, `src/db/decisions.test.ts`, `src/db/account-deletion.test.ts` (`withoutLea`, `leasRows`), `src/db/membership.test.ts`

**Interfaces:**

- Produces (`src/db/favorites.ts`) :

```ts
export interface FavoriteInput {
  groupId: string;
  userId: string;
  tmdbId: number;
  /** The wanted state, not a toggle: two devices never cancel each other. */
  on: boolean;
  now?: Date;
}
export interface Favorites {
  set(input: FavoriteInput): Promise<ApplyResult>;
}
export function createFavorites(db: Database): Favorites;
```

- Produces : `CHANGES.mark_watched`, `CHANGES.remove`, `CHANGES.unwatch` et `CHANGES.search_add` écrivent `favoriteAt: null, favoriteBy: null` ; `undoKeep` ne supprime plus une ligne coup de cœur (`isNull(groupMovie.favoriteAt)`) ; `deleteUserIn` met `favorite_by` à `NULL` pour cet utilisateur.

- [ ] **Step 1 : tests en échec.** `src/db/favorites.test.ts` (`describe("coups de cœur en base")`, Léa et Hugo membres de A, Léa seule dans B) :

```ts
it("poser : coup de cœur de qui l’a posé, à cette date", async () => {
  expect(await favorites.set({ groupId: A, userId: lea, tmdbId: 1, on: true, now: T1 })).toBe("applied");
  expect(await list.findInList(A, 1)).toMatchObject({ favoriteAt: T1, favoriteBy: "Léa" });
});

it("re-poser, même par un autre : noop, l’auteur et la date restent", async () => {
  // Léa pose à T1, Hugo pose à T2
  expect(await favorites.set({ groupId: A, userId: hugo, tmdbId: 1, on: true, now: T2 })).toBe("noop");
  expect(await list.findInList(A, 1)).toMatchObject({ favoriteAt: T1, favoriteBy: "Léa" });
});

it("enlever efface les deux colonnes ; enlever encore : noop", async () => {
  // …on: false → "applied", favoriteAt null ; de nouveau → "noop"
});

it("un film vu, écarté, absent ou d’un autre groupe : noop, rien n’est écrit", async () => {
  // allRows(db) identique avant et après, pour (A, vu), (A, écarté), (A, 999), (B, film de A)
});

it("deux poses simultanées : une seule « applied », un seul auteur", async () => {
  const results = await Promise.all([
    favorites.set({ groupId: A, userId: lea, tmdbId: 1, on: true, now: T1 }),
    favorites.set({ groupId: A, userId: hugo, tmdbId: 1, on: true, now: T2 }),
  ]);
  expect(results.toSorted()).toEqual(["applied", "noop"]);
});
```

Dans `group-list.test.ts` : `it.each(["mark_watched", "remove"])("%s efface le coup de cœur", …)` (colonnes brutes à `null`, lues par `db.select().from(groupMovie)`) ; « unwatch ramène le film à voir sans coup de cœur, même si les colonnes étaient restées remplies » (colonnes posées à la main sur une ligne `watched`) ; « search_add d’un film écarté le remet à voir sans coup de cœur » (idem sur une ligne `rejected`).

Dans `decisions.test.ts` (`describe("annuler un swipe")`) : « annulation par Léa d’un film qu’elle seule a voulu, mais qu’Hugo vient de mettre en coup de cœur : la ligne reste, coup de cœur compris ».

Dans `account-deletion.test.ts` : « membre parmi d’autres : ses coups de cœur restent, attribués à un ancien membre » (`favoriteAt` gardé, `favoriteBy` null) ; `withoutLea` gagne `favorite_by: formerMember(row.favorite_by)` et `leasRows().movies` cherche aussi `eq(groupMovie.favoriteBy, userId)`, avec un coup de cœur de Léa dans les données partagées pour que « toute la base est identique avant et après, Léa en moins » le couvre.

Dans `membership.test.ts` : « le partant laisse ses coups de cœur au groupe, avec son prénom ».

- [ ] **Step 2 :** `npx vitest run src/db`. Attendu : échec (module `./favorites` absent, colonnes non effacées, ligne d'annulation supprimée, `favorite_by` encore égal à Léa).
- [ ] **Step 3 :** implémenter. `set` est **une seule** requête : `UPDATE group_movie SET favorite_at = ?, favorite_by = ? WHERE listRow AND status = 'to_watch' AND favorite_at IS NULL … RETURNING` pour poser, `SET favorite_at = NULL, favorite_by = NULL WHERE listRow AND favorite_at IS NOT NULL … RETURNING` pour enlever (sans condition de statut : enlever des restes ne fait pas de mal), puis `changed(rows)`. `deleteUserIn` : un `update(groupMovie).set({ favoriteBy: null }).where(eq(groupMovie.favoriteBy, userId))` à côté des deux autres ; mettre à jour sa JSDoc. Rien à changer dans `leaveIn`.
- [ ] **Step 4 :** `npx vitest run src/db`, puis `npm run ci:checks`. Attendu : vert, `favorites.ts` à 100 %.
- [ ] **Step 5 : commit** `chore(db): mark and clear a group's favourites`

### Tâche 5 : l'action serveur `setFavorite`

**Files:**

- Modify: `src/server/validate.ts`, `src/server/validate.test.ts`
- Modify: `src/server/container.ts` (`getFavorites`)
- Modify: `src/features/list/actions.ts`, `src/features/list/actions.test.ts`
- Modify: `tests/functional/server-actions.test.ts` (`ARGUMENTS`), `tests/functional/isolation.test.ts` (`ACTIONS`)
- Create: `tests/functional/favorites.test.ts`

**Interfaces:**

- Consumes : `createFavorites`, `Favorites` (tâche 4).
- Produces : `assertBoolean(action: string, name: string, value: unknown): asserts value is boolean` (message `${action}: invalid ${name}`) ; `getFavorites(): Favorites` ; `setFavorite(groupId: string, tmdbId: number, on: boolean): Promise<ApplyResult>` (`"use server"`, `src/features/list/actions.ts`).

- [ ] **Step 1 : tests en échec.**
  - `validate.test.ts` : « assertBoolean n’accepte que true et false » (`true`, `false` passent ; `"true"`, `1`, `0`, `null`, `undefined` lèvent `setFavorite: invalid on`).
  - `actions.test.ts` (mock `getFavorites: () => ({ set })`) : « setFavorite vérifie l’appartenance avant tout » (`expectRefusedFirst`, comme les autres actions) ; « setFavorite pose l’état voulu, pour moi, puis rafraîchit TIRER et LISTE » (`set` appelé une fois avec `{ groupId: GROUP, userId: "user-1", tmdbId: 129, on: true }`, `revalidateListPages` appelé, résultat `"applied"` renvoyé) ; « setFavorite refuse un tmdbId ou un on invalide sans rien écrire » (`set` jamais appelé pour `(GROUP, 0, true)`, `(GROUP, 129, "true")`).
  - `server-actions.test.ts` : `"features/list/actions.ts#setFavorite": () => [groupId, 550, true]`.
  - `isolation.test.ts` : `["setFavorite", (g: string) => setFavorite(g, PARASITE, true)]`.
  - `tests/functional/favorites.test.ts` (`withLeasGroup()`, `vi.mock("@/server/session")`, `vi.mock("next/cache")`) :

```ts
it("marquer depuis la liste : le film passe en tête, coup de cœur de Léa", async () => {
  await addFromSearch(mine.id, AMELIE);
  await addFromSearch(mine.id, CHIHIRO);
  expect(await setFavorite(mine.id, AMELIE, true)).toBe("applied");
  const [first] = await getGroupList().listByStatus(mine.id, "to_watch");
  expect(first).toMatchObject({ tmdbId: AMELIE, favoriteBy: "Léa" });
  expect((await getGroupList().counts(mine.id)).favorites).toBe(1);
});

it("re-marquer : noop, la date ne bouge pas ; démarquer puis démarquer encore", async () => {});

it("chaque transition qui quitte « à voir » efface le coup de cœur", async () => {
  // markWatched → unwatch : revenu sans coup de cœur ;
  // removeFromList → addFromSearch : revenu sans coup de cœur.
});

it("un film vu ou absent : noop, rien n’est écrit", async () => {
  // allRows(db) identique ; résultat "noop", pas d’exception
});
```

- [ ] **Step 2 :** `npx vitest run src/server src/features/list tests/functional`. Attendu : échec (`setFavorite`, `assertBoolean`, `getFavorites` absents ; le méta-test signale l'argument prévu sans action).
- [ ] **Step 3 :** implémenter dans l'ordre `assertMember` → `assertTmdbId("setFavorite", tmdbId)` → `assertBoolean("setFavorite", "on", on)` → `getFavorites().set({ groupId, userId: user.userId, tmdbId, on })` → `revalidateListPages()` → renvoyer le résultat. JSDoc : « ♡ / ♥ on « à voir »: the wanted state… No attempt limit: members only, idempotent, nothing to guess (as renameGroup). » Ne rien ajouter à `ACTION_LIMITS`.
- [ ] **Step 4 :** `npm run ci:checks`. Attendu : vert, y compris le méta-test (refusée sans session, rien d'écrit) et l'isolation (groupe forgé, vide, non-chaîne : refusé, rien d'écrit).
- [ ] **Step 5 : commit** `chore(list): add the setFavorite server action`

### Tâche 6 : LISTE (variante L2)

**Files:**

- Modify: `src/styles/tokens.css` (`--pink-pale`, `--shadow-offset-pink`)
- Create: `src/features/list/toWatchSections.ts`, `src/features/list/toWatchSections.test.ts`
- Create: `src/ui/favorite.ts` (`favoriteButtonName`, partagé avec la fiche), `src/ui/favorite.test.ts`
- Create: `src/features/list/ToWatchList.tsx` (les sections d'« À VOIR » : intertitres et listes)
- Modify: `src/features/list/ListScreen.tsx`, `ListRow.tsx`, `MovieRow.tsx`, `MovieRow.module.css`, `ListScreen.module.css`, `useListAction.ts`
- Modify: `src/app/list/page.tsx`
- Test: `src/features/list/ListScreen.test.tsx`

**Interfaces:**

- Consumes : `isFavorite`, `Movie.favoriteAt` (tâche 2), `setFavorite` (tâche 5).
- Produces :

```ts
// toWatchSections.ts
export interface ListSection {
  /** React key and id suffix. */
  key: "favorites" | "rest" | "all";
  /** « ♥ COUPS DE CŒUR · 2 », « LE RESTE · 3 »; null: no heading (no favourite). */
  title: string | null;
  movies: Movie[];
}
export function toWatchSections(movies: readonly Movie[]): ListSection[];

// useListAction.ts
export type ListAction = (tmdbId: number) => Promise<unknown>;
export type FavoriteAction = (tmdbId: number, on: boolean) => Promise<unknown>;

// src/ui/favorite.ts
export const favoriteButtonName = (title: string) => `Coup de cœur\u00A0: ${title}`;
```

`ListScreen` gagne la prop `onFavorite: FavoriteAction` (passée à chaque `ListRow` d'« À VOIR ») ; `MovieRow` gagne `favorite?: boolean` (fond `--pink-pale`, ombre `--shadow-offset-pink`, mini-tampon ♥ rond, `aria-hidden`, dans le coin bas-droit de la petite affiche) ; `RowButton` gagne le ton `"pink"`. La page lie `onFavorite={setFavorite.bind(null, groupId)}`.

- [ ] **Step 1 : tests en échec.**
  - `src/ui/favorite.test.ts` : `favoriteButtonName("Parasite")` vaut `"Coup de cœur\u00A0: Parasite"`.
  - `toWatchSections.test.ts` :

```ts
it("sans coup de cœur : une seule section, sans intertitre, dans l’ordre reçu", () => {
  expect(toWatchSections([aMovie(1), aMovie(2)])).toEqual([
    { key: "all", title: null, movies: [aMovie(1), aMovie(2)] },
  ]);
});

it("des coups de cœur : leur intertitre puis « LE RESTE », chacun avec son compte", () => {
  const fav = aMovie(2, { favoriteAt: NOV_4, favoriteBy: "Becca" });
  expect(toWatchSections([fav, aMovie(1), aMovie(3)])).toEqual([
    { key: "favorites", title: "♥ COUPS DE CŒUR · 1", movies: [fav] },
    { key: "rest", title: "LE RESTE · 2", movies: [aMovie(1), aMovie(3)] },
  ]);
});

it("tous coups de cœur : pas d’intertitre « LE RESTE »", () => {});
it("une liste vide : aucune section", () => {
  expect(toWatchSections([])).toEqual([]);
});
```

  - `ListScreen.test.tsx` : « sans coup de cœur, la liste de la 2.0 : aucun intertitre » (`queryByText(/COUPS DE CŒUR/)` et `queryByText(/LE RESTE/)` absents) ; « des coups de cœur : intertitres et compte, l’onglet garde À VOIR · total » (`getByText("♥ COUPS DE CŒUR · 1")`, `getByText("LE RESTE · 1")`, onglet `À VOIR · 2`) ; « chaque ligne à voir a ♡ / ♥ avant ✕, pressé selon le coup de cœur » (`getByRole("button", { name: /^Coup de cœur\s: Parasite$/ })` a `aria-pressed="true"`, l'autre `"false"`, et dans chaque ligne le ♡/♥ précède ✕ dans l'ordre du DOM) ; « taper ♡ marque, taper ♥ démarque » (`onFavorite` appelé avec `(496243, false)` puis `(129, true)`) ; « un double tap n’appelle onFavorite qu’une fois » ; « un échec de ♥ affiche le message et rend la main » (`PAS RÉUSSI À ENREGISTRER, RÉESSAIE`) ; « l’onglet VUS n’a ni ♡ ni intertitre ».
- [ ] **Step 2 :** `npx vitest run src/features/list`. Attendu : échec.
- [ ] **Step 3 :** implémenter. Les intertitres ne sont **pas** des titres (`listTitles` de l'e2e compte les `h2` du panneau, un par film) : un `<p id>` par section et un `<ul aria-labelledby>` (`RowList` gagne `labelledBy?: string`) ; chaque section a sa propre grille en colonne large. Le mini-tampon doit déborder de la vignette comme dans la maquette (`right: -9px; bottom: -7px`) : `.thumb` a `overflow: hidden`, donc envelopper l'affiche et poser le tampon sur l'enveloppe. Le ♡/♥ est un `RowButton` (`tone={favorite ? "pink" : "paper"}`, `aria-pressed`, `aria-label={favoriteButtonName(movie.title)}` (`src/ui/favorite.ts`), cible ≥ `--touch-min`), désactivé pendant la transition de la ligne comme ✕. Le glyphe du bouton est à l'encre (♡ sur papier, ♥ sur rose). Garder `ListScreen.tsx` sous 200 lignes en sortant le rendu des sections dans `ToWatchList.tsx`.
- [ ] **Step 4 :** `npm run ci:checks`. Attendu : vert. Puis `npm run build && npm run start:local` (jamais `npm start`) : marquer et démarquer un film sur iPhone SE (320 px), iPhone, paysage et écran large ; un titre long ne déborde pas et les deux boutons gardent 44 px.
- [ ] **Step 5 : commit** `feat(list): mark a film as a favourite and keep favourites first`

### Tâche 7 : la fiche (variante F2) et « CHEZ NOUS »

**Files:**

- Modify: `src/ui/Stamp.tsx`, `src/ui/Stamp.module.css` (tons `"heart"` et `"ghost"`)
- Create: `src/ui/FavoriteStamp.tsx`, `src/ui/FavoriteStamp.module.css`
- Modify: `src/ui/favorite.ts` (`FAVORITE_STAMP`, `FAVORITE_GHOST`)
- Create: `src/features/movie/FavoriteToggle.tsx`
- Modify: `src/features/movie/MovieScreen.tsx`, `MovieScreen.module.css`, `MovieFacts.tsx`
- Modify: `src/app/list/[tmdbId]/page.tsx`
- Test: `src/features/movie/MovieScreen.test.tsx`

**Interfaces:**

- Consumes : `favoriteLine` (tâche 2), `setFavorite` (tâche 5).
- Produces :

```ts
// src/ui/favorite.ts (favoriteButtonName: task 6)
export const FAVORITE_STAMP = "COUP DE CŒUR"; // after the pink ♥ glyph
export const FAVORITE_GHOST = "COUP DE CŒUR\u00A0?"; // after the ♡ glyph

// src/ui/FavoriteStamp.tsx: the big tilted stamp, bottom-left of a poster.
export function FavoriteStamp({ on }: { on: boolean }): ReactNode;

// src/features/movie/FavoriteToggle.tsx ("use client")
export function FavoriteToggle(props: {
  tmdbId: number;
  title: string;
  favorite: boolean;
  onFavorite: (tmdbId: number, on: boolean) => Promise<unknown>;
}): ReactNode;
```

`MovieScreen` gagne la prop `onFavorite` ; la page lie `setFavorite.bind(null, groupId)`. `ourHistory` gagne `favoriteLine(movie)` juste après `wantedLine`.

- [ ] **Step 1 : tests en échec** (`MovieScreen.test.tsx`) :

```ts
it("à voir, pas coup de cœur : le tampon fantôme est un bouton non pressé qui marque", async () => {
  // Testing Library folds the no-break space: match it with \s.
  const button = screen.getByRole("button", { name: /^Coup de cœur\s: Parasite$/ });
  expect(button).toHaveAttribute("aria-pressed", "false");
  expect(button).toHaveTextContent(/♡\s*COUP DE CŒUR\s\?/);
  await user.click(button);
  expect(onFavorite).toHaveBeenCalledExactlyOnceWith(496243, true);
});

it("coup de cœur : le vrai tampon est pressé, le taper démarque, sans quitter la fiche", async () => {
  // aria-pressed "true", texte /♥\s*COUP DE CŒUR/, onFavorite(496243, false), push jamais appelé
});

it("vu : ni tampon ni fantôme", () => {
  expect(screen.queryByRole("button", { name: /^Coup de cœur/ })).toBeNull();
  expect(screen.queryByText(/COUP DE CŒUR/)).toBeNull();
});

it("CHEZ NOUS : « coup de cœur de Becca le 4 novembre 2026 » juste après « voulu par »", () => {
  // les lignes du dd de « CHEZ NOUS », dans l’ordre :
  // ["ajouté par Léa le …", "voulu par Léa et Becca", "coup de cœur de Becca le 4 novembre 2026"]
});

it("un échec du tampon le dit et laisse réessayer", async () => {
  // onFavorite rejeté : alert « PAS RÉUSSI, RÉESSAIE », bouton de nouveau actif
});
```


- [ ] **Step 2 :** `npx vitest run src/features/movie src/ui`. Attendu : échec.
- [ ] **Step 3 :** implémenter. `FavoriteStamp` compose `Stamp` (`tone={on ? "heart" : "ghost"}`, inclinaison fixe, `-6` degrés) : le glyphe (`♥` rose / `♡` encre) dans un `<span aria-hidden="true">`, les mots à l'encre ; `heart` = fond papier, contour encre, ombre décalée ; `ghost` = contour en pointillés (`--border-dashed`), fond papier semi-transparent (opacité sur le **fond**, pas sur le texte). `FavoriteToggle` : un vrai `<button>` (`aria-pressed`, `aria-label={favoriteButtonName(title)}`, focus visible `--focus-ring`) qui contient `FavoriteStamp`, positionné en bas à gauche de l'affiche, `useTransition` + `failed` + `leaveIfRefused`, aucune navigation (la revalidation re-rend la fiche). `MovieScreen` le place dans le `poster` du `Ticket` seulement si `movie.status === "to_watch"`. Animation légère de pose du tampon, coupée sous `prefers-reduced-motion`.
- [ ] **Step 4 :** `npm run ci:checks`, puis vérification navigateur (`npm run start:local`) sur les quatre formats : le tampon et le fantôme restent sur l'affiche, ticket debout et couché.
- [ ] **Step 5 : commit** `feat(movie): mark a favourite from its page with the stamp`

### Tâche 8 : TIRER, la logique du filtre (pure)

**Files:**

- Modify: `src/domain/tonight.ts`, `src/domain/tonight.test.ts`, `src/domain/tonight.property.test.ts`
- Modify: `src/features/draw/tonightStorage.ts`, `tonightStorage.test.ts`, `tonightSummary.ts`, `tonightSummary.test.ts`, `drawView.ts`, `drawView.test.ts`
- Modify: `src/features/draw/DrawSessionProvider.tsx` (filtres par défaut : `favoritesOnly: false`)

**Interfaces:**

- Consumes : `isFavorite`, `ListCounts` (tâche 2).
- Produces :

```ts
// src/domain/tonight.ts
export interface TonightFilters {
  bedtime: Bedtime | null;
  moods: readonly MoodId[];
  platforms: readonly string[];
  /** « ♥ NOS COUPS DE CŒUR »: per evening, never stored on the device. */
  favoritesOnly: boolean;
}
export type TonightMovie = MovieSnapshot & Pick<Movie, "favoriteAt">;
export const NO_FILTERS: TonightFilters; // favoritesOnly: false
export function sanitizeFilters(filters: TonightFilters, movies: readonly TonightMovie[]): TonightFilters;
export function isFiltering(filters: TonightFilters): boolean;
export function filterTonight<M extends TonightMovie>(movies: readonly M[], filters: TonightFilters, now: Date): M[];

// src/features/draw/drawView.ts
export function drawButton(filters: TonightFilters, eligibleCount: number): { lines: string[]; tone: "yellow" | "pink" };
export function homeCounts(counts: ListCounts): string;
```

- [ ] **Step 1 : tests en échec.**

```ts
// tonight.test.ts
it("seulement nos coups de cœur, cumulé avec les autres filtres", () => {
  const fav = aMovie(1, { favoriteAt: NOV_4, genreIds: [35] });
  const favDrama = aMovie(2, { favoriteAt: NOV_4, genreIds: [18] });
  const other = aMovie(3, { genreIds: [35] });
  const only = { ...NO_FILTERS, favoritesOnly: true };
  expect(filterTonight([fav, favDrama, other], only, NOW)).toEqual([fav, favDrama]);
  expect(filterTonight([fav, favDrama, other], { ...only, moods: ["laugh"] }, NOW)).toEqual([fav]);
});
it("isFiltering compte le filtre coups de cœur", () => {
  expect(isFiltering({ ...NO_FILTERS, favoritesOnly: true })).toBe(true);
});
it("plus aucun coup de cœur : le filtre retombe à toute la liste", () => {
  expect(sanitizeFilters({ ...NO_FILTERS, favoritesOnly: true }, [aMovie(1)]).favoritesOnly).toBe(false);
  expect(sanitizeFilters({ ...NO_FILTERS, favoritesOnly: true }, [aMovie(1, { favoriteAt: NOV_4 })]).favoritesOnly).toBe(true);
});

// tonightStorage.test.ts
it("ne garde jamais le filtre coups de cœur sur l’appareil", () => {
  expect(JSON.parse(serializeTonight({ ...NO_FILTERS, favoritesOnly: true }))).toEqual({ bedtime: null, platforms: [] });
  expect(parseStoredTonight('{"favoritesOnly":true}')).toEqual({ bedtime: null, platforms: [] });
});

// tonightSummary.test.ts
it("le filtre coups de cœur vient en premier : COUPS DE CŒUR · AVANT MINUIT", () => {
  expect(filtersSummary({ ...NO_FILTERS, favoritesOnly: true, bedtime: 24 * 60 }, [])).toBe("COUPS DE CŒUR · AVANT MINUIT");
});

// drawView.test.ts
it.each([
  [NO_FILTERS, 5, { lines: ["TIRER", "UN", "FILM"], tone: "yellow" }],
  [{ ...NO_FILTERS, moods: ["laugh"] }, 2, { lines: ["TIRER", "PARMI 2"], tone: "yellow" }],
  [{ ...NO_FILTERS, favoritesOnly: true }, 2, { lines: ["TIRER", "UN COUP", "DE CŒUR"], tone: "pink" }],
  [{ ...NO_FILTERS, favoritesOnly: true, moods: ["laugh"] }, 1, { lines: ["TIRER", "PARMI 1"], tone: "pink" }],
])("drawButton(%o, %i)", (filters, count, expected) => {
  expect(drawButton(filters, count)).toEqual(expected);
});
it("homeCounts : « dont k ♥ » seulement s’il y a des coups de cœur", () => {
  expect(homeCounts({ toWatch: 3, watched: 0, favorites: 0 })).toBe("3 films à regarder · 0 vu");
  expect(homeCounts({ toWatch: 5, watched: 1, favorites: 2 })).toBe("5 films à regarder · dont 2 ♥ · 1 vu");
});
```

`tonight.property.test.ts` : l'arbitraire de film gagne `favoriteAt: fc.option(fc.date(), { nil: null })`, celui des filtres `favoritesOnly: fc.boolean()` ; la propriété « chaque film gardé respecte chaque filtre » vérifie aussi `!filters.favoritesOnly || m.favoriteAt !== null`.

- [ ] **Step 2 :** `npx vitest run src/domain src/features/draw`. Attendu : échec.
- [ ] **Step 3 :** implémenter (`sanitizeFilters` garde `favoritesOnly` seulement si un film de la liste `isFavorite` ; `serializeTonight` est déjà une liste blanche : seul son test change ; `DrawSessionProvider` ajoute `favoritesOnly: false` aux filtres relus). `homeCounts` remplace le texte écrit en JSX dans `DrawHome` (même texte sans coup de cœur : les captures de la 2.0 ne bougent pas). Corriger les fixtures de filtres des autres tests (`DrawScreen.test.tsx`…) que le type signale.
- [ ] **Step 4 :** `npm run ci:checks`. Attendu : vert, `tonight.ts` sous 200 lignes.
- [ ] **Step 5 : commit** `chore(draw): filter the draw on the group's favourites`

### Tâche 9 : TIRER, l'écran (variante T2)

**Files:**

- Modify: `src/styles/tokens.css` (`--glow-pink-lg`)
- Modify: `src/ui/Chip.tsx`, `src/ui/Chip.module.css` (ton `"pink"` quand pressé)
- Modify: `src/features/draw/TonightPanel.tsx`, `DrawHome.tsx`, `DrawResult.tsx`, `DrawScreen.tsx`, `DrawScreen.module.css`, `useDraw.ts`
- Modify: `src/app/page.tsx` (rien à lier : `counts` porte déjà `favorites`)
- Test: `src/features/draw/DrawScreen.test.tsx`

**Interfaces:**

- Consumes : `TonightFilters.favoritesOnly`, `sanitizeFilters`, `drawButton`, `homeCounts` (tâche 8), `FavoriteStamp` (tâche 7), `ListCounts`.
- Produces : `useDraw` renvoie aussi `favoriteCount: number` (films « à voir » coups de cœur, compté sur `toWatch`) ; `TonightPanel` prend `favoriteCount` ; `DrawScreenProps.counts: ListCounts` ; `Chip` gagne `tone?: "pink"`.

- [ ] **Step 1 : tests en échec** (`DrawScreen.test.tsx`) :

```ts
it("sans coup de cœur : ni ligne « ON TIRE PARMI », ni « dont », le bouton jaune de la 2.0", async () => {
  // panneau ouvert : queryByText("ON TIRE PARMI") null ; getByRole("button", { name: "TIRER UN FILM" })
});

it("avec des coups de cœur : la ligne « ON TIRE PARMI » vient en premier", async () => {
  // getByRole("group", { name: "ON TIRE PARMI" }) premier groupe du panneau ;
  // « TOUTE LA LISTE » pressé, « ♥ NOS COUPS DE CŒUR · 2 » non pressé ; sous-titre « 5 films à regarder · dont 2 ♥ · 0 vu »
});

it("filtre actif : le bouton rose dit TIRER UN COUP DE CŒUR, le résumé COUPS DE CŒUR, seul un coup de cœur sort", async () => {
  // clic « ♥ NOS COUPS DE CŒUR · 1 » → bouton « TIRER UN COUP DE CŒUR » ;
  // résumé du panneau fermé « COUPS DE CŒUR » ; tirage → le seul coup de cœur
});

it("le film tiré porte le tampon dès qu’il est coup de cœur, filtre actif ou non ; ce n’est pas un bouton", async () => {
  // sans filtre, liste d’un seul coup de cœur : getByText("COUP DE CŒUR") visible,
  // queryByRole("button", { name: /Coup de cœur/ }) null, « FINI À … » toujours là
});

it("le dernier coup de cœur disparaît (rerender sans coup de cœur) : le filtre retombe et la ligne s’efface", async () => {});

it("AUCUN FILM NE COLLE puis ENLEVER LES FILTRES remet aussi TOUTE LA LISTE", async () => {});
```

- [ ] **Step 2 :** `npx vitest run src/features/draw`. Attendu : échec.
- [ ] **Step 3 :** implémenter. Dans `TonightPanel`, un composant `FavoritesChoice` (même fichier, pour garder `TonightChoices` sous 80 lignes) rendu en premier si `favoriteCount > 0` : `ChipGroup` « ON TIRE PARMI », puces « TOUTE LA LISTE » (`pressed={!filters.favoritesOnly}`) et `♥ NOS COUPS DE CŒUR · ${favoriteCount}` (`tone="pink"`, `pressed={filters.favoritesOnly}`). `DrawAction` utilise `drawButton(filters, eligibleCount)` : ton `pink` = fond `--pink`, texte `--on-pink`, ombre `--shadow-offset-lg` et lueur `--glow-pink-lg`. Le sous-titre vient de `homeCounts(counts)` (s'il ne tient pas sur une ligne à 320 px, le laisser passer à la ligne plutôt que de le couper ; ne le retirer qu'après accord). `DrawResult` met `<FavoriteStamp on />` dans le `poster` du `Ticket` quand `isFavorite(movie)` ; « FINI À » garde sa place (le `stamp` du ticket, en haut à droite).
- [ ] **Step 4 :** `npm run ci:checks`, puis vérification navigateur (`npm run start:local`) sur les quatre formats, dont le paysage 844 × 390 : bouton rose et heure visibles sans défiler ; tampon du film tiré lisible sur l'affiche réduite à 120 px, sans chevaucher « FINI À ».
- [ ] **Step 5 : commit** `feat(draw): draw among the group's favourites only`

### Tâche 10 : parcours e2e, mise en page et accessibilité

**Files:**

- Create: `e2e/favorites.spec.ts`
- Modify: `e2e/fixtures.ts` (`favoritedOn`), `e2e/layout.spec.ts`

**Interfaces:**

- Produces : `favoritedOn(date: Date): Promise<void>` dans `e2e/fixtures.ts` : pose `favorite_at = date` sur toutes les lignes coups de cœur de la base du worker (comme `decidedOn`, pour figer « coup de cœur de Léa le … » dans les captures).
- Rappel : dans l'e2e, `swipe(app, ["keep", "keep", "keep"])` met Whiplash, Le Voyage de Chihiro et Parasite dans la liste (ordre du faux catalogue) ; `aria-pressed` se lit par `toHaveAttribute`.

- [ ] **Step 1 : scénarios** (`test.describe("coups de cœur")`, tous importés de `./fixtures`) :
  - « marquer depuis la liste : le film passe en tête, sous son intertitre ; démarquer le remet dans la liste » (`♥ COUPS DE CŒUR · 1` puis premier `listTitles` = Whiplash ; démarquer → plus d'intertitre).
  - « marquer depuis la fiche : le fantôme devient le tampon, et CHEZ NOUS dit coup de cœur de Léa » (`getByText(/coup de cœur de Léa le/i)`).
  - « Hugo, sur un second appareil, voit le coup de cœur de Léa » (`member("Hugo")` : intertitre, ♥ pressé, ligne CHEZ NOUS).
  - « TIRER avec le filtre : bouton rose, seul un coup de cœur peut sortir » (3 films, Whiplash seul coup de cœur ; « ♥ NOS COUPS DE CŒUR · 1 » → « TIRER UN COUP DE CŒUR » → titre Whiplash).
  - « sans le filtre, le film tiré porte le tampon ; ON LE REGARDE efface le coup de cœur » (un seul film, coup de cœur ; tirage → `COUP DE CŒUR` visible ; `ON LE REGARDE`, `settled` ; LISTE : plus d'intertitre ; VUS puis `↺ À VOIR` : la ligne revient avec ♡ non pressé).
  - `layout.spec.ts`, nouveau `describe("mise en page et accessibilité, coups de cœur")` sur chaque `VIEWPORTS` : Amélie (titre long) et Whiplash coups de cœur, puis `expectNoOverflow` et `seriousViolations` (axe, contraste compris) sur `/list`, la fiche coup de cœur, la fiche fantôme, `/` panneau ouvert filtre actif, le film tiré ; et, dans « un écran sans défiler », « TIRER avec le filtre coups de cœur : le bouton rose et l’heure » via `expectOnScreen`.
- [ ] **Step 2 :** `npm run test:e2e -- e2e/favorites.spec.ts e2e/layout.spec.ts`. Attendu : vert (le code existe déjà) ; tout échec renvoie à la tâche fautive, diagnostic d'abord.
- [ ] **Step 3 :** pour chaque scénario, prouver qu'il mord : casser temporairement la règle visée (ex. ne plus effacer `favoriteAt` dans `CHANGES.mark_watched`) et voir le scénario échouer, puis restaurer.
- [ ] **Step 4 :** `npm run ci`. Attendu : vert.
- [ ] **Step 5 : commit** `test(e2e): cover the favourites journeys, layout and accessibility`

### Tâche 11 : captures de référence

**Files:**

- Modify: `e2e/visual.spec.ts`
- Create: `e2e/visual.spec.ts-snapshots/<format>-11*-…png` (générées)

- [ ] **Step 1 :** dans `describe("rendu visuel")`, un **nouveau** test par format, `coups de cœur : ${format.name}` (le test « écrans » reste tel quel : ses captures prouvent que, sans coup de cœur, rien ne change). Il marque Parasite depuis la LISTE, appelle `favoritedOn(FROZEN_NOW)`, puis capture : `${format.name}-11-liste-coups-de-coeur`, `-11b-fiche-coup-de-coeur` (`/list/496243`), `-11c-fiche-fantome` (`/list/129`), `-11d-la-soiree-coups-de-coeur` (panneau ouvert, filtre actif), `-11e-accueil-coup-de-coeur` (bouton rose), `-11f-ticket-coup-de-coeur` (film tiré).
- [ ] **Step 2 :** `npm run test:e2e -- e2e/visual.spec.ts`. Attendu : seules les nouvelles captures manquent. Vérifier par `git status --short e2e/visual.spec.ts-snapshots` qu'**aucune capture existante n'est modifiée** (seulement des fichiers ajoutés) ; sinon c'est une régression de la 2.0 sans coup de cœur : retour à la tâche fautive.
- [ ] **Step 3 :** si besoin, `npm run test:e2e -- --update-snapshots`, puis **regarder chaque nouvelle image** (Read) sur les quatre formats : DA riso (rose, encre, papier), mots du tampon à l'encre, rien de coupé ni sous la nav, mini-tampon qui déborde proprement de la vignette, tampon de la fiche et du film tiré à l'écart de « FINI À ». Noter dans le rapport ce qui a été regardé.
- [ ] **Step 4 :** `npm run ci`. Attendu : vert.
- [ ] **Step 5 : commit** `test(e2e): add the favourites reference captures`

### Tâche 12 : documentation

**Files:**

- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-10-28-wewatch-v2-design.md`, `docs/coverage.md`, `src/db/group-schema.ts` (commentaire « until 2.1 »)

- [ ] **Step 1 :** écrire.
  - `CLAUDE.md` : présentation (le ♥ de la LISTE et de la fiche, le filtre de TIRER) ; « Migrations rétrocompatibles » : `favorite_at` / `favorite_by` (`0012`), seul un film « à voir » est coup de cœur, lectures et comptes filtrés sur `to_watch`, transitions qui effacent (`CHANGES`), garde de `undoKeep`, et la limite connue du retour arrière ; « Supprimer un compte » : `favorite_by` à `NULL` ; « Limites de tentatives » : `setFavorite` dans les actions non limitées ; architecture : `db/favorites` ; « en 2.1 » (restes d'avant les comptes, `ACCESS_CODE`) → « dans une version suivante ».
  - Spec v2 : section « 16. 2.1.0 · Coups de cœur » qui renvoie à `2026-11-04-coups-de-coeur-design.md` ; ses « en 2.1 » → « dans une version suivante ».
  - `src/db/group-schema.ts` : « until 2.1 » → « until a later version ».
  - `README.md` (« Ce qu'elle fait ») : sous TIRER, le filtre « ♥ NOS COUPS DE CŒUR » ; sous LISTE, le ♡/♥, les coups de cœur en tête, « coup de cœur de Becca » dans « CHEZ NOUS ».
  - `docs/coverage.md` : date de mise à jour, nombre de tests et de fichiers relevés par `npm run test:coverage`, nouvelles lignes du tableau par fichier (`src/db/favorites.ts`, `src/features/list/toWatchSections.ts`, `src/ui/favorite.ts`).
- [ ] **Step 2 :** `npx prettier --check CLAUDE.md README.md docs/coverage.md docs/superpowers/specs/2026-10-28-wewatch-v2-design.md` et `grep -rn "en 2\.1" CLAUDE.md README.md docs/superpowers/specs src` : plus rien. Puis `npm run ci:checks`.
- [ ] **Step 3 : commit** `docs: describe the 2.1.0 favourites`

### Tâche 13 (contrôleur) : livrer par une PR

Faite par le contrôleur, pas par un sous-agent.

- [ ] `git fetch origin && git rebase origin/main` ; si `main` a reçu une migration, régénérer `0012` (tâche 1) avant tout.
- [ ] `git push -u origin feat/coups-de-coeur`, puis `gh pr create` (titre `feat: favourites (coups de cœur)`, corps : résumé, captures regardées, limite connue du retour arrière, choix du concepteur à relire par le mainteneur).
- [ ] Suivre la CI (`gh pr checks --watch`) ; rouge → diagnostic avant tout correctif.
- [ ] Verte : `gh pr merge --rebase` (jamais `--squash` ni `--merge`). Puis `gh run watch` sur `main` : déploiement, fumée, puis release-please publie la **2.1.0**.
