# WeWatch 2.0 : comptes et groupes

> Date : 2026-10-28 · Statut : validée
> Complète la spec historique [`2026-10-23-we-watch-design.md`](2026-10-23-we-watch-design.md) (V1 → V1.3.2), qui reste la référence pour tout ce qui ne change pas ici (DA, tirage, filtres, swipe, responsive).
> Maquette de la navigation : option A ci-dessous (§9).

## 1. Intention

Jusqu'ici, WeWatch est l'appli d'un couple : une seule liste, protégée par un code d'accès partagé. Le dépôt va devenir public et le déploiement visible de tous ; un code partagé ne suffit plus, et l'appli peut servir à d'autres cercles (un couple, une coloc, une bande de potes).

La 2.0 fait de WeWatch une appli **à comptes et à groupes** : chacun a son compte, appartient à un ou plusieurs groupes, et chaque groupe a sa propre liste. Le reste de l'expérience (swiper, tirer au sort, la DA « ticket d'entrée ») ne change pas.

C'est une **version majeure** : le code d'accès disparaît, la liste unique devient une liste par groupe, et chaque appareil doit se reconnecter une fois.

## 2. Décisions du mainteneur

- **Groupes façon Splitwise** : comptes, groupes, lien d'invitation. Une personne peut être dans plusieurs groupes ; chaque groupe a sa liste.
- **Connexion sans email ni mot de passe** : **passkey** (Face ID / Touch ID / empreinte) d'abord, « Continuer avec Google » en option. Pas d'envoi d'email (un service d'email gratuit exige un nom de domaine, et le mainteneur ne veut pas en payer un). **Pas d'Apple** (payant). **Uniquement des services gratuits.**
- **Tout le monde peut tout faire** dans un groupe ; on voit **qui a fait quoi** (noms sur les actions) et **les membres** du groupe.
- **Swipe en groupe** : **un « ON LE VEUT » suffit** pour que le film entre dans la liste du groupe ; **un « BOF » ne vaut que pour soi**.
- **Inscription sur l'instance du mainteneur : sur invitation uniquement.** Ceux qui veulent l'appli pour eux l'hébergent chez eux (README). Pas de pages légales ni de captcha à gérer.
- **Navigation : option A**, une pastille du groupe en haut de chaque écran (§9).
- **Versions** : c'est la **2.0.0**, livrée d'un bloc. Travail sur une branche `release/2.0.0`, morceau par morceau (§13) ; pas de déploiement de test (« on n'est que deux »).
- **Nom** : l'appli s'appelle **WeWatch** (déjà commité sur `release/2.0.0`).

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Se connecter sans mot de passe, sur l'appli installée (PWA) comme dans un navigateur.
- Créer des groupes, inviter par un lien, voir et gérer les membres.
- Garder intacte la liste actuelle du couple et ses usages, à la bascule.
- Qu'un membre d'un groupe ne puisse **jamais** lire ni modifier la liste d'un groupe dont il n'est pas membre.

**Non-objectifs (2.0)**
- Connexion Apple, mot de passe, envoi d'emails, récupération d'un compte perdu.
- Inscription ouverte sur l'instance du mainteneur (possible pour d'autres instances via `SIGNUP=open`, voir §5).
- Rôles (admin, créateur) : tous les membres sont égaux.
- Temps réel entre téléphones, notifications.
- Pages légales, captcha (nécessaires seulement si on ouvre l'inscription au public).
- Déploiement de test.

**Anti-objectifs**
- Une authentification « maison » : on s'appuie sur une bibliothèque éprouvée.
- Un écran de connexion générique qui casse la DA riso.
- Une bascule qui perd ou mélange des films de la liste actuelle.
- Un service payant, même « petit ».

## 4. Contraintes

- Hébergement inchangé : **Vercel Hobby + Turso** (gratuits), Next.js 16 (App Router, Server Actions, Cache Components), Drizzle + libSQL.
- Tout doit marcher dans la **PWA installée sur iPhone** (cookies séparés de Safari). Les passkeys y fonctionnent ; Google n'est pas garanti (voir §5).
- Pas de nom de domaine : l'instance du mainteneur reste sur son adresse `*.vercel.app`. Les passkeys sont liées à cette adresse ; en changer plus tard obligerait chacun à en réenregistrer une.
- Règles du dépôt (`CLAUDE.md`) : couches vérifiées par ESLint, SOLID/KISS/DRY, tests au bon niveau, CI verte, migrations rétrocompatibles, DA non négociable.
- Données films : TMDB, inchangé.

## 5. Comptes et connexion

Bibliothèque : **Better Auth** (1.7.x, compatible Next 16 et Drizzle, stockage dans notre base Turso, gratuit et auto-hébergé). *(Choix de conception.)*

- **Créer un compte par passkey** : on tape son **nom affiché** (prénom ou surnom), puis le verrou de l'appareil (Face ID, empreinte ou code du téléphone) enregistre une passkey. Ni email ni mot de passe. Livré : un ticket d'inscription signé à usage unique (nom + drapeau propriétaire + id du groupe invitant s'il vient d'un lien, 10 min) est passé comme contexte WebAuthn et consommé par `afterVerification` dans la transaction de création du compte.
- **Se connecter** : « SE CONNECTER ». Les passkeys se synchronisent d'elles-mêmes entre les appareils d'une personne (trousseau iCloud, gestionnaire de mots de passe Google) ; sur un appareil qui n'est pas à soi, le navigateur propose de scanner un QR code avec son téléphone. Plusieurs passkeys possibles par compte.
- **Google** (facultatif) : « CONTINUER AVEC GOOGLE » crée un compte ou s'y connecte ; un compte créé par passkey peut **lier** Google depuis « Mon compte » (et inversement ajouter une passkey). Google sert ainsi aussi de secours.
  - Si la connexion Google ne revient pas dans la **PWA installée sur iPhone**, le bouton n'est affiché que dans le navigateur. À vérifier sur un vrai iPhone **au début** du morceau Google. *(Choix de conception, accepté par le mainteneur.)*
- **Compte perdu** (plus aucune passkey, pas de Google lié) : pas de récupération. On crée un nouveau compte et on revient dans ses groupes par leur lien d'invitation ; les listes appartiennent aux groupes, on ne perd que ses BOF. L'ancien compte reste un membre fantôme qu'un membre peut retirer. *(Choix de conception : un lien de récupération généré par un autre membre lui donnerait la main sur le compte.)*
- **Nom affiché** modifiable ensuite. C'est lui qu'on voit sur les actions.
- **Session** : cookie httpOnly, longue durée glissante (de l'ordre de 60 jours), pour ne pas se reconnecter sans cesse. *(Choix de conception.)*
- **Inscription** : variable `SIGNUP` = `invite` (instance du mainteneur) ou `open`.
  - `invite` : on ne crée un compte **qu'en arrivant par un lien d'invitation**, ou avec le **code propriétaire** (`OWNER_CODE`, secret de l'instance, facultatif) : c'est ainsi que se créent les premiers comptes d'une instance. *(Choix de conception, remplace l'idée d'une liste d'emails.)*
  - `open` : n'importe qui crée un compte ; il atterrit sur « CRÉER TON PREMIER GROUPE ».
  - Valeur par défaut : `open` (comportement attendu d'une instance perso fraîchement déployée) ; l'instance du mainteneur fixe `invite`. *(Choix de conception.)*
- Le code d'accès (`ACCESS_CODE`, cookie `ww_access`, `/unlock`) **disparaît** de l'appli (la variable est retirée en 2.1, §11).

## 6. Groupes

- Un groupe a un **nom** (modifiable par tout membre) et des **membres**, tous égaux.
- Tout membre peut : swiper, ajouter, retirer, marquer vu / à revoir, tirer, **inviter**, **retirer un membre**, renommer le groupe, **quitter** le groupe.
- Un groupe **disparaît avec son dernier membre** (sa liste aussi).
- **Groupe affiché** : celui choisi dans la pastille (§9), mémorisé sur l'appareil ; par défaut le dernier utilisé, sinon le premier. *(Choix de conception.)*
- **Aucun groupe** (nouveau compte en mode `open`, ou après avoir quitté le dernier) : écran « CRÉER TON PREMIER GROUPE ».
- La session de tirage (pile « pas ce soir », filtres) est **propre à chaque groupe** : changer de groupe ne mélange pas les piles. *(Choix de conception.)*
- Livré (morceau 3, décisions du mainteneur du 2026-10-29) : un membre qui quitte le groupe ou en est retiré perd ses « voulu » dans ce groupe ; ses ajouts et ses « marqué par » restent, avec son prénom. Le dernier membre qui part supprime le groupe avec sa liste (pas les instantanés TMDB ni les BOF) ; « NOUS DEUX » sans membre n'est jamais concerné, personne ne le quittant.

## 7. Invitations

- Chaque groupe a **un lien d'invitation**, que tout membre peut copier et partager (WhatsApp, SMS…).
- Le lien reste valable **jusqu'à ce qu'un membre le régénère** ; l'ancien devient alors inutilisable (utile s'il a fuité).
- Ouvrir le lien :
  - **sans compte** : écran de connexion / création de compte, puis entrée dans le groupe. En mode `invite`, c'est la seule façon de créer un compte ;
  - **connecté, pas membre** : « REJOINDRE « LES POTES DU JEUDI » ? » puis entrée dans le groupe ;
  - **déjà membre** : on bascule simplement sur ce groupe.
- Un membre retiré peut revenir par le lien tant qu'il n'est pas régénéré (on régénère si on veut l'en empêcher). *(Choix de conception.)*
- Livré (morceau 3, décision du mainteneur) : ouvrir un lien **bascule sur son groupe**, comme en créer un : rejoindre le rend affiché (cookie `ww_group`, dernier usage mis à jour) ; déjà membre, « Y ALLER » fait de même. Un lien mal formé, inconnu, régénéré ou d'un groupe disparu répond « CE LIEN N’EST PLUS VALABLE », sans dire lequel. Le jeton n'apparaît jamais dans un message d'erreur ni un journal de l'appli.

## 8. La liste, le swipe et le tirage en groupe

Règle d'or : **un oui suffit, un BOF ne vaut que pour soi.**

- **ON LE VEUT** : le film entre dans la liste « à voir » du groupe s'il n'y est pas déjà. On garde **qui l'a voulu** ; si plusieurs membres le veulent, tous sont notés (« voulu par Léa et Hugo »).
- **✕ BOF** : le film disparaît **de mes propres piles de swipe**, dans tous mes groupes (un BOF est un goût personnel). Les autres peuvent encore le vouloir. *(Choix de conception : BOF par personne, pas par groupe.)*
- **Pile de swipe d'un membre** : exclut les films déjà dans la liste du groupe (quel que soit leur statut), les films écartés par le groupe, et mes BOF.
- **↺ ANNULER** un swipe : comme aujourd'hui, seulement si c'est bien ce swipe qui a créé l'état.
- **Recherche + AJOUTER** : ajoute à la liste du groupe (même un film que j'avais mis en BOF : chercher exprès, c'est avoir changé d'avis, et mon BOF est effacé).
- **✕ dans la liste** (retirer) : le film quitte la liste du groupe et est **écarté pour le groupe** (il ne revient pas dans les piles du groupe), comme aujourd'hui.
- **Vu / à revoir** : au niveau du groupe, avec **qui** et **quand**.
- **Qui a fait quoi** : la ligne et la fiche affichent « ajouté par … le … », « voulu par … », « vu le … · marqué par … ». Un compte supprimé devient « un ancien membre ».
- **Tirer** : inchangé, sur la liste « à voir » du groupe affiché, filtres compris.
- **Rafraîchissement quotidien** (cron) : inchangé dans l'esprit ; les données TMDB d'un film sont **partagées** entre groupes (un seul instantané par film), rafraîchies une fois. *(Choix de conception.)*

## 9. Écrans

Toute la DA reste celle de la spec historique (§5) ; les nouveaux écrans sont des tickets riso comme `/unlock` aujourd'hui.

- **Pastille du groupe (option A, choisie)** : au-dessus du titre de TIRER, SWIPER et LISTE, « ● NOUS DEUX ▾ ». La toucher ouvre un panneau : mes groupes (avec le nombre de membres, ✓ sur le groupe affiché), « + CRÉER UN GROUPE », « MEMBRES ET INVITATION », puis « MON COMPTE » et « SE DÉCONNECTER ». *(Ces deux dernières entrées : choix de conception.)*
- **Connexion** : un ticket « ENTRE DANS WEWATCH », dessous une ligne discrète « Face ID, empreinte ou code de ton téléphone », puis « SE CONNECTER », « CONTINUER AVEC GOOGLE » (sauf PWA iPhone si §5 l'exige), et « CRÉER UN COMPTE ». En mode `invite`, « CRÉER UN COMPTE » n'apparaît qu'en arrivant par une invitation ; ailleurs, un message clair (« WEWATCH SE REJOINT SUR INVITATION ») et un lien discret « J'AI UN CODE PROPRIÉTAIRE ». Validation annulée : « VALIDATION ANNULÉE, RÉESSAIE ». Un navigateur sans passkeys (pas de WebAuthn) voit, à la place des boutons, « CE NAVIGATEUR NE GÈRE PAS LES CLÉS D’ACCÈS. METS-LE À JOUR OU ESSAIE UN AUTRE APPAREIL. »
- **Créer un compte** : nom affiché, la même ligne discrète, puis « CRÉER MON COMPTE » (Face ID, empreinte ou code du téléphone ; sur un ordinateur sans rien de tout ça, le navigateur propose un QR code à scanner avec son téléphone) ; ensuite « CRÉER TON PREMIER GROUPE » si on n'en a aucun.
- **Invitation** (`/invitation/<jeton>`) : « TU ES INVITÉ·E DANS « … » » + REJOINDRE.
  - Livré : connecté sans être membre, « REJOINDRE » (le groupe devient l'affiché) et « PAS MAINTENANT » (retour à l'accueil) ; déjà membre, « TU ES DÉJÀ DANS « … » » + « Y ALLER » (bascule sur ce groupe) ; sans compte, la connexion en variante invitation ; lien invalide, « CE LIEN N’EST PLUS VALABLE » + « ALLER À L’ACCUEIL ».
- Livré (Groupe) : retirer un membre ou quitter passe par un ticket de confirmation dans la DA ; quitter en étant le dernier annonce la suppression du groupe et de sa liste. Après un renommage ou un retrait, le focus va sur le titre « MEMBRES ».
- **Groupe** (« MEMBRES ET INVITATION ») : nom (modifiable), membres (nom, « toi », depuis quand), « COPIER LE LIEN D'INVITATION », « RÉGÉNÉRER LE LIEN », « RETIRER » à côté de chaque membre, « QUITTER LE GROUPE ».
- **Mon compte** : nom affiché, passkeys (en ajouter / liste / supprimer), Google (lié ou non), **appareils connectés** (déconnecter un appareil), « SE DÉCONNECTER », « SUPPRIMER MON COMPTE » (confirmation forte).
  - Livré (morceau 5, `/compte`, sans pastille) : « TON PRÉNOM », « TES CLÉS D’ACCÈS », « TES APPAREILS », « SE DÉCONNECTER », « SUPPRIMER MON COMPTE ». Google viendra avec le morceau 4.
  - Une passkey est nommée par le serveur d'après l'appareil qui la crée (« iPhone · Safari »), jamais par le texte du client ; une ancienne sans nom s'affiche « CLÉ D’ACCÈS ». **La dernière ne se supprime pas** (« GARDE AU MOINS UNE CLÉ D’ACCÈS ») tant que Google n'existe pas : ce serait se fermer la porte. Le morceau 4 la permettra si Google est lié.
  - « DÉCONNECTER » un appareil est **immédiat** pour les pages et les actions, qui relisent la session en base : sa page suivante est la connexion. Seul le proxy garde son cache de 5 minutes (fichiers, décision rapide). Déconnecter cet appareil-ci revient à se déconnecter.
  - Se déconnecter oublie le groupe affiché sur l'appareil (cookie `ww_group`) : un autre compte sur le même téléphone n'en hérite pas.
  - Confirmation forte : taper son prénom exact (casse comprise, espaces et apostrophes typographiques tolérés), puis « SUPPRIMER DÉFINITIVEMENT », inactif jusque-là.

Le détail visuel de ces écrans est laissé au builder, dans la DA, vérifié sur les 6 formats habituels.

## 10. Supprimer son compte

- Supprime le compte, ses passkeys, ses sessions, ses BOF ; le retire de ses groupes (un groupe devenu vide disparaît).
- Les films qu'il a ajoutés restent dans les listes de ses groupes, attribués à « un ancien membre ».
- Livré (morceau 5) : en **une transaction**, pour chaque groupe la même sortie que « QUITTER » (ses « voulu » partent, le groupe aussi s'il se vide), puis ses BOF, ses « ajouté par » et « marqué par » remis à personne (« un ancien membre »), ses passkeys, ses sessions et le compte. Rien d'un autre membre ni d'un autre groupe n'est touché. L'appareil est ensuite déconnecté et va sur la connexion.

## 11. Bascule de la prod (1.3.x → 2.0.0)

- La liste actuelle devient **un groupe « NOUS DEUX »** (renommable), avec tous ses films, statuts et dates.
- Les anciens films **refusés** (BOF ou retirés) deviennent des films **écartés pour ce groupe** : rien ne réapparaît au swipe. *(Choix de conception.)*
- Les anciens ajouts n'ont pas d'auteur (« ajouté le 12 octobre »).
- Ce groupe n'a d'abord **aucun membre** ; les comptes créés avec le **code propriétaire** (`OWNER_CODE`) le **rejoignent automatiquement**. Le mainteneur crée son compte avec ce code, puis invite l'autre membre par le lien du groupe (ou lui donne le code). *(Choix de conception.)*
- Le code d'accès est retiré ; les anciens cookies sont ignorés (on arrive sur la connexion).
- Migration **additive** : les données sont **copiées** dans les nouvelles tables, la table `movies` actuelle reste intacte. Ainsi, si le test de fumée échoue, le retour arrière automatique de la CI remet la 1.3.x sur une base qu'elle sait encore lire. L'ancienne table et le code d'accès sont supprimés dans une version suivante (2.1). *(Choix de conception.)*
- Le test de fumée (`scripts/smoke-prod.sh`) vise `/unlock` : il est adapté à la 2.0 (page de connexion).
- Sauvegarde habituelle de la CI avant migration ; le builder répète la migration sur une copie de la base de prod avant la bascule.

## 12. Sécurité

- **Autorisation partout** : chaque Server Action et chaque page vérifient la session **et** l'appartenance au groupe visé (remplace `assertUnlocked()`). Tests dédiés : un membre d'un groupe ne peut ni lire ni modifier un autre groupe en forgeant un identifiant.
- **Limites de tentatives** : création de compte, code propriétaire, rejoindre par lien, connexion ; stockées en base (fonctions serverless).
- Protections CSRF et cookies de Better Auth ; en-têtes de sécurité (CSP raisonnable, `frame-ancestors`, etc.).
- Secrets : `BETTER_AUTH_SECRET`, identifiants Google, `OWNER_CODE` ; jamais commités ni affichés (comme aujourd'hui).
- La route du cron reste protégée par `CRON_SECRET`.
- Un audit de sécurité ciblé clôt la version avant la bascule.

## 13. Découpage et façon de livrer

Branche `release/2.0.0` depuis `main` ; un morceau = une branche `feat/v2-…` → **PR vers `release/2.0.0`**, CI complète (checks + e2e) obligatoire, relue par le mainteneur, fusionnée en squash avec un titre Conventional Commits. `main` et la prod restent en 1.3.x pendant ce temps. Chaque morceau laisse `release/2.0.0` **fonctionnelle de bout en bout** (tests verts, appli utilisable en local).

1. **Comptes et passkeys** : Better Auth, créer un compte (nom + passkey), se connecter, se déconnecter, `OWNER_CODE` ; remplace le code d'accès et `assertUnlocked()`. Une liste unique encore, derrière la connexion.
2. **Groupes** : modèle de données (films partagés, liste par groupe, décisions par personne), pastille et panneau, création, groupe affiché, swipe « un oui suffit, BOF pour soi », qui a fait quoi ; **migration** de la liste actuelle.
3. **Invitations et inscription** : lien, régénération, rejoindre, quitter, retirer un membre, écran « membres » ; `SIGNUP`.
4. **Google** : connexion, liaison depuis « Mon compte », vérification dans la PWA iPhone.
5. **Mon compte** : nom, passkeys (ajouter / supprimer), Google, appareils connectés, suppression du compte.
6. **Blindage et bascule** : limites de tentatives, en-têtes, audit, README et `CLAUDE.md` à jour, répétition de la migration sur une copie de la prod, puis fusion de `release/2.0.0` dans `main` (commit de fusion, avec au moins un commit `feat!` pour que release-please publie la **2.0.0**).

## 14. Tests

- Comme d'habitude : logique pure en unitaire, actions serveur et base en fonctionnel (`tests/functional/`), parcours en e2e (`e2e/`), captures de référence pour les nouveaux écrans.
- Les passkeys se testent en e2e avec l'**authentificateur virtuel WebAuthn** de Chromium (Playwright via CDP) ; pour les profils sans lui (WebKit), la fixture `app` crée la session directement en base. Google se teste avec un faux fournisseur OAuth (comme le faux TMDB).
- Parcours e2e clés : créer un compte par passkey, rejoindre un groupe par lien, swipe à deux (oui + BOF), changer de groupe, isolation entre groupes, supprimer son compte.

## 15. Laissé au builder

- Schéma exact des tables (en respectant §6-§8 et §11), noms des routes, découpage en modules et ports.
- Intégration de Better Auth (plugins, adaptateur Drizzle), dans les couches existantes.
- Détail visuel des écrans, dans la DA.
- Valeurs exactes des limites de tentatives et des durées.
