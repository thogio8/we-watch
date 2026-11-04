# Failles des dépendances · point du 2026-11-04

Toutes les failles connues sont dans des dépendances **de développement** (outils de build, de test, de lint, CLI Vercel), aucune dans le code servi. Les copies corrigeables **dans leur version majeure** sont corrigées par des `overrides` (`package.json`) ; les autres sont écartées ci-dessous, avec leur risque.

`npm audit` : 56 (1 critique, 22 hautes, 33 modérées) → 41 (0 critique, 10 hautes, 31 modérées). `npm audit --omit=dev` : 4 modérées, inchangé (esbuild via `drizzle-kit`, voir plus bas) ; `npm audit --omit=dev --omit=optional` : 0. Les 41 restantes ne sont que les écarts de ce tableau, comptées une fois par paquet qui les embarque.

## Règles

- Un override par version majeure (`"tar@7": "^7.5.21"`) : il ne touche que les copies de cette majeure, jamais une autre (`ajv@6` d'ESLint, `zod@3` de la CLI Vercel restent les leurs).
- Aucune montée de version majeure par override. Pour esbuild en `0.x`, chaque version mineure est une majeure (`0.18` → `0.25` en est une).
- Preuve que la CLI Vercel marche encore : `vercel build --prod` hors du dépôt, avec un `.vercel/project.json` factice et des variables factices, binaire natif et CLI JavaScript (`VERCEL_CLI_USE_NATIVE_BINARY=0`, qui charge les paquets du lockfile) : même `.vercel/output` qu'avant les overrides.
- `"zod@4": "$zod"` suit la `zod` de l'appli (npm refuse un override différent d'une dépendance directe) : à retirer ou réécrire si l'appli change de version majeure de `zod`, sinon `$zod` ferait monter d'une majeure les copies `zod@4` de la CLI Vercel.
- À revoir à chaque montée de la CLI Vercel, d'ESLint, de Stryker, de Lighthouse ou de `drizzle-kit` ; un override se retire dès que l'outil embarque la version corrigée.

## Corrigées

| Paquet | Avant → après | Avis | Amené par |
| --- | --- | --- | --- |
| `tar@7` | 7.5.11 → 7.5.22 | GHSA-23hp-3jrh-7fpw (critique), GHSA-8x88-c5mf-7j5w, GHSA-r292-9mhp-454m, GHSA-vmf3-w455-68vh, GHSA-w8wr-v893-vjvp, GHSA-gvwx-54wh-qm9j | `vercel` (`@vercel/container`, `@vercel/nft`) |
| `js-yaml@4` | 4.1.1 → 4.3.2 | GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh, GHSA-h67p-54hq-rp68 | `vercel` (`@vercel/python-analysis`) |
| `path-to-regexp@6` | 6.1.0 → 6.3.0 | GHSA-9wv6-86v2-598j | `vercel` (`@vercel/node`, `@vercel/remix-builder`) |
| `path-to-regexp@8` | 8.3.0 → 8.4.2 | GHSA-j3q9-mxjg-w52f, GHSA-27v5-c462-wpq7 | `vercel` (`@vercel/backends`, `express`, `hono`) |
| `smol-toml@1` | 1.5.2 → 1.9.1 | GHSA-7w5x-hrqm-74c2, GHSA-v3rj-xjv7-4jmq, GHSA-r4xh-jqrq-34v2 | `vercel` |
| `ajv@8` | 8.6.3 → 8.20.0 | GHSA-2g4f-4pwh-qvx6 | `vercel` (`@vercel/static-config`) |
| `zod@4` | 4.1.11 → 4.6.7 (`$zod`, la version de l'appli) | GHSA-mrhx-c7xc-m3w5 | `vercel` (`@vercel/cli-config`, `@vercel/sandbox`) |
| `minimatch@10` | 10.1.1 → 10.2.6 (3 avis hauts sur 4) | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 | `vercel` (`@vercel/python-analysis`) |

## Écartées

| Paquet (copie) | Amené par | Avis | Pourquoi pas corrigé | Risque chez nous |
| --- | --- | --- | --- | --- |
| `undici@5` (5.28.4, 5.29.0) | `vercel`, `@vercel/node` | 18 avis, dont GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm, GHSA-vrm6-8vpv-qv8q, GHSA-v9p9-hfj2-hcw8, GHSA-vxpw-j846-p89q (hauts) | Corrigé seulement en 6.29.1 : montée majeure. Les copies 6, 7 et 8 sont déjà corrigées. | Client HTTP de la CLI, qui ne parle qu'à l'API Vercel (CI, job `build`) et à `@vercel/node` (`vercel dev`, jamais lancé). Pas d'entrée non fiable. |
| `@fastify/busboy@2` (2.1.1) | `undici@5` | GHSA-x8mw-p69m-v3mx (haute), GHSA-gxm5-99cw-xjw9 | GHSA-x8mw-p69m-v3mx corrigé en 3.2.1, GHSA-gxm5-99cw-xjw9 en 3.2.2 : montée majeure, liée à `undici@5`. | Analyse les envois multipart reçus par `undici@5` : la CLI n'en reçoit aucun. |
| `zod@3` (3.22.4) | `vercel` (`@vercel/backends`, `express`, `hono`, `python-analysis`) | GHSA-mrhx-c7xc-m3w5 (haute) | Corrigé seulement en 4.6.6 : montée majeure. | Sert aux builders de backends (Express, Hono, Python) de la CLI, que notre projet Next n'utilise pas. La `zod` de l'appli est en 4.6.7. |
| `minimatch@10` (10.2.6) | ESLint, `typescript-eslint`, Stryker, `glob@13` | GHSA-g3hv-75wg-m249 (modérée) | Corrigé seulement en 11.0.1 : montée majeure. | Motifs de fichiers écrits dans nos configurations (lint, mutation, traçage des fichiers du build), pas d'entrée non fiable. |
| `glob@13` (13.0.6) | Lighthouse (`@sentry/bundler-plugins`), `@vercel/nft` | GHSA-3g3m-2fjr-6pw4 (modérée) | Corrigé seulement en 14.0.2 : montée majeure. | Annulation par `AbortSignal` ignorée : un parcours de fichiers locaux dure plus longtemps. Aucun appel annulé chez nous. |
| `esbuild@0.18` (0.18.20) | `drizzle-kit` (`@esbuild-kit/esm-loader`) | GHSA-67mh-4wv8-2f99 (modérée) | Corrigé en 0.25.0 : montée majeure en `0.x`. | L'avis porte sur le serveur de dev d'esbuild, jamais lancé ; le code de `drizzle-kit` ne charge même pas `@esbuild-kit` (dépendance déclarée, inutilisée). Seul reste de `npm audit --omit=dev` : `drizzle-kit` y figure parce qu'il est aussi un pair facultatif de `better-auth`, jamais installé en prod. Voir I3 de `security-audit-2.0.md`. |
