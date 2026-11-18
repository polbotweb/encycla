# Encycla — Développement, déploiement et exploitation

- Version : 1.0
- Date : 2026-10-22
- Statut : procédure d'exploitation
- Sécurité : [SECURITY.md](SECURITY.md)
- Données : [DATA-MODEL.md](DATA-MODEL.md)

## 1. Prérequis

| Outil | Version |
| --- | --- |
| Node.js | 22 LTS |
| pnpm | 10.28+ |
| Git | 2.40+ |
| Docker | 24+ (optionnel) |
| Docker Compose | v2 (optionnel) |
| Navigateur | Chrome/Edge/Firefox récent |

- Système cible : Linux x86_64 en production.
- Développement supporté : Windows 10/11, macOS, Linux.
- `better-sqlite3` nécessite une compilation native si aucun binaire précompilé n'est disponible :
  - Windows : Visual Studio Build Tools + Python 3.
  - Debian/Ubuntu : `build-essential python3`.
  - Alpine : `build-base python3`.

## 2. Installation locale

```powershell
git clone <repo>
Set-Location encycla
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm run db:migrate
pnpm run data:import
pnpm run dev
```

- Client : `http://localhost:5173`
- Serveur : `http://localhost:3000`
- Le client Vite proxy `/api` et `/socket.io` vers `3000`.
- Ne jamais exposer `5173` en production.

### 2.1 Variables locales

`.env.example` :

Copier [`.env.example`](../.env.example) en `.env` : chaque variable y est commentée. En développement, `ADMIN_TOKEN` peut rester vide (routes admin désactivées) ; la valeur historique `change-me` est tolérée hors production, toute autre valeur faible est refusée au démarrage.

Générer des secrets locaux :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 3. Scripts attendus

`package.json` doit exposer :

```json
{
  "scripts": {
    "dev": "concurrently -k -n client,server \"vite\" \"tsx watch server/index.ts\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "build": "pnpm run build:client && pnpm run build:server",
    "build:client": "vite build",
    "build:server": "node scripts/build-server.mjs",
    "start": "node dist/server/index.js",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:load": "tsx scripts/load-test.ts",
    "db:migrate": "tsx server/db/migrate.ts",
    "data:validate": "tsx scripts/validate-questions.ts",
    "data:import": "tsx scripts/import-questions.ts",
    "data:extract": "tsx scripts/extract-legacy-questions.ts",
    "content:generate": "tsx scripts/generate-questions.ts"
  }
}
```

`pnpm-lock.yaml` doit être commité. Toute modification ultérieure doit être intentionnelle et revue.

## 4. Développement

### 4.1 Ordre de démarrage

1. `db:migrate` crée les tables.
2. `data:import` charge les questions approuvées.
3. Le serveur démarre et vérifie :
   - la version des migrations ;
   - `PRAGMA quick_check` ;
   - le nombre de questions ;
   - les seuils CLASSIC/SUBJECT ;
   - la présence des variables obligatoires.
4. Vite démarre et proxy vers `3000`.

### 4.2 Rechargement

- Serveur : `tsx watch`, redémarrage à chaque changement.
- Client : HMR Vite.
- `tsx watch` tue le processus sans arrêt propre : les rooms reviennent depuis leur dernier instantané (D-117).
- En développement, si SQLite est absent ou corrompu, le serveur bascule automatiquement en mode dégradé et le jeu reste jouable.

### 4.3 Base de développement

- Chemin par défaut : `data/encycla.db`.
- Réinitialiser :

```powershell
Remove-Item data/encycla.db, data/encycla.db-wal, data/encycla.db-shm -ErrorAction SilentlyContinue
pnpm run db:migrate
pnpm run data:import
```

Ne jamais lancer cette commande en production.

## 5. Build

```powershell
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run data:validate
pnpm run test:coverage
pnpm run build
```

Sorties :

- `dist/client/` : assets statiques Vite.
- `dist/server/` : bundle esbuild du serveur (`index.js`) et copie des migrations ; les sources utilisent des imports sans extension, donc `tsc` seul ne produit pas un JavaScript exécutable par Node ESM.
- `dist/scripts/` : `import-questions.js` et `db-migrate.js`.

Le serveur Express sert `dist/client` en production. Les assets hashés ont un cache `immutable` d'un an ; `index.html` est `no-cache`.

## 6. Production

### 6.1 Configuration

```dotenv
NODE_ENV=production
PORT=3000
PUBLIC_ORIGIN=https://encycla.example.com
DATABASE_PATH=/var/lib/encycla/encycla.db
IMAGE_CACHE_DIR=/var/cache/encycla/images
IMAGE_CACHE_MAX_MB=512
ADMIN_TOKEN=<openssl rand -hex 32>
TRUST_PROXY=true
TIKTOK_ENABLED=false
TIKTOK_ADAPTER=live
TIKTOK_USERNAME=
TIKTOK_SESSION_COOKIE=
TIKTOK_SIGN_API_KEY=
LOG_LEVEL=info
DOMAIN=encycla.example.com
```

Validation **fail-fast** au démarrage (`server/config.ts`, avant d'ouvrir la base ou d'écouter) : le processus s'arrête avec un code non nul et la liste des problèmes, sans jamais afficher la valeur d'un secret.

| Règle | Production | Développement |
| --- | --- | --- |
| `ADMIN_TOKEN` absent | refus | admin désactivé |
| `ADMIN_TOKEN` = valeur d'exemple (`change-me`, `admin`, `password`…) | refus | `change-me` toléré (admin désactivé), autres refusées |
| `ADMIN_TOKEN` < 32 caractères (prod) / < 16 (dev), espaces, < 8 caractères distincts | refus | refus |
| `PUBLIC_ORIGIN` absent ou pas `https://hôte[:port]` | refus | libre |
| `RATE_LIMIT=off` | refus | autorisé (tests de charge) |
| `TIKTOK_ENABLED=true` (adaptateur `live`) sans `TIKTOK_SESSION_COOKIE` | refus | refus |
| `TIKTOK_USERNAME` qui n'est pas un pseudo TikTok | refus | refus |
| `TIKTOK_ADAPTER` autre que `live` / `fake` | refus | refus |
| `TIKTOK_ADAPTER=fake` (chat simulé, démo) | avertissement au démarrage | avertissement au démarrage |
| `TIKTOK_ENABLED=true` (adaptateur `live`) sans le paquet optionnel `tiktok-live-connector` | refus | avertissement, mode manuel |
| `TRUST_PROXY` autre que `false`, `true` ou 1-10 | refus | refus |
| `IMAGE_CACHE_MAX_MB` autre qu'un entier 1-100000 | refus | refus |

- `PUBLIC_ORIGIN` doit correspondre exactement au domaine public, sans slash final.
- `ADMIN_TOKEN` : `openssl rand -hex 32` (64 caractères).
- Les IP ne sont jamais persistées ; seul le rate limiting en mémoire les utilise.
- `GEMINI_API_KEY` n'est pas nécessaire au runtime ; ne pas la monter dans le conteneur de jeu.
- `TIKTOK_SESSION_COOKIE` est obligatoire si `TIKTOK_ENABLED=true` avec l'adaptateur réel ; `TIKTOK_USERNAME` est facultatif (live par défaut, chaque room peut nommer le sien).

### 6.2 Démarrage

```bash
node dist/server/index.js
```

Le serveur :

1. charge l'environnement ;
2. valide les variables ;
3. ouvre SQLite, ou bascule en mode dégradé si la base est indisponible/corrompue ;
4. applique les migrations en attente ;
5. marque les matchs `in_progress` comme `abandoned` ;
6. synchronise `data/questions.json` vers `questions` ;
7. vérifie la banque de questions ;
8. écoute sur `PORT` ;
9. démarre le nettoyage des sessions ;
10. connecte TikTok si activé.

En mode dégradé, les étapes 4 à 6 sont ignorées : les questions viennent de `data/questions.json` et les sessions/scores restent en mémoire. Une migration échouée est fail-fast : arrêt du serveur, pas de mode dégradé.

### 6.3 Reverse proxy

Le serveur ne termine pas TLS en production. Utiliser Caddy ou Nginx.

#### Caddy

```caddy
encycla.example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000 {
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}
  }
}
```

Caddy gère TLS et HTTP/2. Vérifier que les WebSockets passent (Caddy le fait par défaut).

#### Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name encycla.example.com;

  ssl_certificate     /etc/letsencrypt/live/encycla.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/encycla.example.com/privkey.pem;

  client_max_body_size 16k;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 75s;
  }
}
```

- `proxy_read_timeout` doit dépasser le ping Socket.io (25 s).
- Ne pas mettre de cache sur `/socket.io`, `/api` ou `index.html`.
- Les assets `/assets/*` peuvent être cachés.

### 6.4 `trust proxy`

- `TRUST_PROXY=true` derrière **un** reverse proxy (Caddy du compose, Nginx) : Express reçoit `trust proxy = 1`. Un nombre `N` (1-10) pour une chaîne de proxies.
- La valeur Express `true` (« faire confiance à tous les sauts ») n'est jamais utilisée : elle permettrait de falsifier l'IP et de contourner le rate limit.
- Sans proxy, laisser `TRUST_PROXY=false`.

### 6.5 Proxy d'images et bande passante

Les images sont servies par le serveur de jeu sous `/img/<jeton>?w=330|500|960` (DECISIONS D-107, SECURITY §5.4) : le navigateur ne contacte jamais Wikimedia.

- `IMAGE_CACHE_DIR` (défaut `data/image-cache`, vide = mémoire seule) : cache disque des images nettoyées, noms = SHA-256 de l'URL amont. Jetable : le supprimer ne coûte que de nouveaux téléchargements. Le processus doit pouvoir y écrire ; il ne fait pas partie des sauvegardes (§10).
- `IMAGE_TOKEN_SECRET` (secret, ≥ 32 caractères) : clé des jetons `/img/…` (D-116). Vide : une clé aléatoire est générée au premier démarrage dans le dossier de la base (`data/image-token.secret`, mode 600) et réutilisée ensuite ; à sauvegarder avec la base. Volume en lecture seule : clé par processus (les liens ne survivent pas au redémarrage, avertissement au démarrage).
- `IMAGE_CACHE_MAX_MB` (défaut 512) : plafond du cache disque, les fichiers les moins récemment utilisés partent en premier (au démarrage aussi). Cache mémoire en plus : 64 Mo.
- Sortie vers Wikimedia : une requête par fichier et par largeur tant qu'il est en cache (requêtes simultanées fusionnées), `User-Agent` identifiable conformément à la politique Wikimedia. Le serveur doit pouvoir joindre `https://upload.wikimedia.org` (pare-feu sortant). Une erreur ou un 429 amont donne un 502 et le placeholder « image indisponible », jamais l'URL d'origine.
- Ordre de grandeur mesuré sur un échantillon de la banque (novembre 2026, une dizaine de fichiers) : ≈ 260 Ko en moyenne à 960 px, ≈ 50 Ko à 330 px. Les 2 496 images à 960 px représentent donc ≈ 650 Mo ; avec les trois largeurs, compter ≈ 1 Go pour tout garder (512 Mo suffisent pour les images les plus jouées).
- Bande passante sortante vers les joueurs : une image par question et par joueur, à la largeur choisie par le navigateur (`srcset`), soit ≈ 2,5 Mo par partie de 10 questions sur un écran large, bien moins sur mobile. Les réponses sont `Cache-Control: private` (le navigateur les garde jusqu'à l'expiration du jeton, aucun CDN ne les partage) : prévoir cette bande passante sur l'hôte lui-même.
- Limite : 300 requêtes/min/IP sur `/img`. Derrière un NAT très peuplé, `TRUST_PROXY` doit être correct pour que la limite porte sur l'IP réelle.

## 7. Docker

### 7.1 Dockerfile

Voir [`Dockerfile`](../Dockerfile) : trois étapes (`deps` compile `better-sqlite3`, `build` construit client et serveur, `runtime` non-root avec healthcheck). L'image contient `dist/`, les migrations, `data/questions.json`, `LICENSE` et `CREDITS.md` (attribution CC BY-SA du contenu).

| Build arg | Défaut | Effet |
| --- | --- | --- |
| `WITH_TIKTOK` | `false` | `false` : `pnpm prune --prod --no-optional`, le connecteur AGPL **n'est pas** dans l'image. `true` : le connecteur est conservé (voir [LICENSES.md](LICENSES.md) §3). |

```bash
docker build -t encycla .                                # sans TikTok
docker build --build-arg WITH_TIKTOK=true -t encycla .   # avec le connecteur
```

- Image de base épinglée par digest en production.
- Pas de gestionnaire de paquets dans le runtime.
- Pas de secrets dans l'image : tout passe par `.env` à l'exécution.
- La CI construit les deux variantes, vérifie que l'image par défaut ne contient pas le connecteur et qu'elle refuse de démarrer en production avec `ADMIN_TOKEN=change-me`.

### 7.2 Compose

[`docker-compose.yml`](../docker-compose.yml) :

- service `encycla` : `NODE_ENV=production` imposé, base dans le volume `encycla-data` (`DATABASE_PATH=/app/data/db/encycla.db`), cache d'images dans le volume `encycla-image-cache` (`IMAGE_CACHE_DIR=/app/data/image-cache`, §6.5), système de fichiers en lecture seule, `cap_drop: ALL`, `no-new-privileges`, port publié uniquement sur `127.0.0.1:3000` ;
- service `caddy` (profil `proxy`, optionnel) : HTTPS automatique (Let's Encrypt) pour `DOMAIN`, ports 80/443, configuration [`deploy/Caddyfile`](../deploy/Caddyfile) ; mettre alors `TRUST_PROXY=true` et `PUBLIC_ORIGIN=https://$DOMAIN`.

```bash
cp .env.example .env        # puis renseigner les valeurs de production (§6.1)
docker compose --profile proxy up -d --build             # application + HTTPS
docker compose up -d --build                             # application seule (proxy existant)
WITH_TIKTOK=true docker compose --profile proxy up -d --build   # avec le connecteur TikTok
docker compose logs -f encycla
```

- `data/questions.json` reste dans l'image pour ne pas être masqué par un volume périmé.
- `read_only` est compatible avec les volumes de données et de cache d'images ; `docker volume rm encycla_encycla-image-cache` vide le cache sans risque (service arrêté).
- Sans le profil `proxy`, ne pas publier `3000` sur `0.0.0.0` : placer un reverse proxy TLS devant (§6.3).

### 7.3 Première mise en production

1. Serveur Linux avec Docker et Docker Compose, DNS `A`/`AAAA` du domaine vers lui, ports 80 et 443 ouverts.
2. `git clone https://github.com/polbotweb/encycla && cd encycla && cp .env.example .env`.
3. Dans `.env` : `NODE_ENV=production`, `DOMAIN`, `PUBLIC_ORIGIN=https://<domaine>`, `ADMIN_TOKEN=$(openssl rand -hex 32)`, `TRUST_PROXY=true`. `chmod 600 .env`.
4. `docker compose --profile proxy up -d --build` ; en cas d'erreur de configuration, `docker compose logs encycla` liste les variables à corriger.
5. Vérifier `curl https://<domaine>/api/health` (`ok`) et une partie solo dans un navigateur.
6. Programmer la sauvegarde SQLite (§10) vers un stockage hors serveur.
7. TikTok, seulement après décision (§12 et [TIKTOK.md](TIKTOK.md)) : renseigner `TIKTOK_*`, puis `WITH_TIKTOK=true docker compose --profile proxy up -d --build`.

### 7.4 Migrations dans Docker

Le serveur applique les migrations au démarrage. Pour un contrôle explicite :

```bash
docker compose run --rm encycla node dist/scripts/db-migrate.js
```

L'import manuel reste disponible, même si le serveur synchronise aussi `questions.json` au démarrage :

```bash
docker compose run --rm encycla node dist/scripts/import-questions.js
```

## 8. Procédure de déploiement

### 8.1 Avant

1. Vérifier la CI verte.
2. Sauvegarder la base.
3. Vérifier l'espace disque.
4. Annoncer la maintenance si des rooms sont actives.

### 8.2 Étapes

```bash
git fetch --tags
git checkout <tag>
pnpm install --frozen-lockfile
pnpm run data:validate
pnpm run build
pnpm run db:migrate
pnpm run data:import
systemctl restart encycla
```

Ou avec Docker :

```bash
docker compose build
docker compose run --rm encycla node dist/scripts/import-questions.js
docker compose up -d
```

### 8.3 Après

1. `GET /api/health` retourne `ok`.
2. `GET /api/config` retourne les catégories et le `protocolVersion`.
3. Créer une room de smoke test et jouer une question.
4. Vérifier les logs : aucune erreur 5xx, aucun secret.
5. Vérifier le leaderboard.
6. Vérifier l'overlay TikTok si activé.

### 8.4 Continuité

- Une instance unique ne permet pas de zéro downtime.
- Arrêt propre (`SIGTERM`, `docker compose restart`, redéploiement) : les rooms web en cours sont écrites dans SQLite (`active_rooms`, D-117) et **restaurées au démarrage suivant** si l'arrêt a duré moins de 10 minutes. La phase en cours reprend où elle en était, plus 5 s ; chaque joueur a la période de grâce habituelle (30 s) pour revenir, sa session étant en base ; le client affiche « Reconnexion… » puis retrouve la partie. Les matchs restaurés restent `in_progress`.
- Crash (`SIGKILL`, panne) : même chose à partir du dernier instantané (écrit au plus une fois par seconde et par room).
- Ne sont pas restaurés : les rooms TikTok (connexion au chat, liens overlay/console), les rooms terminées, la file de matchmaking, les instantanés de plus de 10 minutes. Leurs joueurs voient « Le serveur a redémarré » et reviennent au menu ; leurs matchs deviennent `abandoned`.
- Prévenir avant un déploiement en heure de pointe.
- Ne pas déployer pendant un live TikTok.

## 9. Rollback

1. Arrêter le service.
2. Redéployer l'image/tag précédent.
3. Si la migration est incompatible, restaurer la sauvegarde.
4. Redémarrer.
5. Vérifier `/api/health`.
6. Vérifier le leaderboard.

Les migrations sont forward-only. Un rollback de code sans rollback de base n'est autorisé que si la migration est additive.

## 10. Sauvegardes

### 10.1 Création

```bash
sqlite3 /var/lib/encycla/encycla.db "VACUUM INTO '/backups/encycla-$(date +%F-%H%M).db';"
```

Ou via un script Node avec `better-sqlite3` :

```ts
db.prepare("VACUUM INTO ?").run(path);
```

- Ne jamais copier le fichier `.db` à chaud sans checkpoint.
- Fréquence : quotidienne.
- Rétention : 7 jours minimum, 30 jours recommandé.
- Stockage hors du serveur.
- Chiffrement au repos si le stockage est partagé.

### 10.2 Restauration

1. Arrêter le service.
2. Copier la sauvegarde vers `DATABASE_PATH`.
3. Supprimer `-wal` et `-shm` résiduels.
4. Démarrer.
5. `PRAGMA integrity_check`.
6. Vérifier le leaderboard.
7. Tester une room.

### 10.3 Test de restauration

- Une fois par mois.
- Sur un environnement séparé.
- Vérifier les comptes de matchs et de scores.
- Documenter la date et le résultat.

## 11. Supervision

### 11.1 Healthcheck

`GET /api/health` :

- `200 ok` : tout va bien.
- `503 error` : questions manquantes ou démarrage incomplet hors mode dégradé.
- DB inaccessible/corrompue : `200` avec `status: "degraded"`, `db: "disabled"`, jeu jouable.
- `degraded` (200) : DB désactivée, TikTok activé mais déconnecté, ou banque sous le seuil.

### 11.2 Logs

- JSON sur stdout.
- Collecte par le superviseur (Docker, systemd, Loki).
- Redaction des tokens.
- Rotation si fichier.
- Rétention 30 jours.

### 11.3 Métriques

- Rooms actives.
- Sockets connectés.
- Matchs terminés.
- Latence HTTP.
- Erreurs par code.
- Reconnexions et abandons.
- TikTok connecté/déconnecté.
- Taille de la base.

### 11.4 Alertes

| Alerte | Seuil |
| --- | --- |
| Erreurs 5xx | > 1 % sur 5 min |
| DB | healthcheck échoue 2 fois |
| Rooms | 0 room avec sockets > 50 |
| TikTok | déconnecté > 5 min |
| Mémoire | > 450 Mo |
| Disque | < 10 % libre |
| Latence | p95 > 250 ms sur 5 min |

## 12. Exploitation TikTok

### 12.1 Compte

- Compte dédié au jeu.
- Session TikTok valide.
- Cookie stocké comme secret.
- Ne jamais utiliser le compte principal de l'opérateur.
- Vérifier les conditions d'utilisation TikTok.

### 12.2 Création d'une room

```bash
curl -X POST https://encycla.example.com/api/tiktok/rooms \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"CLASSIC","timerMs":15000}'
```

Réponse :

```json
{
  "roomCode": "T9X4P2",
  "overlayToken": "ovl_...",
  "controlToken": "ctl_..."
}
```

### 12.3 OBS

- Browser Source : `https://encycla.example.com/?mode=overlay&room=T9X4P2#token=ovl_...`
- Résolution : 1920×1080.
- Pas de son dans OBS par défaut.
- CSS transparent.
- Rafraîchir la source en cas de perte.

### 12.4 Console

- `https://encycla.example.com/?mode=control&room=T9X4P2#token=ctl_...`
- Ne pas partager ce lien.
- Ne pas afficher la console à l'antenne.
- Fermer la room après le live.

### 12.5 Incident connecteur

1. La room se met en pause au prochain point sûr.
2. L'overlay affiche « Chat reconnecting… ».
3. Le connecteur retente avec backoff.
4. Si le chat ne revient pas : utiliser la réponse manuelle.
5. Si le live doit continuer : ne pas redémarrer le serveur.

## 13. Runbook

### 13.1 Room bloquée

1. Vérifier la phase via `/api/health` et les logs.
2. Si le host est déconnecté, attendre le transfert ou utiliser l'admin.
3. `POST /api/admin/rooms/:code/close`.
4. Vérifier que le match est `abandoned`.

### 13.2 Base verrouillée

1. Vérifier `busy_timeout`.
2. Vérifier qu'aucun script d'import ne tourne.
3. Redémarrer le service.
4. Si la base reste indisponible, le serveur bascule en mode dégradé : le jeu continue, le leaderboard renvoie `PERSISTENCE_DISABLED`.
5. `PRAGMA integrity_check` dès que la base est de nouveau accessible.

### 13.3 Mémoire élevée

1. Vérifier le nombre de rooms/sockets.
2. Fermer les rooms inactives.
3. Redémarrer hors heures de pointe.
4. Réduire la limite de rooms.
5. Le cache d'images mémoire est plafonné à 64 Mo ; le cache disque se règle avec `IMAGE_CACHE_MAX_MB` (§6.5).

### 13.4 Questions manquantes

1. `pnpm run data:validate`.
2. Vérifier `data/questions.json`.
3. `pnpm run data:import`.
4. Redémarrer.
5. `/api/health` doit repasser `ok`.

### 13.5 Session perdue

1. Le joueur se reconnecte.
2. Si le token est expiré : nouvelle session.
3. Si la room est perdue : retour au menu.
4. Ne jamais réutiliser un token d'un autre joueur.

### 13.6 Dérive d'horloge

- Le serveur est l'horloge autoritaire.
- Vérifier NTP sur l'hôte.
- Une dérive > 1 s peut fausser les timers.
- Redémarrer le service après correction.

## 14. Limites et scaling

- Une instance Node.
- SQLite local.
- Rooms en mémoire, avec instantanés SQLite pour les redémarrages (D-117).
- 200 rooms simultanées.
- 5 000 sockets.
- 100 viewers TikTok par room.
- Pas de scaling horizontal en v1.
- Pour scaler : extraire les rooms dans Redis, passer à PostgreSQL, ajouter un load balancer sticky, puis réévaluer le protocole.
- Le scaling horizontal est un projet distinct, pas une option de configuration.

## 15. Checklist de release

- [ ] `pnpm-lock.yaml` présent et commité.
- [ ] `pnpm install --frozen-lockfile` reproductible.
- [ ] Lint, typecheck, tests, build verts.
- [ ] `data:validate` vert.
- [ ] Migrations testées sur une copie de production.
- [ ] Sauvegarde récente.
- [ ] Variables de production présentes.
- [ ] TLS et HSTS actifs.
- [ ] CSP vérifiée.
- [ ] Aucun secret dans l'image.
- [ ] Conteneur non-root.
- [ ] Healthcheck configuré.
- [ ] Mode dégradé SQLite testé (jeu jouable, leaderboard 503).
- [ ] Reverse proxy WebSocket OK.
- [ ] Smoke test room privée.
- [ ] Smoke test overlay/control si TikTok.
- [ ] Logs sans token.
- [ ] Plan de rollback connu.
- [ ] Monitoring et alertes actifs.
