# Encycla — Licences

Encycla mélange du **code** (le nôtre), du **contenu** (Wikipédia, Wikidata, Wikimedia Commons), des **polices** et, en option, un **connecteur TikTok** tiers. Chacun a sa propre licence ; ce document dit laquelle et ce qu'elle impose à qui publie ou héberge le jeu.

| Élément | Où | Licence | Obligation principale |
| --- | --- | --- | --- |
| Code d'Encycla (client, serveur, scripts, tests, docs) | tout le dépôt sauf ci-dessous | **MIT** ([`LICENSE`](../LICENSE)) | Conserver la notice de copyright et de licence. |
| Textes des questions : réponses, explications, articles (fr, en, ar) | `data/questions.json` (`articleBody`, `explanation`, `translations.*`) | **CC BY-SA 4.0** (Wikipédia) | Attribution + lien vers la source et la licence ; les œuvres dérivées de ces textes restent en CC BY-SA. |
| Libellés Wikidata (repli quand une langue n'a pas d'article) | `translations.*.subject/options` avec `provenance = wikidata` | **CC0 1.0** | Aucune ; la source est tout de même tracée. |
| Images | URLs `upload.wikimedia.org` dans `data/questions.json` | Licence **de chaque fichier** : CC0, domaine public, CC BY ou CC BY-SA (versions variables) | Afficher auteur + licence + lien vers la page du fichier (fait dans l'UI et dans [`CREDITS.md`](../CREDITS.md)). |
| Polices Inter, Merriweather, Noto Sans Arabic, Noto Naskh Arabic | `@fontsource/*` (bundle client) | **SIL Open Font License 1.1** | Ne pas vendre les polices seules ; conserver la licence. |
| Dépendances npm du runtime (Express, Socket.io, React, better-sqlite3, Zod…) | `node_modules` | MIT, ISC, Apache-2.0, BSD | Conserver leurs notices (présentes dans `node_modules`). |
| **`tiktok-live-connector`** (optionnel) | `optionalDependencies` | **AGPL-3.0-only** | Voir ci-dessous. |

## 1. Le code : MIT

Le dépôt est publié sous licence MIT. Elle s'applique au code écrit pour Encycla, pas au contenu ni aux dépendances.

> Titulaire des droits : **Ishaq74** (auteur du dépôt d'origine `Ishaq74/encycla`), qui a confirmé la licence MIT, et les contributeurs d'Encycla. Notice : `Copyright (c) 2026 Ishaq74 and Encycla contributors`.

## 2. Le contenu : CC BY-SA 4.0 et licences Commons

- `data/questions.json` est une **base de données dérivée de Wikipédia**. La redistribuer (dans le dépôt, dans l'image Docker) ou l'afficher (dans le jeu) impose l'attribution CC BY-SA : chaque question garde le permalien `oldid` de la révision utilisée (`source`, et `translations.<langue>.source`), et `CREDITS.md` liste les articles.
- Un fork qui **modifie** ces textes doit publier ses modifications sous **CC BY-SA 4.0** (ou compatible). Cela ne contamine pas le code : la licence MIT du code et la licence CC BY-SA du contenu coexistent.
- Les images ne sont **pas copiées** dans le dépôt : le jeu affiche les vignettes servies par Wikimedia. Le crédit (auteur, licence, lien vers la page Commons) est affiché sous chaque image et listé dans `CREDITS.md`. Les licences non libres (NC, ND, usage loyal) sont rejetées par le générateur.
- L'image Docker embarque `LICENSE` et `CREDITS.md` à côté de `data/questions.json`.

## 3. Le connecteur TikTok : AGPL-3.0, isolé et optionnel

`tiktok-live-connector` est déclaré en **`optionalDependencies`** et n'est chargé que par `server/tiktok/liveAdapter.ts`, par un `import()` dynamique, lorsque `TIKTOK_ENABLED=true`. Aucun autre fichier ne l'importe ni n'en dépend (le reste du serveur ne connaît que l'interface `TikTokAdapter`), et le bundle serveur le laisse externe.

Conséquences :

- **Sans TikTok** (défaut) : l'image Docker est construite avec `pnpm prune --prod --no-optional` ; le paquet AGPL n'est **pas distribué** et rien ne change pour la licence MIT. La CI vérifie que l'image par défaut ne le contient pas.
- **Avec TikTok** (`docker build --build-arg WITH_TIKTOK=true`, ou `pnpm install` avec les dépendances optionnelles) : l'instance exécute et met à disposition en réseau un programme AGPL. L'opérateur doit alors respecter l'AGPL-3.0 pour ce paquet : proposer aux utilisateurs l'accès au **code source correspondant** du connecteur et de toute modification qu'il y apporterait (article 13), et conserver sa licence. Le code d'Encycla étant public sous MIT (licence compatible avec l'AGPL), la solution simple est de publier, sur l'instance, un lien vers ce dépôt et vers le dépôt du connecteur, et de ne pas modifier le paquet.
- Le connecteur est **non officiel** : son usage peut contrevenir aux conditions d'utilisation de TikTok, et il dépend du service de signature Euler Stream (clé optionnelle `TIKTOK_SIGN_API_KEY`). C'est une décision d'exploitation, pas une question de licence (voir [TIKTOK.md](TIKTOK.md)).

## 4. Ce document n'est pas un avis juridique

Il décrit les choix techniques faits pour respecter les licences. En cas de doute (usage commercial, modification du connecteur, redistribution du contenu hors du jeu), consulter un juriste.
