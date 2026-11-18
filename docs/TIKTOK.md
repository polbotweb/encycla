# TikTok : mise en service et exploitation

Ce document décrit ce qui est **implémenté** pour le mode TikTok et ce qui reste à valider avec un vrai live. Les règles de jeu sont dans [SPECIFICATION.md](SPECIFICATION.md) §14 et le contrat dans [PROTOCOL.md](PROTOCOL.md) §3.11 et §6.5.

## Ce qui est en place

| Brique | Fichier | Rôle |
| --- | --- | --- |
| Parsing strict | `server/tiktok/parser.ts` | NFKC, mentions en tête retirées, URL refusées, une seule lettre `A`–`D`. |
| Port `TikTokAdapter` | `server/tiktok/adapter.ts` | Interface étroite (`connect`, `disconnect`, `onChat`, `onDisconnect`). |
| Faux adaptateur | `server/tiktok/fakeAdapter.ts` | Tests et développement sans live. |
| Connecteur | `server/tiktok/connector.ts` | Reconnexion avec backoff 1 s → 30 s, aucun identifiant dans les logs. |
| Adaptateur réel | `server/tiktok/liveAdapter.ts` | Enveloppe de `tiktok-live-connector` (voir ci-dessous). |
| Service | `server/tiktok/service.ts` | Une room TikTok à la fois, viewers, capacité 100, déduplication, état du connecteur. |
| Route admin | `POST /api/tiktok/rooms` | Crée la room et renvoie `overlayToken` / `controlToken`. |
| Overlay et control | `client/views/OverlayView.tsx`, `ControlView.tsx` | Overlay en lecture seule, console avec start, pause, skip, réponse manuelle, fermeture. |

Comportement :

- Le premier commentaire valide `A`/`B`/`C`/`D` pendant `QUESTION` crée le viewer (`provider='tiktok'`, `external_id=uniqueId` en minuscules) et vaut réponse.
- Les doublons, viewers éliminés, réponses tardives et commentaires ambigus sont ignorés sans erreur visible.
- Au-delà de 100 viewers, les suivants sont ignorés (un seul log `tiktok.capacity_reached`).
- Une question TikTok va toujours jusqu'à son timer (D-79).
- Une déconnexion du connecteur met `tiktokConnected=false` et pause la room ; la reprise est manuelle (`HOST_RESUME`), l'opérateur peut continuer avec la réponse manuelle.
- `GET /api/health` passe en `degraded` si TikTok est activé mais déconnecté.
- Les tokens overlay/control sont révoqués à la fermeture de la room.

## Activer le connecteur réel

Le connecteur réel est une dépendance **optionnelle et isolée** (`optionalDependencies`, chargée uniquement par `server/tiktok/liveAdapter.ts` via `import()` dynamique, derrière l'interface `TikTokAdapter`) :

1. `tiktok-live-connector` est un client **non officiel** ; son usage peut contrevenir aux conditions d'utilisation de TikTok (voir [DEPLOYMENT.md](DEPLOYMENT.md) §12.1).
2. Il est publié sous licence **AGPL-3.0-only** ; il n'est donc **pas** inclus dans l'image Docker par défaut. L'activer sur une instance exposée en réseau impose de respecter l'AGPL pour ce paquet (voir [LICENSES.md](LICENSES.md) §3) : c'est une décision de l'opérateur.
3. Il s'appuie sur un service de signature tiers (Euler Stream) dont la disponibilité et les quotas ne sont pas sous notre contrôle.

Pour l'activer sur une instance, après décision explicite :

```bash
pnpm install                                            # local : les dépendances optionnelles sont installées
docker build --build-arg WITH_TIKTOK=true -t encycla .  # image avec le connecteur
WITH_TIKTOK=true docker compose up -d --build           # ou via compose
```

```dotenv
TIKTOK_ENABLED=true
TIKTOK_USERNAME=<compte dédié>
TIKTOK_SESSION_COOKIE=sessionid=<valeur>; tt-target-idc=<valeur>
# optionnel : clé Euler Stream (quotas du service de signature)
TIKTOK_SIGN_API_KEY=
```

Au démarrage, le serveur refuse `TIKTOK_ENABLED=true` sans `TIKTOK_USERNAME` ni `TIKTOK_SESSION_COOKIE`. En production il refuse aussi de démarrer si le paquet optionnel n'est pas installé (image construite sans `WITH_TIKTOK=true`) ; en développement il avertit et reste en mode manuel. Si le live se coupe, le connecteur reste déconnecté, réessaie avec backoff, `POST /api/tiktok/rooms` répond `TIKTOK_NOT_CONNECTED` et la santé est `degraded`.

Tests : `tests/tiktok/connector.test.ts` vérifie, avec un module simulé, les options passées au paquet (cookie de session, `authenticateWs`, clé de signature), la conversion des messages `chat`, la gestion de `streamEnd`/`disconnected`, le silence sur `error`, et que le vrai paquet installé expose bien `TikTokLiveConnection`.

> `liveAdapter.ts` suit l'API publique de `tiktok-live-connector` 2.5 (événements `chat`, `disconnected`, `streamEnd`, option `session.cookie`). Il n'a **pas** pu être exécuté contre un vrai live dans cet environnement : la validation ci-dessous est obligatoire.

## Checklist manuelle avant un live

- [ ] Compte secondaire dédié, jamais le compte principal.
- [ ] `ADMIN_TOKEN` et `TIKTOK_SESSION_COOKIE` stockés comme secrets, jamais dans le dépôt.
- [ ] `GET /api/health` retourne `ok` (connecteur connecté).
- [ ] Création de room : `curl -X POST /api/tiktok/rooms` avec le bearer admin.
- [ ] Overlay OBS : URL `/?mode=overlay&room=CODE#token=OVERLAY_TOKEN`, affichage sans contrôle.
- [ ] Console : URL `/?mode=control&room=CODE#token=CONTROL_TOKEN`, badge `LIVE`.
- [ ] 20 viewers de test répondent ; vérifier dédup, élimination, top 10.
- [ ] Couper le réseau du serveur : badge `CHAT OFFLINE`, room en pause, reprise manuelle.
- [ ] Live d'une heure sans fuite mémoire ni déconnexion non récupérée.
- [ ] Aucun cookie ni token dans les logs (`grep -i -E 'sessionid|ctl_|ovl_'`).
