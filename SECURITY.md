# Politique de sécurité

## Versions suivies

Seule la **dernière version** (la dernière release GitHub, déployée en production) reçoit des correctifs. Il n'y a pas de branche de maintenance.

## Signaler une faille

**Pas d'issue publique pour une faille.** Utilisez le signalement privé de GitHub : onglet **Security** du dépôt → **Report a vulnerability** ([lien direct](https://github.com/thogio8/we-watch/security/advisories/new)). Le message n'est lu que par le mainteneur.

WeWatch est un projet personnel : visez **une semaine** pour une première réponse. Indiquez ce que vous avez observé, comment le reproduire et, si vous le savez, ce que cela permet. Merci de ne pas tester sur l'instance de production d'un tiers.

## Ce qui est protégé, et comment

- **Des comptes sans mot de passe** : passkeys (Better Auth), sessions relues en base à chaque action, session récente exigée pour ce qui peut enfermer dehors.
- **Des actions serveur fermées** : chacune vérifie la session, puis l'appartenance au groupe, puis une limite de tentatives, avant de valider ses arguments.
- **Des liens d'invitation secrets**, régénérables, jamais écrits dans les journaux.
- **Des en-têtes de sécurité** sur toute réponse (CSP, HSTS, `X-Frame-Options`…), vérifiés après chaque mise en ligne par un test de fumée.
- **Des sauvegardes chiffrées** (AES-256-GCM), sans session ni jeton, dont la restauration est répétée chaque nuit.

Le détail, les risques acceptés et les correctifs sont dans [`docs/security-audit-2.0.md`](docs/security-audit-2.0.md).

## Les contrôles automatiques

- **CodeQL** : analyse statique du code, onglet Security → Code scanning.
- **Secret scanning et push protection** : un secret poussé par erreur est détecté, ou refusé avant le push.
- **Dependabot** : alertes et mises à jour de sécurité des dépendances, et pull request de mises à jour des dépendances npm chaque lundi (celles des actions GitHub : chaque mois).
- **Revue des dépendances** sur chaque pull request : une dépendance ajoutée avec une faille connue de sévérité haute fait échouer ce contrôle.
- **OpenSSF Scorecard** : l'hygiène du dépôt, mesurée chaque lundi.

Le détail de ce qui tourne et quand est dans [`docs/qualite.md`](docs/qualite.md).
