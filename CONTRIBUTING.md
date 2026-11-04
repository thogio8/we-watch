# Contribuer à WeWatch

Merci d'y penser. WeWatch est un petit projet : une issue ou une pull request courte et ciblée a toutes les chances d'être lue vite.

## Avant de commencer

- **Node.js 24**.
- **Docker** pour les tests de bout en bout : ils tournent dans l'image officielle de Playwright, pour que les captures de référence soient identiques partout.
- Un jeton TMDB gratuit pour lancer l'appli ; les tests, eux, utilisent un faux TMDB. L'installation locale est décrite dans le [README](README.md#essayer-en-local).

## Les commandes

```bash
npm run ci              # tout ce que vérifie la CI : format, lint, types, doublons, code mort, tests, e2e
npm run ci:checks       # la même chose sans l'e2e (rapide)
npm run test:e2e        # tests de bout en bout seuls (Docker requis)
npm run mutation        # tests de mutation : mesure la solidité des tests (environ 4 minutes en local sur un passage complet, moins ensuite : le calcul est incrémental)
npm run test:lighthouse # Lighthouse sur les écrans connectés (Docker requis)
```

`npm install` installe lefthook : le commit formate et lint les fichiers indexés, le push d'une branche lance `npm run ci`. Ne poussez pas au rouge.

## Les règles du projet

Les règles complètes (architecture en couches, fichiers courts, logique pure testée, direction artistique « ticket d'entrée », définition de « fini ») sont dans [`CLAUDE.md`](CLAUDE.md), écrit pour les humains comme pour les agents de code. Les garde-fous (ESLint, jscpd, knip, seuils de couverture) font respecter l'essentiel : un import interdit ou un doublon casse la CI.

Un changement de comportement vient avec son test, au bon niveau : unitaire pour la logique pure, fonctionnel pour une action serveur ou la base, e2e pour un parcours.

## Les commits

[Conventional Commits](https://www.conventionalcommits.org), en anglais, un header seul : `type(scope): description`. **Le type fixe le numéro de version** : `feat` publie une version mineure, `fix` un correctif, `feat!` ou `fix!` une version majeure ; `refactor`, `test`, `ci`, `docs` et `chore` ne publient rien. Un commit, un type honnête.

## Proposer un changement

`main` est protégée : pas de push direct, tout passe par une pull request.

1. Créez une branche depuis `main`, faites vos commits, poussez-la.
2. Ouvrez la pull request (`gh pr create`) : elle doit passer `checks`, `e2e` (4 machines) et la revue des dépendances, et être à jour avec `main`.
3. Une fois la CI verte, le mainteneur la fusionne en **rebase** (`gh pr merge --rebase`) : ni squash ni merge, pour que chaque commit garde son type. Sur `main`, la CI déploie puis publie la version.

Si `main` avance pendant ce temps (chaque version ajoute un commit de release), remettez la branche à jour avec `gh pr update-branch --rebase` (pas le bouton « Update branch » de l'interface, qui ajoute un commit de fusion) ; pour une PR Dependabot, commentez `@dependabot rebase`.

Une PR = une version : regroupez les commits d'une même fonctionnalité dans une seule PR.

## La CI d'une pull request

Le dépôt est public : la CI d'un contributeur externe **attend l'approbation du mainteneur** avant de démarrer, c'est normal. Elle rejoue `npm run ci` en jobs parallèles, sur Chromium et WebKit, et examine les dépendances ajoutées.

## Signaler une faille

Pas d'issue publique : voir [`SECURITY.md`](SECURITY.md).
