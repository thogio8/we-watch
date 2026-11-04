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
- Le code d'accès (`ACCESS_CODE`, cookie `ww_access`, `/unlock`) **disparaît** de l'appli (la variable est retirée dans une version suivante, §11).

## 6. Groupes

- Un groupe a un **nom** (modifiable par tout membre) et des **membres**, tous égaux.
- Tout membre peut : swiper, ajouter, retirer, marquer vu / à revoir, tirer, **inviter**, **retirer un membre**, renommer le groupe, **quitter** le groupe.
- Un groupe **disparaît avec son dernier membre** (sa liste aussi).
- **Groupe affiché** : celui choisi dans la pastille (§9), mémorisé sur l'appareil ; par défaut le dernier utilisé, sinon le premier. *(Choix de conception.)*
- **Aucun groupe** (nouveau compte en mode `open`, ou après avoir quitté le dernier) : écran « CRÉER TON PREMIER GROUPE ».
- La session de tirage (pile « pas ce soir », filtres) est **propre à chaque groupe** : changer de groupe ne mélange pas les piles. *(Choix de conception.)*
- Livré (morceau 3, décisions du mainteneur du 2026-10-29) : un membre qui quitte le groupe ou en est retiré perd ses « voulu » dans ce groupe ; ses ajouts et ses « marqué par » restent, avec son prénom. Le dernier membre qui part supprime le groupe avec sa liste (pas les instantanés TMDB ni les BOF).

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

- **Pastille du groupe (option A, choisie)** : au-dessus du titre de TIRER, SWIPER et LISTE, « ● NOM DU GROUPE ▾ ». La toucher ouvre un panneau : mes groupes (avec le nombre de membres, ✓ sur le groupe affiché), « + CRÉER UN GROUPE », « MEMBRES ET INVITATION », puis « MON COMPTE » et « SE DÉCONNECTER ». *(Ces deux dernières entrées : choix de conception.)*
- **Connexion** : un ticket « ENTRE DANS WEWATCH », dessous une ligne discrète « Face ID, empreinte ou code de ton téléphone », puis « SE CONNECTER », « CONTINUER AVEC GOOGLE » (sauf PWA iPhone si §5 l'exige), et « CRÉER UN COMPTE ». En mode `invite`, « CRÉER UN COMPTE » n'apparaît qu'en arrivant par une invitation ; ailleurs, un message clair (« WEWATCH SE REJOINT SUR INVITATION ») et un lien discret « J'AI UN CODE PROPRIÉTAIRE », affiché seulement si `OWNER_CODE` est réglé (sinon tout code serait refusé ; il suffit de le remettre dans Vercel pour rouvrir cette porte). Validation annulée : « VALIDATION ANNULÉE, RÉESSAIE ». Un navigateur sans passkeys (pas de WebAuthn) voit, à la place des boutons, « CE NAVIGATEUR NE GÈRE PAS LES CLÉS D’ACCÈS. METS-LE À JOUR OU ESSAIE UN AUTRE APPAREIL. »
- **Créer un compte** : nom affiché, la même ligne discrète, puis « CRÉER MON COMPTE » (Face ID, empreinte ou code du téléphone ; sur un ordinateur sans rien de tout ça, le navigateur propose un QR code à scanner avec son téléphone) ; ensuite « CRÉER TON PREMIER GROUPE » si on n'en a aucun.
- **Invitation** (`/invitation/<jeton>`) : « TU ES INVITÉ·E DANS « … » » + REJOINDRE.
  - Livré : connecté sans être membre, « REJOINDRE » (le groupe devient l'affiché) et « PAS MAINTENANT » (retour à l'accueil) ; déjà membre, « TU ES DÉJÀ DANS « … » » + « Y ALLER » (bascule sur ce groupe) ; sans compte, la connexion en variante invitation ; lien invalide, « CE LIEN N’EST PLUS VALABLE » + « ALLER À L’ACCUEIL ».
- Livré (Groupe) : retirer un membre ou quitter passe par un ticket de confirmation dans la DA ; quitter en étant le dernier annonce la suppression du groupe et de sa liste. Après un renommage ou un retrait, le focus va sur le titre « MEMBRES ».
- **Groupe** (« MEMBRES ET INVITATION ») : nom (modifiable), membres (nom, « toi », depuis quand), « COPIER LE LIEN D'INVITATION », « RÉGÉNÉRER LE LIEN », « RETIRER » à côté de chaque membre, « QUITTER LE GROUPE ».
- **Mon compte** : nom affiché, passkeys (en ajouter / liste / supprimer), Google (lié ou non), **appareils connectés** (déconnecter un appareil), « SE DÉCONNECTER », « SUPPRIMER MON COMPTE » (confirmation forte).
  - Livré (morceau 5, `/compte`, sans pastille) : « TON PRÉNOM », « TES CLÉS D’ACCÈS », « TES APPAREILS », « SE DÉCONNECTER », « SUPPRIMER MON COMPTE ». Google viendra avec le morceau 4.
  - Livré (2.0.x, après un audit de sécurité) : ajouter une clé, en supprimer une et supprimer son compte exigent une **session récente** (ouverte depuis moins de 10 minutes, âge lu en base) : un téléphone resté déverrouillé et connecté, avec une session de 60 jours, ne doit pas suffire. Une session plus ancienne est refusée ; l'appli redemande la clé d'accès de l'appareil (Face ID, empreinte, code) puis refait l'opération d'elle-même, sans recliquer. La session de cet appareil est alors remplacée (l'ancienne déconnectée, pas de doublon dans « TES APPAREILS »), le groupe affiché et l'écran restent. Clé d'accès annulée : « CONFIRME AVEC TA CLÉ D’ACCÈS POUR CONTINUER », rien n'est fait.
  - Une passkey est nommée par le serveur d'après l'appareil qui la crée (« iPhone · Safari »), jamais par le texte du client ; une ancienne sans nom s'affiche « CLÉ D’ACCÈS ». **La dernière ne se supprime pas** (« GARDE AU MOINS UNE CLÉ D’ACCÈS ») tant que Google n'existe pas : ce serait se fermer la porte. Le morceau 4 la permettra si Google est lié.
  - « DÉCONNECTER » un appareil est **immédiat** pour les actions et les pages rendues par le serveur, qui relisent la session en base : ses actions sont refusées aussitôt (le client recharge alors la connexion), et une page pas encore en cache sur l'appareil renvoie vers la connexion. Une page déjà en cache côté client (`staleTimes`, 5 minutes) peut encore s'afficher jusqu'à 5 minutes, sans rien pouvoir changer. Seul le proxy garde son cache de 5 minutes (fichiers, décision rapide). Déconnecter cet appareil-ci revient à se déconnecter. Une inscription avec ticket sur un appareil déconnecté ainsi crée son compte normalement.
  - Se déconnecter oublie le groupe affiché sur l'appareil (cookie `ww_group`) : un autre compte sur le même téléphone n'en hérite pas.
  - Confirmation forte : taper son prénom exact (casse comprise, espaces et apostrophes typographiques tolérés), puis « SUPPRIMER DÉFINITIVEMENT », inactif jusque-là.

Le détail visuel de ces écrans est laissé au builder, dans la DA, vérifié sur les 6 formats habituels.

## 10. Supprimer son compte

- Supprime le compte, ses passkeys, ses sessions, ses BOF ; le retire de ses groupes (un groupe devenu vide disparaît).
- Les films qu'il a ajoutés restent dans les listes de ses groupes, attribués à « un ancien membre ».
- Livré (morceau 5) : en **une transaction**, pour chaque groupe la même sortie que « QUITTER » (ses « voulu » partent, le groupe aussi s'il se vide), puis ses BOF, ses « ajouté par » et « marqué par » remis à personne (« un ancien membre »), ses passkeys, ses sessions et le compte. Rien d'un autre membre ni d'un autre groupe n'est touché. L'appareil est ensuite déconnecté et va sur la connexion.

## 11. Bascule de la prod (1.3.x → 2.0.0)

- Faite le 2026-11-03 : la liste d'avant les comptes est devenue un groupe comme les autres, sans auteur pour ses anciens ajouts (« ajouté avant les comptes »). Restes à supprimer dans une version suivante : la table `movies`, les colonnes `legacy` / `watched_legacy` et `ACCESS_CODE` dans Vercel.
- Le code propriétaire (`OWNER_CODE`) n'ouvre plus qu'une inscription, sans groupe : il amorce une instance neuve, puis se retire de Vercel.

## 12. Sécurité

- **Autorisation partout** : chaque Server Action et chaque page vérifient la session **et** l'appartenance au groupe visé (remplace `assertUnlocked()`). Tests dédiés : un membre d'un groupe ne peut ni lire ni modifier un autre groupe en forgeant un identifiant.
- **Limites de tentatives** : création de compte, code propriétaire, rejoindre par lien, connexion ; stockées en base (fonctions serverless).
- Protections CSRF et cookies de Better Auth ; en-têtes de sécurité (CSP raisonnable, `frame-ancestors`, etc.).
- Secrets : `BETTER_AUTH_SECRET`, identifiants Google, `OWNER_CODE` ; jamais commités ni affichés (comme aujourd'hui).
- La route du cron reste protégée par `CRON_SECRET`.
- Un audit de sécurité ciblé clôt la version avant la bascule.
- Livré (morceau 6) : limites de tentatives en base (table `rate_limit`, fenêtre fixe comptée avant toute validation, refus « TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT. ») : par IP et chemin pour les cérémonies passkey (Better Auth, sur 10 min : 30 demandes de connexion, 20 vérifications, 10 + 10 pour enregistrer une clé), par IP pour l'inscription (10 par 10 min) et le code propriétaire (5 par 15 min, sans seau commun à toutes les IP : une attaque ne doit pas fermer la seule porte de la bascule), par compte pour créer un groupe (10 par heure), rejoindre (20), changer de prénom (20), supprimer une clé (10) et supprimer son compte (5). Valeurs : `src/domain/rate-limit.ts` et `src/auth/rate-limits.ts`.
- Livré (morceau 6) : seuls les chemins Better Auth de l'appli répondent (`AUTH_PATHS`), tout autre chemin sous `/api/auth` répond 404 ; contrôle d'origine forcé en production. En-têtes sur toute réponse : CSP **statique** (un nonce exige un rendu par requête, incompatible avec le prérendu partiel : `'unsafe-inline'` pour les scripts), `frame-ancestors 'none'`, HSTS, `nosniff`, `X-Frame-Options`, COOP, `Permissions-Policy`, sans `X-Powered-By`. Cookie `ww_group` `secure` dès que `BETTER_AUTH_URL` est en https. Le cron fait chaque jour le ménage des lignes d'authentification expirées et des vieux compteurs.
- Livré (morceau 6) : sauvegarde chiffrée (AES-256-GCM, `BACKUP_KEY`), comptes compris sans leurs jetons, jamais les sessions ; secrets de la CI posés sur la seule étape qui s'en sert, jeton du workflow en lecture seule, actions épinglées par commit, CLI Vercel épinglée. Audit : `docs/security-audit-2.0.md` (0 critique, 0 haute ; la moyenne et les 4 faibles corrigées, 2 informatifs corrigés et 4 acceptés avec leur raison, comme le risque résiduel du build de prod).

## 13. Découpage et façon de livrer

Branche `release/2.0.0` depuis `main` ; un morceau = une branche `feat/v2-…` → **PR vers `release/2.0.0`**, CI complète (checks + e2e) obligatoire, relue par le mainteneur, fusionnée en squash avec un titre Conventional Commits. `main` et la prod restent en 1.3.x pendant ce temps. Chaque morceau laisse `release/2.0.0` **fonctionnelle de bout en bout** (tests verts, appli utilisable en local).

1. **Comptes et passkeys** : Better Auth, créer un compte (nom + passkey), se connecter, se déconnecter, `OWNER_CODE` ; remplace le code d'accès et `assertUnlocked()`. Une liste unique encore, derrière la connexion.
2. **Groupes** : modèle de données (films partagés, liste par groupe, décisions par personne), pastille et panneau, création, groupe affiché, swipe « un oui suffit, BOF pour soi », qui a fait quoi ; **migration** de la liste actuelle.
3. **Invitations et inscription** : lien, régénération, rejoindre, quitter, retirer un membre, écran « membres » ; `SIGNUP`.
4. **Google** : connexion, liaison depuis « Mon compte », vérification dans la PWA iPhone.
5. **Mon compte** : nom, passkeys (ajouter / supprimer), Google, appareils connectés, suppression du compte.
6. **Blindage et bascule** : limites de tentatives, en-têtes, audit, README et `CLAUDE.md` à jour, répétition de la migration sur une copie de la prod, puis fusion de `release/2.0.0` dans `main` (commit de fusion, avec au moins un commit `feat!` pour que release-please publie la **2.0.0**).

- Livré (morceau 6, avant la bascule) : limites, chemins et en-têtes (§12), ménage du cron, test de fumée 2.0 (connexion, en-têtes, `rpId`, inscription sur invitation, autre origine refusée, cron), mise en ligne qui attend que la prod serve le nouveau déploiement, sauvegarde chiffrée, restauration et rattrapage d'un retour en 1.3.x, répétition de la migration sur la sauvegarde de prod du 2026-10-28 (208 films, tous copiés à l'identique), audit. Restauration : `docs/restauration.md`.
- **2.0.0 livrée sans Google** (décision du mainteneur, 2026-11-03) : les passkeys suffisent à la bascule ; le morceau 4 (Google) viendra après, dans une version 2.x, sans rupture (un chemin de plus dans `AUTH_PATHS`, ses identifiants OAuth dans Vercel, le test sur un vrai iPhone). D'ici là, la dernière passkey ne se supprime pas.

## 14. Tests

- Comme d'habitude : logique pure en unitaire, actions serveur et base en fonctionnel (`tests/functional/`), parcours en e2e (`e2e/`), captures de référence pour les nouveaux écrans.
- Les passkeys se testent en e2e avec l'**authentificateur virtuel WebAuthn** de Chromium (Playwright via CDP) ; pour les profils sans lui (WebKit), la fixture `app` crée la session directement en base. Google se teste avec un faux fournisseur OAuth (comme le faux TMDB).
- Parcours e2e clés : créer un compte par passkey, rejoindre un groupe par lien, swipe à deux (oui + BOF), changer de groupe, isolation entre groupes, supprimer son compte.

## 15. Laissé au builder

- Schéma exact des tables (en respectant §6-§8 et §11), noms des routes, découpage en modules et ports.
- Intégration de Better Auth (plugins, adaptateur Drizzle), dans les couches existantes.
- Détail visuel des écrans, dans la DA.
- Valeurs exactes des limites de tentatives et des durées.

## 16. 2.1.0 · Coups de cœur

- Un groupe marque des films « à voir » comme **coups de cœur** (♡ / ♥ sur la LISTE, tampon sur la fiche), les retrouve en tête de liste, et peut ne **tirer que parmi eux** (filtre « ♥ NOS COUPS DE CŒUR » de TIRER).
- Spec détaillée : `2026-11-04-coups-de-coeur-design.md`, qui complète celle-ci. Migration additive `0012` (`group_movie.favorite_at`, `favorite_by`), action `setFavorite` non limitée.
