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
| Câblage | `server/tiktok/setup.ts` | Choisit l'adaptateur selon la config : aucun, réel (`live`) ou chat simulé (`fake`). |
| Route admin | `POST /api/tiktok/rooms` | Crée la room pour **n'importe quel live** (`liveUsername`) et renvoie `overlayToken` / `controlToken`. |
| État streamer | `GET /api/admin/tiktok` | TikTok activé ?, chat simulé ?, connecté ?, live suivi, room ouverte. |
| Chat simulé | `POST /api/admin/tiktok/chat` | Injecte un commentaire (uniquement avec `TIKTOK_ADAPTER=fake`). |
| Console streamer | `client/views/AdminView.tsx` (`/?mode=admin`) | Jeton admin (en mémoire seulement), live, mode, langue, timer ; liens overlay/console à copier ; fermeture ; simulateur A/B/C/D en mode démo. |
| Overlay et control | `client/views/OverlayView.tsx`, `ControlView.tsx` | Overlay en lecture seule, console avec start, pause, skip, réponse manuelle, fermeture. |

Comportement :

- Le premier commentaire valide `A`/`B`/`C`/`D` pendant `QUESTION` crée le viewer (`provider='tiktok'`, `external_id=uniqueId` en minuscules) et vaut réponse.
- Les doublons, viewers éliminés, réponses tardives et commentaires ambigus sont ignorés sans erreur visible.
- Au-delà de 100 viewers, les suivants sont ignorés (un seul log `tiktok.capacity_reached`).
- Une question TikTok va toujours jusqu'à son timer (D-79).
- Une déconnexion du connecteur met `tiktokConnected=false` et pause la room ; la reprise est manuelle (`HOST_RESUME`), l'opérateur peut continuer avec la réponse manuelle.
- `GET /api/health` passe en `degraded` si TikTok est activé mais déconnecté.
- Les tokens overlay/control sont révoqués à la fermeture de la room.

## N'importe quel live

`TIKTOK_USERNAME` n'est qu'un live **par défaut**. Chaque room peut nommer le live à suivre (`liveUsername`, champ « Live TikTok à suivre » de la console streamer, `@` facultatif, 2–24 caractères `A-Z a-z 0-9 . _`). Si c'est un autre live que celui suivi, le connecteur se reconnecte sur ce live ; la room est créée tout de suite et l'overlay affiche « Reconnexion du chat… » jusqu'à la connexion (`connected` dans la réponse). Une seule room TikTok à la fois.

## Guide streamer (pas à pas)

1. Ouvrir `https://<domaine>/?mode=admin`, coller `ADMIN_TOKEN`, **Déverrouiller**. Le jeton reste dans la page (jamais stocké).
2. Vérifier l'état : `EN DIRECT` (chat connecté) ou `CHAT HORS LIGNE`, et le live suivi.
3. Saisir le `@` du live (ou laisser vide pour le live par défaut), choisir CLASSIC ou SUBJECT (catégorie, difficulté), la langue des questions et le temps par question (10–30 s), puis **Créer le salon**.
4. **OBS** : Sources → `+` → **Navigateur** → coller le « Lien de l'overlay », largeur/hauteur 1080 × 1920 (live vertical) ou 1920 × 1080 ; cocher « Actualiser le navigateur quand la scène devient active » et « Contrôler l'audio via OBS » (voix, voir ci-dessous). L'overlay n'a aucun contrôle.
5. Ouvrir le « Lien de la console » sur le téléphone ou un second écran : **Démarrer**, **Pause/Reprendre**, **Passer**, réponse manuelle pour un spectateur, **Fermer**.
6. Les spectateurs commentent `A`, `B`, `C` ou `D` (minuscules, `@mention` en tête et texte autour d'une seule lettre acceptés ; voir le parseur). Le premier commentaire valide les inscrit et compte comme réponse ; les suivants sur la même question sont ignorés.
7. Après chaque question : réponse, top 10, article ; à la fin, classement final. **Fermer le salon** (console streamer ou console de jeu) libère la place pour le live suivant.

## Voix automatique et OBS (D-115)

La voix lit la question, les réponses A/B/C/D, « 10 secondes », « 5 secondes », « Temps écoulé » puis la bonne réponse, dans la langue des questions. C'est la synthèse vocale du navigateur (`speechSynthesis`) : gratuite, sans clé, mais **les voix disponibles sont celles de l'ordinateur qui affiche la page**. Elle est activée par défaut sur l'overlay (le lien contient `&voice=1`) et sur la console.

**Option A, voix depuis l'overlay dans OBS.** Dans les propriétés de la source Navigateur, cocher **« Contrôler l'audio via OBS »** : le son de la page apparaît alors comme une piste dans le mixeur audio d'OBS (sinon il part sur la sortie du bureau). Dans le lobby, l'overlay affiche l'état de la voix : « Voix : <nom> » ou « Aucune voix dans ce navigateur ». Limites connues : la source Navigateur d'OBS (CEF) n'expose souvent **aucune voix** (`speechSynthesis.getVoices()` vide) et la synthèse vocale est jouée par le moteur vocal du système, pas toujours par le flux audio de la page ; dans ces cas l'overlay reste muet, sans avertissement à l'écran pendant la partie.

**Option B (fiable), voix depuis la console.** Ouvrir le lien de la console dans Chrome ou Edge sur l'ordinateur du stream, régler la voix dans le panneau « Voix automatique » (voix, vitesse, volume, « Tester la voix »), puis ajouter dans OBS une source **« Capture audio d'application »** (Windows 10 2004+, OBS 28+) sur ce navigateur, ou laisser OBS capturer l'audio du bureau. Ajouter `&voice=0` à l'URL de l'overlay si OBS y trouve aussi une voix, pour ne pas l'entendre deux fois.

Réglages par URL de l'overlay (jamais enregistrés côté serveur) : `voice=0|1`, `rate=0.5` à `2`, `volume=0` à `1`, `article=1` (lire aussi la première phrase de l'article). Sans voix pour la langue des questions (par exemple pas de voix arabe installée), **rien n'est lu dans une autre langue** : l'overlay et la console affichent « Aucune voix arabe sur cet appareil » ; installer une voix arabe dans les réglages de synthèse vocale du système puis recharger. Si le navigateur exige un clic avant de parler, un bouton « Activer la voix » apparaît (dans OBS : clic droit sur la source → **Interagir**).

## Robustesse de la connexion (D-121)

- **Reprise automatique** : 1 s, 2 s, 4 s… jusqu'à 30 s entre deux essais (±20 %). Si TikTok répond que le live est **hors ligne** (live pas encore lancé, terminé), les essais s'espacent de 15 s à 2 min : on peut créer la room avant de lancer le live, elle se connecte toute seule.
- **Connexion bloquée** : un essai sans réponse au bout de 20 s est abandonné et relancé.
- **Console streamer** : sous l'état du live, « Chat déconnecté : nouvel essai automatique · 3 échecs · le live semble hors ligne · <dernière erreur> ». La dernière erreur est expurgée (cookies, clés, URL) et n'apparaît jamais dans les journaux en clair.
- **Doublons** : un message reçu deux fois après une reconnexion (même identifiant TikTok) ne compte qu'une fois ; les commentaires de plus de 200 caractères sont ignorés.
- **Sans le paquet** : `pnpm check:no-tiktok` construit et lance le jeu sans `tiktok-live-connector` (comme l'image Docker par défaut), TikTok coupé puis chat simulé.

## Mode démo et tests : `TIKTOK_ADAPTER=fake`

```dotenv
TIKTOK_ENABLED=true
TIKTOK_ADAPTER=fake
TIKTOK_USERNAME=encycla_demo   # facultatif
ADMIN_TOKEN=<openssl rand -hex 32>
```

Aucun cookie, aucun paquet optionnel : le connecteur se « connecte » à un chat simulé. La console streamer affiche « Chat simulé (démo) » et un simulateur (pseudo + boutons A/B/C/D) ; `POST /api/admin/tiktok/chat` injecte un commentaire. Le serveur l'annonce au démarrage. C'est ce que vérifie `tests/e2e/tiktok.spec.ts` (console streamer → overlay 1920×1080 + console → 4 spectateurs A/B/C/D → révélation → 20 questions → classement final → fermeture). À ne pas utiliser pour un vrai live.

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
TIKTOK_ADAPTER=live                # défaut
TIKTOK_USERNAME=<live par défaut>  # facultatif : chaque room peut nommer son live
TIKTOK_SESSION_COOKIE=sessionid=<valeur>; tt-target-idc=<valeur>
# optionnel : clé Euler Stream (quotas du service de signature)
TIKTOK_SIGN_API_KEY=
```

Au démarrage, le serveur refuse `TIKTOK_ENABLED=true` (adaptateur `live`) sans `TIKTOK_SESSION_COOKIE`, un `TIKTOK_USERNAME` qui n'est pas un pseudo TikTok et un `TIKTOK_ADAPTER` autre que `live`/`fake`. En production il refuse aussi de démarrer si le paquet optionnel n'est pas installé (image construite sans `WITH_TIKTOK=true`) ; en développement il avertit et reste en mode manuel. Si le live se coupe, le connecteur reste déconnecté, réessaie avec backoff, `POST /api/tiktok/rooms` répond `TIKTOK_NOT_CONNECTED` et la santé est `degraded`.

Tests : `tests/tiktok/connector.test.ts` vérifie que `tiktokSetup` câble bien `LiveTikTokAdapter` sur le live demandé par la room (module simulé) et, avec un module simulé, les options passées au paquet (cookie de session, `authenticateWs`, clé de signature), la conversion des messages `chat`, la gestion de `streamEnd`/`disconnected`, le silence sur `error`, et que le vrai paquet installé expose bien `TikTokLiveConnection`.

> `liveAdapter.ts` suit l'API publique de `tiktok-live-connector` 2.5 (événements `chat`, `disconnected`, `streamEnd`, option `session.cookie`). Il n'a **pas** pu être exécuté contre un vrai live dans cet environnement : la validation ci-dessous est obligatoire.

## Checklist manuelle avant un live

- [ ] Compte secondaire dédié, jamais le compte principal.
- [ ] `ADMIN_TOKEN` et `TIKTOK_SESSION_COOKIE` stockés comme secrets, jamais dans le dépôt.
- [ ] `GET /api/health` retourne `ok` (connecteur connecté).
- [ ] Création de room depuis `/?mode=admin` (ou `curl -X POST /api/tiktok/rooms` avec le bearer admin et `{"mode":"CLASSIC","liveUsername":"@live"}`).
- [ ] Overlay OBS : URL `/?mode=overlay&room=CODE&voice=1#token=OVERLAY_TOKEN`, affichage sans contrôle.
- [ ] Voix : l'état « Voix : <nom> » dans le lobby de l'overlay, ou la console comme voix (option B) ; « Tester la voix » entendu dans OBS.
- [ ] Console : URL `/?mode=control&room=CODE#token=CONTROL_TOKEN`, badge `LIVE`.
- [ ] 20 viewers de test répondent ; vérifier dédup, élimination, top 10.
- [ ] Couper le réseau du serveur : badge `CHAT OFFLINE`, room en pause, reprise manuelle.
- [ ] Live d'une heure sans fuite mémoire ni déconnexion non récupérée.
- [ ] Aucun cookie ni token dans les logs (`grep -i -E 'sessionid|ctl_|ovl_'`).
