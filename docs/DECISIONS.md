# Encycla — Journal des décisions

- Version : 1.0
- Date : 2026-10-22
- Statut : toutes les questions ouvertes de la revue initiale sont tranchées
- Règle : une décision ci-dessous est contraignante. La modifier exige un ADR de remplacement et une mise à jour de ce journal.

Ce fichier répond point par point aux ambiguïtés relevées dans le README v1 et dans le prototype. Il sert de matrice de traçabilité entre un doute, la décision, sa justification et le document de référence.

## A. Produit et modes

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-01 | Le socle existant doit-il être conservé tel quel ? | Non. Le client actuel devient une base visuelle ; toute la logique de jeu est réécrite côté serveur. | Le prototype est mono-client, sans autorité, sans reconnexion et sans anti-triche. | ADR-001, ADR-012 |
| D-02 | Quels sont les modes en v1 ? | CLASSIC, SUBJECT, CONTEST. CLASSIC et SUBJECT sont solo ou room ; CONTEST est un duel en ligne à 2. | Préserve les trois entrées du prototype tout en supprimant le local. | ADR-003 |
| D-03 | Le CONTEST local à deux sur un clavier est-il conservé ? | Non. Il est remplacé par un duel en ligne, un joueur par appareil. | Un socket = un joueur ; l'autorité serveur et la reconnexion deviennent possibles. | ADR-003, ADR-012 |
| D-04 | Le jeu peut-il fonctionner hors-ligne ? | Non en v1. Toute partie nécessite le serveur. | Source de vérité unique et anti-triche. | ADR-001, ADR-018 |
| D-05 | Une partie solo est-elle une room ? | Oui, une room avec un seul joueur humain. | Un seul moteur et un seul protocole. | ADR-003 |
| D-06 | Combien de joueurs par room web ? | 2 à 8 en room privée/publique ; 1 en solo. | Le prototype est à 2, le README parle de 4 ; 8 laisse de la marge sans complexifier l'UI. | ADR-003, ADR-010 |
| D-07 | Combien de viewers TikTok ? | 100 viewers rejoints maximum (éliminés inclus), 20 visés pour le live de validation. | Le README cible 20 viewers ; 100 absorbe un pic sans changer l'architecture. | ADR-003, ADR-014 |
| D-08 | Le host est-il un joueur ? | Oui en web ; non en TikTok (il est spectateur et opérateur). | En live, le host doit surveiller le chat et l'overlay. | ADR-009, ADR-014 |

## B. Progression, vies, temps

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-09 | Progression partagée ou par joueur ? | Partagée par la room. | Tous les joueurs doivent voir la même question et le même article. | ADR-004 |
| D-10 | Un niveau se termine sur 20 bonnes réponses ou 20 questions ? | 20 questions résolues. | Une room peut avoir des joueurs faux ; la progression ne doit pas dépendre de la performance. | ADR-004 |
| D-11 | Les vies sont-elles rechargées ? | Solo CLASSIC/SUBJECT : oui, à chaque niveau. Rooms et TikTok : non, persistantes. | Campagne solo jouable ; élimination significative en compétition. | ADR-005 |
| D-12 | Que fait un timeout ? | Mauvaise réponse automatique : 0 point, -1 vie, série remise à zéro. | Comportement uniforme et testable. | ADR-005, ADR-006 |
| D-13 | L'article est-il affiché après une mauvaise réponse ? | Oui, après chaque question. | Vocation encyclopédique et cohérence du prototype. | ADR-004 |
| D-14 | Combien de temps dure un article ? | 2,5 s de révélation puis article ; 30 s maximum en web, 8 s en TikTok. | Laisse le temps de lire sans bloquer un live. | ADR-004, ADR-006 |
| D-15 | Qui peut passer à la suite ? | Tous les joueurs actifs connectés doivent cliquer `CONTINUE`, ou le timeout de phase avance. | Synchronisation de la room ; les éliminés, forfaits et déconnectés ne bloquent pas. | ADR-004 |
| D-16 | Le timer peut-il être mis en pause ? | Oui : host d'une room privée, joueur solo et control TikTok. Jamais le host d'une room publique. Auto-reprise après 120 s hors TikTok. | Fiabilité du live et secours manuel, sans permettre à un host public de bloquer la partie. | ADR-006, ADR-015 |
| D-17 | Le timer est-il un tick serveur de 200 ms ? | Non. Échéance absolue + synchronisation toutes les 5 s. | Même garantie d'autorité, charge réseau bien moindre. | ADR-006 |

## C. Score et classement

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-18 | Formule CLASSIC/SUBJECT ? | `round(100 × multiplicateur difficulté × niveau) + bonus vitesse + bonus série`. | Reprend l'esprit du prototype et rend la difficulté significative. | ADR-005 |
| D-19 | Formule CONTEST ? | 1000 points par bonne réponse ; +200 au(x) plus rapide(s) si au moins deux bonnes réponses. | Reprend le duel existant. | ADR-005 |
| D-20 | Le bonus de série est-il plafonné ? | Oui, 10 niveaux de série = 200 points maximum. | Évite les scores exponentiels. | ADR-005 |
| D-21 | Les points sont-ils visibles avant la révélation ? | Non. Les scores du snapshot sont mis à jour à `REVEAL`. | Ne pas révéler la justesse d'une réponse par le score. | ADR-005, ADR-011 |
| D-22 | Comment départager deux joueurs ? | Survie, points, bonnes réponses, mauvaises réponses + timeouts, temps cumulé, ordre d'arrivée, égalité. | Classement déterministe et reproductible. | ADR-005 |
| D-23 | Un joueur éliminé peut-il encore gagner ? | Non, sauf si tous les joueurs sont éliminés en même temps : classement au score. | L'élimination doit avoir un sens. | ADR-005 |
| D-24 | Que devient un joueur qui quitte ? | Forfait : score conservé, non actif, non gagnant. | Empêche le farming et clarifie les rooms. | ADR-005, ADR-009 |

## D. Questions et contenu

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-25 | Où vivent les questions ? | `data/questions.json` (source éditoriale) synchronisée vers SQLite (source d'exécution). | Une source relue, versionnée, et une lecture rapide en jeu. | ADR-007, DATA-MODEL |
| D-26 | Gemini est-il utilisé en direct ? | Non. Gemini est un outil de production hors ligne ; validation humaine obligatoire. | Qualité, latence, coût et sécurité. | ADR-007 |
| D-27 | Combien de questions pour CLASSIC ? | Au moins 200 approuvées uniques ; 10 niveaux × 20. | Le pool actuel en contient 244 uniques. | ADR-007 |
| D-28 | Combien de questions par catégorie pour SUBJECT ? | Au moins 20 ; sinon la catégorie est désactivée. | Le pool actuel en contient 12 à 16 ; c'est une dette de contenu assumée. | ADR-007 |
| D-29 | Que fait-on des questions générales en doublon ? | Fusion et déduplication par titre/question/options ; pas de pool général au runtime. | 12 des 20 questions générales recoupent des sujets catégorisés, soit 13 groupes de doublons au total avec un doublon interne à une catégorie. | DATA-MODEL |
| D-30 | La difficulté filtre-t-elle les questions ? | Non. C'est un profil de timer et de score. | Évite une distribution impossible par difficulté. | ADR-008 |
| D-31 | Faut-il mélanger les options ? | Oui, à chaque tirage, avec un RNG injecté. | 155 bonnes réponses sur 257 sont en position B ; biais majeur. | ADR-007 |
| D-32 | Que faire si le pool est épuisé ? | Recycler la plus ancienne question et logguer un avertissement. | Ne jamais bloquer une partie. | ADR-007 |
| D-33 | Les articles peuvent-ils contenir du HTML ? | Non, texte brut uniquement. | Supprime la surface XSS. | ADR-007, ADR-016 |
| D-34 | Quel champ image ? | `image.url`, `image.alt`, crédit et licence. | Le champ `base64Image` actuel contient des URLs, pas du base64. | DATA-MODEL |

## E. Sessions et reconnexion

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-35 | Qui génère le `playerId` ? | Le serveur. | Empêche l'usurpation. | ADR-009 |
| D-36 | Comment authentifier un joueur ? | Token opaque `sess_...`, stocké haché en base, envoyé en Bearer/Socket auth. | Révocable et sans mot de passe. | ADR-009 |
| D-37 | Combien de temps pour se reconnecter ? | 30 s en partie. | Laisse le temps à une coupure réseau courte. | ADR-009 |
| D-38 | Que se passe-t-il si le host part ? | Transfert au plus ancien joueur connecté en lobby ; en partie, la room continue. | Évite les rooms orphelines. | ADR-009 |
| D-39 | Plusieurs onglets ? | Le dernier socket remplace l'ancien. | Une seule connexion active par session. | ADR-009 |

## F. Matchmaking

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-40 | Seuil public ? | CONTEST : 2. CLASSIC/SUBJECT : 4. | Un duel à 4 n'a pas de sens ; les autres modes gardent le seuil du README. | ADR-010 |
| D-41 | Que se passe-t-il après 2 minutes ? | Proposition small-room, vote de 15 s, majorité stricte des électeurs. | Règles déterministes et anti-abus. | ADR-010 |
| D-42 | Les non-réponses au vote ? | Comptées comme refus. | Pas de majorité fantôme. | ADR-010 |
| D-43 | Qui devient host en public ? | Le plus ancien joueur, sans privilège de démarrage. | Auto-start. | ADR-010 |
| D-44 | Un joueur peut-il rejoindre une partie en cours ? | Non. | Évite les déséquilibres et les fuites d'état. | ADR-010 |

## G. TikTok, overlay, sécurité

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-45 | Quand un viewer rejoint-il ? | Au premier commentaire valide A/B/C/D pendant `QUESTION`. | Évite les listes de joueurs fantômes. | ADR-014 |
| D-46 | Comment parser un commentaire ? | Normalisation stricte ; résultat exactement `a`, `b`, `c` ou `d`. | Évite les faux positifs et le bruit. | ADR-014 |
| D-47 | Une seule réponse par question ? | Oui, la première réponse valide gagne. | Anti-spam et équité. | ADR-014 |
| D-48 | Que faire si le connecteur TikTok tombe ? | Pause automatique, overlay en état dégradé, fallback manuel via console host. | Le live doit continuer. | ADR-014 |
| D-49 | Comment protéger l'overlay ? | Token overlay en lecture seule, token control séparé, tous deux hachés et scoped à la room. | Évite l'observation/pilotage non autorisé. | ADR-015 |
| D-50 | La bonne réponse est-elle envoyée au client ? | Jamais avant `REVEAL`. | Anti-triche. | ADR-001, ADR-016 |
| D-51 | Comment éviter le XSS ? | Aucun `dangerouslySetInnerHTML`, article en texte brut, CSP, React escaping. | Supprime la classe d'attaque. | ADR-016 |
| D-52 | Où est la clé Gemini ? | Nulle part en v1 ; si réintroduite, serveur uniquement. | Le prototype l'injecte dans le bundle client. | ADR-016 |
| D-53 | Rate limiting ? | 100 req/min/IP, 10 événements/s/socket, limites renforcées sur sessions/join. | Protège le serveur et les rooms. | ADR-016 |

## H. Client, UI, accessibilité

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-54 | Quelle est la source d'état du client ? | Zustand, alimenté uniquement par les snapshots serveur. | Une seule frontière transport/UI. | ADR-012 |
| D-55 | Le client calcule-t-il quelque chose ? | Non. Il affiche, envoie des intentions et gère l'UI transitoire. | Autorité serveur. | ADR-001, ADR-012 |
| D-56 | Clavier AZERTY ? | Utiliser `KeyboardEvent.code` (`Digit1..Digit4`, `KeyA..KeyD`) et non `key`. | Indépendant de la disposition. | ADR-017, UI-UX |
| D-57 | Mobile ? | 4 gros boutons A-D, cibles ≥ 44 px, pas de split-screen. | Un seul joueur par appareil. | ADR-017, UI-UX |
| D-58 | Langue ? | **Remplacée par D-84 à D-95** : UI et contenu en français par défaut, avec l'anglais et l'arabe (RTL) disponibles ; documentation en français. | Décision du propriétaire du projet : tout en français par défaut, plus l'anglais et l'arabe. | D-84 à D-95, UI-UX §20 |
| D-59 | Marque ? | Encycla. Le nom de la marque encyclopédique historique est banni. « MindMaze » peut rester comme nom du jeu. | Risque de marque et cohérence. | README, UI-UX |
| D-60 | Sons ? | 5 fichiers, préchargés après interaction, mute persistant, overlay muet par défaut. | Autoplay navigateur et confort. | ADR-017 |

## I. Plateforme et exploitation

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-61 | Ports de développement ? | Serveur 3000, Vite 5173, proxy. | Le prototype et le README se disputent le port 3000. | ADR-002, DEPLOYMENT |
| D-62 | Ports de production ? | Un seul port 3000, Express sert le build Vite. | Simplicité CORS/CSP. | ADR-002, DEPLOYMENT |
| D-63 | Base de données ? | SQLite WAL, better-sqlite3, migrations versionnées. | Volume et simplicité v1. | ADR-013 |
| D-64 | Leaderboard ? | Matchs terminés avec ≥ 2 joueurs ; scores `completed` et `eliminated` ; forfaits et abandons exclus ; somme des points ; top 50. | Évite le farming solo et la récompense de l'abandon. | ADR-013 |
| D-65 | Plusieurs instances serveur ? | Non en v1. | Rooms en mémoire et SQLite local. | ADR-018 |
| D-66 | Redémarrage serveur ? | Rooms perdues ; matchs en cours marqués abandonnés ; joueurs renvoyés au menu. | Cohérence et simplicité. | ADR-013 |
| D-67 | CI ? | lint, typecheck, data:validate, tests unitaires/intégration + couverture, build, E2E Chromium, Gitleaks et audit sur PR et main. | Qualité reproductible. | ADR-018, DEPLOYMENT |
| D-68 | Docker ? | Multi-stage, runtime non-root, volume `/app/data`, healthcheck. | Déploiement reproductible. | DEPLOYMENT |
| D-69 | Critères de sortie ? | 2 joueurs privé/public, overlay TikTok, 1 h / 20 viewers, latence p95 < 500 ms, leaderboard persistant. | Reprend et rend mesurables les critères du README. | TESTING, DEPLOYMENT |

## J. Précisions de contrat

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-70 | Que peut passer le host ? | Host privé : `ARTICLE` et `LEVEL_COMPLETE` uniquement. Control TikTok : les mêmes phases, plus `QUESTION` ; jamais `REVEAL`. Solo et host public : aucun skip. | Empêche un host de sauter une question pour fausser la partie, et interdit de masquer la révélation. | ADR-006 |
| D-71 | Comment lancer une partie solo ? | `POST /api/solo` avec `mode`, `category?`, `difficulty?`, `language?` ; room à 1 joueur, auto-start immédiat. | Évite de faire passer le solo par le lobby ou le matchmaking. | PROTOCOL, SPECIFICATION |
| D-72 | Une room publique est-elle rejoignable par code ? | Non. Les rooms publiques sont remplies uniquement par le matchmaking ; `ROOM_JOIN` est réservé aux rooms privées. | Empêche de contourner la file et de choisir ses adversaires. | SPECIFICATION, PROTOCOL |
| D-73 | Quels scores entrent au leaderboard ? | `completed` et `eliminated` uniquement ; `forfeited` et `abandoned` exclus. | Un forfait ne doit pas être récompensé. | ADR-013, DATA-MODEL |
| D-74 | Que contient `totalResponseMs` ? | La somme des temps des réponses fournies, plus `timerMs` pour chaque timeout. | Un timeout ne doit pas améliorer le départage au temps. | ADR-005 |
| D-75 | `wrongCount` inclut-il les timeouts ? | Non. `wrongCount` compte les réponses fausses ; `timeoutCount` compte les timeouts. | Évite le double comptage dans le départage. | ADR-005, DATA-MODEL |
| D-76 | Où sont transmis les tokens overlay/control ? | Dans le fragment d'URL (`#token=...`), puis dans `handshake.auth.token`. | Le fragment n'est jamais envoyé au serveur HTTP ni loggué. | ADR-015, SECURITY |
| D-77 | Que faire si SQLite est indisponible ? | Le serveur démarre en mode dégradé : sessions et scores en mémoire, questions depuis le JSON, leaderboard `PERSISTENCE_DISABLED`. | Le jeu reste jouable ; la persistance est sacrifiée, pas la disponibilité. | ADR-013, DATA-MODEL |
| D-78 | Quelle est la longueur maximale d'un pseudo ? | 2 à 24 graphèmes après normalisation. | Aligné sur ADR-016 et lisible dans le lobby. | ADR-016, SECURITY |
| D-79 | Une room TikTok se résout-elle dès que tous les viewers présents ont répondu ? | Non : une question TikTok va toujours jusqu'à son timer (ou `HOST_SKIP`). | Un viewer devient joueur en répondant ; « tous les actifs ont répondu » serait vrai dès le premier commentaire et terminerait la question en moins d'une seconde. | SPECIFICATION 14, PROTOCOL 6.2 |
| D-80 | D'où viennent les questions ? | De Wikipédia (fr) et Wikimedia Commons, par `pnpm run data:wikipedia`. Seuls les titres d'articles sont choisis à la main (`scripts/wikimedia/seeds/`) ; réponse, explication, article, image, auteur, licence et révision sont lus via l'API. Rien n'est inventé. | Contenu vérifiable, traçable (permalien `oldid`) et reproductible ; remplace la banque legacy. | DATA-MODEL §6 |
| D-81 | Quelles images et quelles licences ? | Commons uniquement : CC0, domaine public, CC BY, CC BY-SA. Auteur obligatoire pour les licences à attribution. Auteur, licence et page du fichier sont stockés et listés dans `CREDITS.md`. Les vignettes sont en 960 px. | Respect des licences ; Commons refuse les largeurs non standard (640 px répond 400). | DATA-MODEL §6 |
| D-82 | Comment sont construites les options ? | Un seul sujet par question ; les 3 distracteurs sont de vrais sujets du même type, du même groupe de préférence, jamais la même entité Wikidata ni un libellé contenant l'autre ; mélange déterministe par graine. | Distracteurs plausibles mais faux, génération reproductible. | DATA-MODEL §6 |
| D-83 | Quel seuil SUBJECT ? | `MIN_QUESTIONS_PER_CATEGORY = 100` (au lieu de 20) ; une partie SUBJECT tire toujours 20 questions. | Évite qu'un joueur revoie les mêmes sujets ; 18 catégories sur 18 l'atteignent. | DATA-MODEL §6, PROTOCOL |

## K. Langues (français par défaut, anglais, arabe)

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-84 | Quelles langues et quel défaut ? | Français (défaut), anglais, arabe. Le défaut est le français **quelle que soit la langue du navigateur** : celle-ci n'est pas détectée. | Décision du propriétaire : « tout en français par défaut, plus l'anglais et l'arabe ». Un défaut prévisible évite qu'un même lien affiche des langues différentes. | UI-UX §20 |
| D-85 | Comment la langue de l'interface est-elle choisie et conservée ? | Ordre de priorité : paramètre d'URL `?lang=` puis `localStorage` (`encycla.lang.v1`) puis français. Le sélecteur de l'en-tête écrit les deux (et met à jour `<html lang dir>` et le titre). | Un lien partageable impose sa langue ; le choix de l'utilisateur survit aux rechargements. | UI-UX §20 |
| D-86 | Comment l'arabe est-il géré ? | `dir=rtl` sur `<html>`, CSS logique uniquement (`ms-*`, `pe-*`, `text-start`, `border-s`…), icônes directionnelles et anneau du timer en miroir, pas de lettrine, polices Noto Sans Arabic (interface) et Noto Naskh Arabic (titres et articles) auto-hébergées. Les codes de salon, les lettres A-D et le logo restent `dir=ltr` ; les pseudos utilisent `dir=auto`. | Une vraie mise en page RTL, pas un texte arabe dans une mise en page LTR. | UI-UX §20 |
| D-87 | Quels chiffres en arabe ? | Chiffres occidentaux (0-9) partout, y compris en arabe (`ar-u-nu-latn`). | Scores, timer et codes restent identiques d'une langue à l'autre et lisibles sur un écran partagé ; les commandes de chat TikTok restent A/B/C/D. | UI-UX §20 |
| D-88 | Quelle langue pour les questions ? | La langue de la **room** (champ `language` de `PublicRoomState`), choisie à la création (`language` dans `POST /api/solo`, `/api/rooms`, `/api/queue`) ; elle vaut par défaut la langue de l'interface du créateur. Chaque joueur garde son interface dans sa langue ; le contenu de la question porte ses propres `lang` et `dir`. | L'état de room est diffusé à l'identique à tous les clients : une langue par joueur obligerait à diffuser trois versions de chaque question et fausserait l'équité d'un duel. | PROTOCOL §3, UI-UX §20 |
| D-89 | Le matchmaking public tient-il compte de la langue ? | Oui : les files sont partitionnées par langue (mode, catégorie, difficulté **et** langue). | Deux joueurs appariés doivent lire les mêmes questions. | PROTOCOL §3.6 |
| D-90 | Comment sont stockées les traductions des questions ? | Le français reste la base (`id`, image, `correctIndex`, ordre des options). `translations.en` et `translations.ar` portent sujet, énoncé, 4 options (même ordre), explication, titre et texte d'article, alt et crédit de l'image, `source` (permalien de la révision de l'article de cette langue) et `provenance`. Le serveur localise au tirage ; le mélange est identique dans les trois langues. | Mêmes photos, mêmes réponses et même position de la bonne réponse dans toutes les langues ; une seule source de vérité pour l'identifiant. | DATA-MODEL §6 |
| D-91 | D'où viennent les libellés traduits et que fait-on quand il n'y en a pas ? | Échelle stricte, jamais d'invention : titre de l'article Wikipédia de la langue (sitelink Wikidata) → libellé Wikidata de la langue → libellé français. Le texte de l'article est celui de l'article de la langue, sinon l'article français (avec la révision française comme source). Chaque repli est marqué `fallback-fr` dans `provenance` et compté par `pnpm run data:validate` et `data/sources/report.json`. | Honnêteté sur ce qui n'est pas traduit et possibilité de corriger. | DATA-MODEL §6, README |
| D-92 | Comment sont traduits les distracteurs ? | Chaque distracteur est un vrai sujet : il est traduit avec **son propre** libellé dans la langue (même échelle que D-91), pas avec une traduction de la chaîne française. En cas de collision de libellés dans une langue, on utilise le titre complet de l'article, puis le libellé français. Les sujets sans libellé réel dans une langue sont écartés en priorité comme distracteurs. | Cohérence : une même entité s'appelle pareil partout dans la banque ; pas de distracteur absurde dû à une traduction mot à mot. | DATA-MODEL §6 |
| D-93 | Que traduit-on dans les messages du serveur ? | Le serveur n'envoie que des **codes** d'erreur ; le client les traduit (`error.<CODE>`). Les textes envoyés par le serveur (questions) viennent de la banque. Les journaux et la documentation restent en français/anglais techniques. | Une seule couche de traduction, côté client ; pas de chaînes d'interface dans le serveur. | PROTOCOL §2 |
| D-94 | TikTok est-il affecté ? | Non. Les spectateurs répondent toujours par A/B/C/D (ou 1-4) ; l'overlay et la console suivent la langue de l'interface, la question celle de la room. | Le protocole de réponse ne dépend pas de la langue. | TIKTOK |
| D-95 | La langue est-elle persistée avec les matchs ? | **Oui** (révisé) : colonne `matches.language` (`fr`, `en`, `ar`, défaut `fr` pour l'historique, migration 004). Le leaderboard reste commun par défaut et accepte un filtre `language` optionnel. | Statistiques et classements par langue possibles sans segmenter le classement par défaut. | DATA-MODEL §3, PROTOCOL §3.8 |

## L. Licence, TikTok et production

| ID | Question | Décision | Justification | Référence |
| --- | --- | --- | --- | --- |
| D-96 | Sous quelle licence est le code ? | **MIT** (`LICENSE`). Elle ne couvre que le code ; le contenu (CC BY-SA 4.0 / CC0 / licences Commons), les polices (OFL) et le connecteur TikTok (AGPL) gardent leur licence. | Décision du propriétaire ; licence simple et compatible avec toutes les dépendances. | LICENSES |
| D-97 | Comment intégrer `tiktok-live-connector` (AGPL-3.0) ? | Dépendance **optionnelle** (`optionalDependencies`, version épinglée), chargée par `import()` dynamique dans le seul `liveAdapter.ts`, derrière `TikTokAdapter`. Image Docker par défaut **sans** le paquet (`WITH_TIKTOK=false`) ; l'opérateur l'active explicitement. | Le code MIT reste utilisable sans AGPL ; l'obligation AGPL ne naît que pour une instance qui l'active. | TIKTOK, LICENSES §3 |
| D-98 | Que fait le serveur avec une configuration de production incomplète ? | **Fail-fast** avant d'ouvrir la base : `ADMIN_TOKEN` ≥ 32 caractères, ni valeur d'exemple ni trop peu de caractères distincts ; `PUBLIC_ORIGIN` en `https://` ; pas de `RATE_LIMIT=off` ; paquet TikTok présent si `TIKTOK_ENABLED=true`. Un `ADMIN_TOKEN` faible est refusé partout (sauf `change-me` hors production), au lieu de désactiver l'admin en silence. | Une erreur de déploiement doit se voir immédiatement, pas pendant un live. | DEPLOYMENT §6.1 |
| D-99 | Comment interpréter `TRUST_PROXY` ? | `false` (défaut), `true` = un proxy, ou un nombre de sauts 1-10. Jamais le `true` d'Express. | Empêche la falsification d'IP qui contournerait le rate limiting. | DEPLOYMENT §6.4, SECURITY |
| D-100 | Quand annoncer le timer aux lecteurs d'écran ? | Aux seuils 10 s, 5 s et 0 (« Temps écoulé. ») via la région `polite` existante, **uniquement** au joueur qui n'a pas encore répondu et hors pause ; si un onglet ralenti saute plusieurs seuils, seul le dernier est dit. | UI-UX 21.2 sans bavardage pour ceux qui attendent les autres. | UI-UX §21.2 |
| D-101 | Quelles tailles d'image demander à Wikimedia ? *(mise en œuvre côté serveur depuis D-107 : le client ne voit que `/img/<jeton>?w=`)* | Uniquement les largeurs standard Commons (330, 500, 960 ; 1280 si la vignette stockée le permet) dans un `srcset`, avec un `sizes` identique dans toutes les vues pour réutiliser le cache. Les fichiers originaux (plus étroits que 960 px) n'ont pas de `srcset`. Un échec du `srcset` retente l'URL stockée, puis affiche « image indisponible ». | Le CDN Wikimedia refuse les largeurs non standard ; moins d'octets sur mobile. | UI-UX §24 |
| D-102 | Précharger l'image de la question suivante ? | **Non** côté client : le snapshot n'expose la question qu'à `QUESTION`, et l'URL Commons nomme souvent le sujet. Le chargement est rendu par un squelette et `fetchpriority="high"`. | Ne pas révéler la réponse avant la question (le serveur précharge déjà, SPEC §6.1). | SPECIFICATION §6.1 |
| D-103 | Comment alléger ce que télécharge le navigateur ? | Les assets hashés sont précompressés au build (`scripts/compress-assets.mjs`, brotli + gzip) et servis selon `Accept-Encoding` avec `Vary` et `immutable` ; l'overlay et la console sont des chunks séparés (`React.lazy`). La banque de questions (≈ 17 Mo) **n'est jamais envoyée au client** : seul le serveur la charge, une question à la fois passe dans le snapshot, donc pas de découpage par langue côté client. | Moins d'octets sans compression à chaque requête ; Caddy n'encode pas une réponse déjà encodée. | DEPLOYMENT, SECURITY §6.6 |
| D-104 | PWA et métadonnées ? | Manifeste web, icône SVG (monogramme provisoire), `robots.txt`, `description` et Open Graph en français (langue par défaut). **Pas de service worker** (SECURITY §6.6) : le jeu exige le serveur en temps réel. Pas d'`og:image` tant qu'aucun visuel officiel ni `PUBLIC_ORIGIN` absolu n'est fourni. | Installable et partageable sans cache applicatif risqué. | SECURITY §6.6 |
| D-105 | Comment rapprocher les distracteurs des êtres vivants ? | Faune, oiseaux, insectes, flore, arbres et champignons : la taxonomie Wikidata (P171 transitif, via le Query Service, mise en cache) classe les candidats par nombre de taxons ancêtres partagés, à l'intérieur des paliers de D-82 (groupe, catégorie). **Au plus un** distracteur du même taxon parent direct (en général le genre) ; ces paires sont listées dans `data/sources/report.json` (`taxonomy.sameGenusPairs`) pour relecture des images trop semblables. Les noms vernaculaires arabes (P1843, non dépréciés) servent de libellé arabe réel quand il n'y a ni article ni libellé arabe. | Distracteurs plausibles (« Ours brun » contre d'autres ours, plus contre un éléphant) sans quatre sosies ; rien d'inventé. | DATA-MODEL §6 |
| D-106 | Quels « extras » de jeu ajouter ? | Seulement ce que la spécification prévoit déjà : `bestStreak` (SPEC §7.4, déjà calculé par le serveur) est exposé dans `PublicPlayer` et affiché au classement final. Les niveaux de difficulté et la série existent déjà. Pas de statistiques par catégorie ni d'historique : « Replay ou historique de partie » est un non-objectif v1 (SPEC §19). | Pas de fonctionnalité hors spécification. | SPECIFICATION §7.4, §19, PROTOCOL |
| D-107 | Comment empêcher qu'une image révèle la réponse ? | **Proxy d'images same-origin** (remplace « pas de self-hosting des images en v1 », D-101 côté client et la partie « URL Commons » de D-102). Le snapshot `QUESTION` ne porte plus que `{ url: "/img/<jeton>", alt, widths }` : jeton aléatoire de 128 bits par manche et par image (en mémoire, 2 h, 50 000 au plus), aucun nom de fichier, crédit, licence, auteur ni `sourceUrl`, et un `question.id` opaque (identifiant de manche, plus le slug de la banque) ; `subject` n'est plus dans `QuestionView`. Le serveur ne récupère que `https://upload.wikimedia.org/wikipedia/commons/…` (regex stricte, pas de redirection, 10 s, 10 Mo), aux seules largeurs 330/500/960 (`?w=`), n'accepte que JPEG/PNG reconnus par leurs octets, retire EXIF/XMP/IPTC/commentaires et chunks texte PNG, ajoute un bourrage déterministe par jeton (anti-empreinte de taille/hash), cache disque plafonné (`IMAGE_CACHE_DIR`, `IMAGE_CACHE_MAX_MB`) et mémoire (64 Mo), répond avec `Cache-Control: private` jusqu'à l'expiration du jeton, un `ETag` propre au jeton, sans `Content-Disposition` ni `Last-Modified`, 300 requêtes/min/IP. Crédits, licence et lien Commons n'arrivent qu'avec `REVEAL`, sous la même URL `/img/…` (cache navigateur réutilisé). CSP `img-src 'self'`. | Les noms de fichiers Commons nomment presque toujours le sujet : l'URL, le `srcset`, l'onglet Réseau ou un `alt` suffisaient à tricher. Risque résiduel assumé : la reconnaissance visuelle (recherche d'image inversée), inhérente à un quiz d'images. | SECURITY §5.4, DEPLOYMENT §7, PROTOCOL |

## Points qui ne sont plus des questions ouvertes

Les sujets suivants ont été explicitement fermés et ne doivent plus être rediscutés sans ADR :

- le mode CONTEST local ;
- le calcul du score côté client ;
- le timer côté client ;
- les vies rechargées en multi-joueurs ;
- le seuil public unique de 4 pour tous les modes ;
- le vote small-room à la majorité des votants ;
- le `playerId` fourni par le client ;
- la génération Gemini en direct ;
- le HTML dans les articles ;
- l'overlay sans token ;
- l'inclusion du solo dans le leaderboard ;
- le support multi-instance en v1.

## Contenu : la dette legacy est soldée

La banque legacy de 244 questions (anglais, licences « See source file », 12 à 16 par catégorie) a été remplacée par une banque de plus de 2 500 questions générées depuis Wikipédia et Wikimedia Commons (D-80 à D-83). Une catégorie sous le seuil SUBJECT reste **bloquée proprement** plutôt que de répéter des questions ou de changer silencieusement la longueur d'une partie.

## Dette d'exploitation explicitement assumée

- Une seule instance serveur.
- Rooms en mémoire, perdues au redémarrage.
- Rate limiting en mémoire.
- Connecteur TikTok non officiel.
- Pas de CDN pour les polices, le JS ou le CSS. Les images Wikimedia sont servies par notre propre serveur (proxy `/img`, D-107, qui remplace l'ancienne règle « pas de self-hosting des images en v1 ») ; leur cache disque est jetable et plafonné.

Ces limites sont des décisions, pas des oublis.
