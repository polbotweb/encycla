# Encycla

**The visual encyclopedia game.** Identify the subject, answer before the timer, and read the story behind the image.

Encycla est un quiz visuel multijoueur en temps réel : solo, rooms privées, matchmaking public et live TikTok. La spécification est gelée ; l'implémentation des phases 0 à 9 est en place (voir [État du dépôt](#état-du-dépôt)). Restent le contenu SUBJECT, la validation manuelle sur un vrai live TikTok et la mise en production.

- **Produit** : Encycla
- **Jeu** : Encycla MindMaze
- **Langue de l'UI** : anglais
- **Langue de la documentation** : français
- **Statut** : documentation d'architecture gelée, implémentation des phases 0 à 9 en place ; contenu SUBJECT, live test TikTok et release restants
- **Gel de la documentation** : 2026-10-23
- **Version documentaire** : 2.0
- **Date** : 2026-10-22

## Sommaire

- [Pourquoi ce projet](#pourquoi-ce-projet)
- [Modes de jeu](#modes-de-jeu)
- [Architecture en un coup d'œil](#architecture-en-un-coup-dœil)
- [Documentation](#documentation)
- [État du dépôt](#état-du-dépôt)
- [Démarrage](#démarrage)
- [Structure cible](#structure-cible)
- [Configuration](#configuration)
- [Qualité et sécurité](#qualité-et-sécurité)
- [Déploiement](#déploiement)
- [Contenu](#contenu)
- [Non-objectifs v1](#non-objectifs-v1)
- [Feuille de route](#feuille-de-route)
- [Contribuer](#contribuer)
- [Licence et crédits](#licence-et-crédits)

## Pourquoi ce projet

Le prototype initial concentre toutes les règles dans un composant React : score, vies, timer, progression, gagnant. Cette architecture ne peut pas garantir l'équité, la reconnexion, l'anti-triche ou le multi-joueurs.

Encycla v2 applique quatre principes :

1. **Le serveur est la seule source de vérité.** Le client émet des intentions et affiche des snapshots.
2. **Toute partie est une room.** Le solo est une room à un joueur ; le duel CONTEST est une room à deux.
3. **Chaque règle est déterministe et testable.** Le moteur est un réducteur pur, avec horloge, aléatoire et banque de questions injectés.
4. **Aucun secret ni réponse dans le client.** La bonne réponse n'est diffusée qu'à la phase `REVEAL`.

## Modes de jeu

| | CLASSIC | SUBJECT | CONTEST |
| --- | --- | --- | --- |
| Niveaux | 10 | 1 | 1 |
| Questions | 20 par niveau | 20 | 10 |
| Joueurs | 1-8 web, 0 au départ puis jusqu'à 100 TikTok | 1-8 web, 0 au départ puis jusqu'à 100 TikTok | exactement 2 |
| Catégories | toutes | une catégorie fixe | toutes |
| Vies | 3 | 3 | aucune |
| Difficulté | progressive | choisie | Adventurer |
| Article | après chaque question | après chaque question | après chaque question |

- **Solo** : campagne CLASSIC ou SUBJECT, vies rechargées à chaque niveau.
- **Room privée** : code à 6 caractères, 2 à 8 joueurs, démarrage par le host.
- **Room publique** : matchmaking par mode, catégorie et difficulté ; small room après 2 minutes.
- **TikTok** : les viewers répondent `A`, `B`, `C` ou `D` dans le chat ; overlay OBS et console host.
- Une fin naturelle affiche l'article final avant le classement ; une fin anticipée web/solo (élimination, moins de 2 actifs) passe directement de `REVEAL` à `MATCH_OVER`. Une room TikTok ne s'arrête pas sur `< 2` actifs.

## Architecture en un coup d'œil

```text
Navigateur joueur ─┐
Overlay OBS ───────┼── HTTP / Socket.io ──► Express + Socket.io
Console host ──────┘                              │
                                                  ▼
                                         RoomManager (mémoire)
                                                  │
                                                  ▼
                                         Moteur pur (reduce/tick)
                                                  │
                        ┌─────────────────────────┼─────────────────────┐
                        ▼                         ▼                     ▼
                   SQLite (scores)          JSON (questions)      TikTok adapter
```

- **HTTP** : sessions, rooms, file, leaderboard, santé, administration.
- **Socket.io** : entrée de room, ready, start, réponses, continuation, pause, votes, snapshots.
- **SQLite** : sessions, matchs, scores, questions approuvées ; fallback mémoire si indisponible.
- **Moteur** : aucune I/O, aucun accès réseau, aucune dépendance au transport.
- **Client** : React + Zustand, aucune règle de jeu.

## Documentation

La documentation est la référence d'implémentation. Aucune décision ouverte n'est laissée au développeur.

| Document | Contenu |
| --- | --- |
| [docs/ADR.md](docs/ADR.md) | 18 décisions d'architecture binding. |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 79 décisions explicites et dettes assumées. |
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | Règles, modes, phases, scores, matchmaking, TikTok. |
| [docs/PROTOCOL.md](docs/PROTOCOL.md) | Contrat HTTP, Socket.io, payloads, erreurs. |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Schéma SQLite, JSON des questions, leaderboard. |
| [docs/SECURITY.md](docs/SECURITY.md) | Menace, authentification, CSP, secrets, vie privée. |
| [docs/TESTING.md](docs/TESTING.md) | Pyramide, cas obligatoires, couverture, CI. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Local, Docker, TLS, migrations, runbook. |
| [docs/UI-UX.md](docs/UI-UX.md) | Écrans, tokens, accessibilité, overlay, control. |
| [docs/TIKTOK.md](docs/TIKTOK.md) | État de l'implémentation TikTok, activation du connecteur, checklist de live. |
| [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) | Phases, dépendances, estimation, critères de sortie. |

Ordre de lecture recommandé :

1. ce README ;
2. `ADR.md` puis `DECISIONS.md` ;
3. `SPECIFICATION.md` ;
4. `PROTOCOL.md` et `DATA-MODEL.md` ;
5. `SECURITY.md`, `TESTING.md`, `UI-UX.md` ;
6. `IMPLEMENTATION-PLAN.md` et `DEPLOYMENT.md`.

## État du dépôt

Les phases 0 à 9 sont implémentées et vérifiées automatiquement :

- **Outillage** : pnpm (lockfile gelé), TypeScript strict, ESLint, Prettier, Vitest, Playwright, CI (secrets, format, lint, types, données, tests, audit, build, e2e, build Docker).
- **Données** : `data/questions.json` (2 496 questions en français générées depuis Wikipédia et Wikimedia Commons par `pnpm run data:wikipedia`, validées par `pnpm run data:validate`) et import SQLite atomique.
- **Moteur** (`server/game`) : réducteur pur `reduce`/`tick`, scoring, state machine, effets sous forme de données.
- **Serveur** : Express 5 + Socket.io (`/game`), `RoomManager`, sessions hachées, persistance SQLite avec repli mémoire, leaderboard, matchmaking public avec vote small room, reconnexion, fermeture admin, rate limiting HTTP et socket, CSP stricte, HSTS, Permissions-Policy.
- **TikTok** (`server/tiktok`) : parsing strict, connecteur avec backoff, faux adaptateur, route `POST /api/tiktok/rooms`, viewers (capacité 100, déduplication), overlay en lecture seule et console control. Le connecteur réel n'est pas livré par défaut : voir [docs/TIKTOK.md](docs/TIKTOK.md).
- **Client** (`client/`) : React 19 + Zustand, toutes les vues de `docs/UI-UX.md` (accueil, lobby, file publique, countdown, question, révélation, article, fin de niveau, résultats, leaderboard, overlay, control), tokens sombres AA, annonces `aria-live`, raccourcis clavier, sons synthétisés en WebAudio (aucun fichier audio).
- **Livraison** : `Dockerfile` multi-stage non-root avec healthcheck, `docker-compose.yml` durci, bundle serveur `dist/server/index.js`.
- **Tests** : unitaires, intégration Socket.io de bout en bout (CONTEST complet, solo, file publique, vote small room, reconnexion, room TikTok à 100 viewers), sécurité HTTP, jsdom + axe pour les vues, Playwright (solo, deux joueurs, axe avec contraste), test de charge `pnpm run test:load`.

Ce qui reste, et qui ne peut pas être fait sans décision ou sans compte externe :

- **SUBJECT** reste désactivé pour les 18 catégories (12 à 16 questions, seuil 20) : la rédaction éditoriale n'a pas été inventée (phase 10).
- **Live TikTok** : le connecteur réel doit être validé sur un compte secondaire (1 h, 20 viewers) ; sa licence AGPL et son service de signature tiers imposent une décision explicite.
- **Accessibilité manuelle** (NVDA, VoiceOver, contraste réel de l'overlay sur le flux OBS) et **déploiement TLS** ne sont pas automatisables.
- 234 articles restent sous la cible éditoriale de 200 caractères et les licences d'images legacy restent à revoir.
- La couverture client est inférieure à l'objectif de 70 % (voir `pnpm run test:coverage`) ; les seuils serveur (95 % branches `server/game`, 80 % `server`) sont atteints.

## Démarrage

Prérequis : Node.js 22 et pnpm 10.28 (ou `corepack enable`).

```bash
git clone <repo>
cd encycla
pnpm install --frozen-lockfile
cp .env.example .env
pnpm run dev
```

- Client : `http://localhost:5173`
- Serveur : `http://localhost:3000`
- Le client Vite proxy `/api` et `/socket.io` vers le serveur.
- Les migrations et la synchronisation des questions sont appliquées au démarrage du serveur ; `pnpm run db:migrate` et `pnpm run data:import` restent disponibles.

Production locale :

```bash
pnpm run build   # dist/client (Vite) + dist/server (bundle esbuild)
NODE_ENV=production ADMIN_TOKEN=<32+ caractères> PUBLIC_ORIGIN=https://exemple.test pnpm start
```

Vérifications :

```bash
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build
pnpm run test:e2e                        # Playwright, build de production
RATE_LIMIT=off pnpm start &              # puis, dans un autre terminal :
BASE_URL=http://localhost:3000 pnpm run test:load
```

## Structure cible

```text
client/          React, Zustand, vues, styles, assets
server/          Express, Socket.io, moteur, rooms, persistance, TikTok
shared/          types, schémas Zod, constantes, protocole
data/            questions.json, base SQLite non versionnée
scripts/         extraction, validation, import, génération de contenu, charge
tests/           unitaires, intégration, e2e, fixtures
docs/            documentation de référence
```

Détail complet dans [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md).

## Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `NODE_ENV` | `development` | Environnement. |
| `PORT` | `3000` | Port HTTP/Socket.io. |
| `PUBLIC_ORIGIN` | — | Origin public en production. |
| `DATABASE_PATH` | `data/encycla.db` | Base SQLite. |
| `ADMIN_TOKEN` | — | Routes admin et création TikTok. |
| `TIKTOK_ENABLED` | `false` | Active le connecteur. |
| `TIKTOK_USERNAME` | — | Compte TikTok du live. |
| `TIKTOK_SESSION_COOKIE` | — | Cookie de session TikTok. |
| `GEMINI_API_KEY` | — | Scripts de contenu hors ligne uniquement. |
| `LOG_LEVEL` | `info` | Verbosité des logs. |
| `TRUST_PROXY` | `false` | `true` derrière un seul reverse proxy. |
| `STATIC_DIR` | `dist/client` | Build Vite servi par Express. |
| `RATE_LIMIT` | `on` | `off` pour les tests de charge ; refusé en production. |

Règles :

- `.env` n'est jamais commité.
- Aucune variable secrète n'est préfixée `VITE_`.
- `GEMINI_API_KEY` n'est jamais montée dans le runtime de jeu.
- `TIKTOK_USERNAME` et `TIKTOK_SESSION_COOKIE` sont obligatoires si `TIKTOK_ENABLED=true`.
- Le serveur refuse de démarrer en production sans `ADMIN_TOKEN` et `PUBLIC_ORIGIN`.

## Qualité et sécurité

### Qualité

- TypeScript strict.
- ESLint + Prettier.
- Vitest pour le moteur, le serveur et le client.
- Playwright pour les parcours multi-joueurs.
- Couverture minimale : 95 % branches sur `server/game`, 80 % sur `server`, 70 % sur `client`.
- CI : lint, typecheck, données, tests, build, e2e, audit, secrets.

### Sécurité

- Aucun secret dans le bundle client.
- Tokens de session hachés en base.
- Tokens overlay/control scoped à une room, dans le fragment d'URL.
- CSP stricte, pas de `unsafe-inline`, pas de `unsafe-eval`.
- Aucun `dangerouslySetInnerHTML`.
- Validation Zod de toutes les entrées.
- Rate limiting HTTP et Socket.io.
- La bonne réponse n'est jamais envoyée avant `REVEAL`.
- Images limitées à une allowlist HTTPS.

Détail dans [docs/SECURITY.md](docs/SECURITY.md).

## Déploiement

- Une seule instance Node et SQLite local en v1.
- Docker multi-stage, runtime non-root.
- Reverse proxy TLS (Caddy ou Nginx).
- Migrations et synchronisation JSON → SQLite au démarrage ; `pnpm run data:import` reste disponible pour un import manuel.
- Sauvegarde SQLite par `VACUUM INTO`.
- Un redémarrage perd les rooms ; les matchs en cours deviennent `abandoned`.

Procédure complète dans [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Contenu

- La banque actuelle contient **2 496 questions uniques** en français (100 à 150 par catégorie, 18 catégories), toutes de type « identifier cette image ».
- CLASSIC nécessite **200 questions approuvées**.
- SUBJECT nécessite **100 questions par catégorie** (`MIN_QUESTIONS_PER_CATEGORY`, une partie en tire 20) ; les 18 catégories atteignent ce seuil.
- Les options sont mélangées à chaque tirage.
- Les articles sont du texte brut, sans HTML.

### Génération depuis Wikipédia et Wikimedia Commons

`pnpm run data:wikipedia` (re)génère `data/questions.json`, `data/sources/report.json` et la section générée de `CREDITS.md` :

- seuls les **titres d'articles** sont choisis à la main (`scripts/wikimedia/seeds/`) ; la réponse (nom de l'article en français), l'explication (première phrase de l'article), le texte de l'article, l'image, l'auteur, la licence et la révision viennent de l'API Wikipédia, de Wikimedia Commons et de Wikidata (P18 en repli) ;
- chaque question garde `source` (permalien `oldid` de l'article, révision, langue, licence CC BY-SA 4.0) et `image.author` / `image.license` / `image.sourceUrl` (page du fichier sur Commons) ;
- licences d'images acceptées : CC0, domaine public, CC BY, CC BY-SA ; tout le reste (NC, ND, GFDL seul, usage loyal, auteur inconnu pour une licence à attribution) est écarté ;
- les distracteurs sont de vrais sujets du même type, de préférence du même groupe (même famille, même continent…), jamais la même entité Wikidata ni un libellé contenu dans l'autre ;
- tout ce qui est douteux est écarté et listé dans `data/sources/report.json` (article introuvable, page d'homonymie, image non libre, réponse introuvable dans l'article…) ;
- politesse API : User-Agent descriptif, requêtes séquentielles avec délai, `maxlag`, reprise sur 429/`Retry-After`, cache disque (`data/cache/`, ignoré par git). `--offline` rejoue la génération depuis le cache, de façon identique.

Les images sont servies en vignettes de 960 px (Commons n'accepte que des largeurs standard) ; les anciennes URL en 640 px répondent en HTTP 400.
- Les images sont des URLs Wikimedia créditées.
- Aucune génération Gemini au runtime ; la génération est hors ligne, avec revue humaine.

Voir [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Non-objectifs v1

- Multi-instance et scaling horizontal.
- Mode hors-ligne.
- Génération Gemini en direct.
- Comptes email/mot de passe.
- Matchmaking classé ou ELO.
- Chat entre joueurs.
- Modération du contenu TikTok.
- Replay, historique de partie, rematch.
- Spectateurs web.
- Upload d'avatar.

## Feuille de route

| Phase | Contenu | Statut |
| --- | --- | --- |
| 0 | Assainissement, lockfile, secrets, CI minimale. | Fait |
| 1 | TypeScript strict, lint, tests, build serveur/client. | Fait |
| 2 | Extraction, validation et import des questions. | Fait |
| 3 | Moteur pur, scoring, state machine, tests. | Fait |
| 4 | SQLite, sessions, identité, persistance. | Fait |
| 5 | HTTP, Socket.io, rooms, orchestration. | Fait |
| 6 | Client joueur, vues, accessibilité, sons. | Fait |
| 7 | Matchmaking public et small rooms. | Fait |
| 8 | TikTok, overlay, control. | Fait (connecteur réel non validé) |
| 9 | Durcissement sécurité, charge, a11y. | Fait (a11y manuelle, TLS restants) |
| 10 | Extension du contenu SUBJECT. | À faire (contenu éditorial) |
| 11 | Release et live test. | À faire (live test, déploiement) |

Détail et estimation dans [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md).

## Contribuer

- Lire les documents de référence avant toute modification.
- Ne jamais implémenter une règle dans le client.
- Ne jamais ajouter une dépendance sans vérifier qu'elle existe déjà ou justifier son ajout.
- Ajouter ou mettre à jour un test pour chaque comportement.
- Ne jamais commiter de secret.
- Ne jamais utiliser de CDN pour les polices, le JS ou le CSS ; les images éditoriales suivent l'allowlist CSP.
- Ne jamais utiliser `dangerouslySetInnerHTML`.
- Ne jamais écrire de HTML dans les articles.
- Ne jamais introduire de décision produit implicite : mettre à jour `DECISIONS.md` et `ADR.md`.

## Licence et crédits

- Code : licence à définir avant publication.
- Questions et articles : contenu original, à relire et créditer.
- Images : Wikimedia Commons, crédit et licence affichés par question.
- Polices : Merriweather et Inter, SIL Open Font License.
- Sons : signaux synthétisés en WebAudio au runtime, aucun fichier audio embarqué.
