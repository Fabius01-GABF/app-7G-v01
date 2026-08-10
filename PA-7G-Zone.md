# 7G ZONE — PLAN D'ACTION MAÎTRE

**Version :** 1.0 — **Statut :** Source de vérité fonctionnelle & technique
**Produit par :** Skill 01 (7G Zone PA Architect) — **Date :** 2026-08-09

---

## 01. Résumé exécutif

7G Zone est une application mobile-first réunissant **7 jeux de société dans une seule application** : Monopoly, UNO, Ludo, Chess, Checkers, Domino et Quiz. Le MVP livrable est une application **réellement fonctionnelle et installable sur Android** : authentification réelle, backend réel, base de données réelle, 7 moteurs de jeu réellement jouables (solo contre IA, et en local), un système multijoueur en ligne réel (salles privées + matchmaking + synchronisation temps réel), des profils, des classements, des récompenses, un espace d'administration et une interface responsive mobile-first. Le produit est construit avec React + TypeScript (frontend), Node.js + TypeScript (backend), SQLite (base de données réelle — dérogation documentée, voir §41), Socket.IO (temps réel) et Capacitor pour l'emballage Android.

## 02. Vision

Offrir **7 jeux de société emblématiques, légaux et originaux, réunis dans une seule application mobile simple, fluide et sociale**, jouables en quelques secondes avec des amis ou des IA.

## 03. Objectifs

1. Livrer une application Android installable (APK réel).
2. Authentification et profils réels (serveur + base de données).
3. 7 jeux réellement jouables, règles correctes, IA non tricheuse.
4. Multijoueur en ligne réel pour les jeux à 2 joueurs et le Quiz.
5. Classements, XP, niveaux et récompenses calculés côté serveur.
6. Administration fonctionnelle (dashboard, utilisateurs, quiz, modération, paramètres).
7. Interface responsive de 320 px à 430 px et tablettes.

## 04. Public cible

- **Joueur occasionnel** (14–40 ans) : parties rapides de 5–20 minutes, seul contre IA.
- **Joueur social** : salles privées, parties entre amis, Quiz.
- **Joueur compétitif** : classements, victoires, progression.
- **Joueur solo** : tous les jeux contre IA de difficultés variées.
- Personas retenus pour la conception : casual (Léo, 16 ans), social (Marie, 28 ans), compétitif (Adam, 24 ans).

## 05. Proposition de valeur

**7 univers de jeux de société dans une seule application** : une seule inscription, une seule progression, un seul classement, zéro installation multiple. Interface mobile pensée pour jouer avec le pouce, parties rapides, sans compte bancaire, sans publicité intrusive dans le MVP.

## 06. Périmètre

### MVP (à livrer)

- Auth réelle (inscription, connexion, déconnexion, session JWT).
- Profil (pseudo, avatar, statistiques, XP, niveau).
- Lobby central + sélection des 7 jeux.
- Les 7 jeux jouables **solo contre IA** avec règles correctes.
- Modes **local** (2 joueurs même appareil) pour les jeux le permettant (Chess, Checkers, UNO, Domino, Ludo).
- Multijoueur en ligne réel : salles privées (code) + matchmaking pour les jeux 2 joueurs (Chess, Checkers, UNO, Domino, Ludo, Quiz).
- Quiz : questions administrables côté admin, stockées en base.
- Classements global + par jeu (côté serveur).
- XP, niveaux, badges simples, récompenses quotidiennes simulées.
- Amis : demandes, acceptation, refus, liste, invitations de partie.
- Notifications internes (invitation, demande d'ami, résultat).
- Administration : dashboard, utilisateurs, jeux (activation), quiz (CRUD), modération (signalements), paramètres (identité), logs.
- RBAC : Super Admin, Admin, Modérateur, Éditeur, Joueur.
- Responsive mobile-first (320→430 px + tablettes).
- Build Android + APK debug (+ release signé si l'environnement le permet).

### V1 (après validation)

- Tournois, chat en partie, push notifications, stats avancées, économie cosmétique virtuelle, modes ranked (ELO).

### V2

- Saisons et classements saisonniers, événements, missions hebdomadaires, cross-device cloud sync.

### FUTUR

- Plus de jeux, streaming en spectateur, e-sport.

## 07. MVP

Cf. §06 (liste complète des fonctionnalités MVP).

## 08. V1

Tournois, chat, push, ranked ELO, cosmétiques virtuels (monnaie purement virtuelle, aucun jeu d'argent).

## 09. V2

Saisons, événements, missions, cloud sync.

## 10. Architecture fonctionnelle

```text
7G ZONE
│
├── Authentification (JWT)
├── Utilisateurs & Profils
├── Lobby central
├── Jeux
│   ├── 7G Monopoly (2-6 joueurs, solo IA / local)
│   ├── 7G UNO (2-8, solo IA / local / online 2-4)
│   ├── 7G Ludo (2-4, solo IA / local / online)
│   ├── 7G Chess (2, solo IA / local / online)
│   ├── 7G Checkers (2, solo IA / local / online)
│   ├── 7G Domino (2-4, solo IA / local / online)
│   └── 7G Quiz (1-4, solo IA(questions) / local / online)
├── Multiplayer (Socket.IO, salles, code, tour, synchro)
├── Matchmaking (file d'attente, timeout, annulation)
├── Amis & Social (demandes, invitations, blocage, signalement)
├── Classements (global, par jeu)
├── Progression (XP, niveaux, badges)
├── Récompenses (récompense quotidienne, cosmétiques futurs)
├── Notifications (internes)
├── Administration (dashboard, utilisateurs, jeux, quiz, modération, paramètres, logs)
└── Paramètres
```

## 11. Les 7 jeux

Chaque fiche respecte les 31 points exigés. Version détaillée : `docs/specs-jeux.md` (résumé ci-dessous).

### 7G Monopoly — « 7G City »
Variante originale de jeu de gestion immobilière (pas de marque, pas d'assets tiers).
- **Joueurs :** 2–6 (humains + IA). **Durée :** 20–40 min (MVP : objectif à 60 min max).
- **Plateau :** 20 cases circulaires (4 coins, 12 propriétés achetables 2 séries de couleurs, 2 cases chance, 1 prison, 1 départ).
- **Tour :** lancer 1 dé → avancer → résoudre la case → option achat/amélioration.
- **Économie :** monnaie virtuelle, achat, loyer, amende, gain de départ, faillite.
- **Victoire :** dernier joueur en faillite, ou capital maximal à la fin du tour 60 (sécurité anti-blocage).
- **IA :** facile/moyen/difficile (achat aléatoire, prudent, optimisé).

### 7G UNO — « 7G Uno »
Jeu de cartes original inspiré du principe générique couleur/numéro/action, graphismes 100 % originaux.
- **Joueurs :** 2–8. **Cartes :** 108 (4 couleurs × 0-9, Skip, Reverse, +2 ; 8 Wild, 4 Wild+4).
- **Tour :** poser une carte de même couleur/numéro/action, sinon piocher.
- **Fin :** premier joueur sans carte. **Score :** somme des cartes adverses.
- **Cas limite :** pioche épuisée → re-mélange de la défausse.

### 7G Ludo — « 7G Ludo »
- **Joueurs :** 2–4, 4 pions chacun. Dé 1–6.
- **Règles :** sortir avec un 6 (rejouer), case de sécurité, capture (retour au départ), 6 = rejouer, chemin final 5 cases, victoire = 4 pions arrivés.
- **Gestion :** blocage si les 4 pions sont bloqués → passe le tour.

### 7G Chess — « 7G Chess »
Moteur complet : mouvements légaux de toutes les pièces, roque (avec toutes les conditions), prise en passant, promotion (choix), échec, échec et mat, pat, nulle (50 coups, répétition, matériel insuffisant), détection de positions illégales. IA minimax profondeur 1–3.

### 7G Checkers — « 7G Checkers »
Dames internationales simplifiées : déplacement diagonal avant, capture obligatoire et en chaîne, promotion en dame (mouvements longs), victoire = plus de pièce, nulle = 20 coups sans prise.

### 7G Domino — « 7G Domino »
Domino bloc (28 tuiles, double-six) : distribution 7 tuiles par joueur (2 joueurs), chaîne de pose, tuile de départ au milieu, passe/pioche, blocage, score = somme restante des adversaires, manche jusqu'à 100 points.

### 7G Quiz — « 7G Quiz »
Quiz de culture générale : catégories (Science, Histoire, Géo, Sport, Culture, Jeux vidéo), questions 4 réponses, une bonne, timer 15 s, score (bonne réponse + rapidité), séries (streak bonus), résultats, classement. Questions en base de données, administrables.

## 12. Règles

Cf. §11 et `docs/specs-jeux.md`. Les moteurs sont indépendants de l'UI et validés par tests unitaires (§43).

## 13. Modes de jeu

| Mode | Définition | Entrée | Sortie |
|---|---|---|---|
| Solo | vs IA | écran du jeu → jouer | résultat |
| Local | 2P même appareil (si jeu le permet) | écran du jeu → local | résultat |
| Online | salle privée ou matchmaking | code / file d'attente | résultat, synchro temps réel |
| Casual | sans enjeu de classement | matchmaking casual | résultat |
| Ranked | MVP : score compté au classement par jeu | matchmaking | résultat + mise à jour classement |

Matchmaking : file d'attente par jeu, timeout 60 s, annulation possible, fallback IA si aucun adversaire trouvé (documenté).

## 14. Game Engine

Architecture commune (dans `shared/src/engines`), pur TypeScript, sans dépendance UI :

```text
GameState → GameRules → PlayerAction → Validation → StateTransition → NewState → (sync / history)
```

Interfaces communes : `createInitialState(config)`, `getLegalActions(state, playerId)`, `applyAction(state, action) → {state, events}`, `getStatus(state) → 'playing'|'finished'`, `getWinner(state)`, `serialize/deserialize`. Historique des coups conservé.

## 15. IA

- **7G City :** 3 niveaux (achat aléatoire / prudent / optimisé).
- **7G Uno :** 3 niveaux (premier jouable / meilleure couleur+score / comptage).
- **7G Ludo :** 3 niveaux (sortie prioritaire / capture / stratégie).
- **7G Chess :** minimax 1–3 avec évaluation matérielle simple.
- **7G Checkers :** minimax 2–4 avec évaluation matérielle + positionnelle.
- **7G Domino :** 3 niveaux (premier jouable / garde les doubles / comptage de tuiles restantes).
- **7G Quiz :** IA = joueur qui répond aux questions avec précision paramétrée (50/70/90 %).

Contrainte : l'IA ne lit jamais l'état caché (main adverse, pioche) au-delà de ce que le jeu autorise.

## 16. Multiplayer

- **Transport :** Socket.IO (namespace `/room`), serveur autoritaire.
- **Flux :** le client envoie `action` → le serveur valide avec le moteur → recalcule l'état → diffuse `state`/`events` → met à jour l'historique en base.
- **Salle :** `roomId` (code 6 caractères A-Z0-9, difficulté de devinette), hôte, capacité, jeu, mode, état (`waiting|playing|finished`).
- **Cas gérés :** déconnexion (statut `reconnecting`, gracieuse de 60 s), reconnexion (ré-attachement socket, renvoi état), abandon (forfait après timeout ou action « abandonner »), double action (ignorée par validation serveur), action illégale (refusée + événement d'erreur), serveur indisponible (message clair côté client + reconnexion automatique).

## 17. Matchmaking

File d'attente par jeu/mode. Critère de rapprochement : écart de niveau ≤ 3 (fallback : premier disponible après 20 s). Timeout 60 s → proposition de remplissage IA (signalé). Annulation possible à tout moment. Sortie automatique à l'appairage.

## 18. Authentification

- Inscription : pseudo unique + email unique + mot de passe (≥ 8, hash bcrypt).
- Connexion : retour d'un JWT (expiration 7 j). Mots de passe jamais stockés en clair, jamais loggés.
- Déconnexion : invalidation côté client (et révocation en base des refresh du MVP côté serveur si implémentée).
- Récupération : MVP = réinitialisation après vérification par question de sécurité (mock pédagogique documenté) ; évolution V1 = email réel.
- Protection : middleware d'auth sur toutes les routes protégées ; routes admin filtrées par rôle.

## 19. Utilisateurs

Données privées (serveur uniquement) : email, hash, rôles, stats internes. Données publiques : pseudo, avatar (emojis/gradients), niveau, XP, badges, victoires, défaites, dernier en ligne.

## 20. Profils

Pseudo modifiable (contrôle de doublons), avatar (choix de couleur/emoji), statistiques par jeu, historique des dernières parties (20), préférences (thème, notifications).

## 21. Social

- Amis : demandes (pending/acceptée/refusée), liste, suppression, blocage, signalement.
- Invitation directe en partie depuis la liste d'amis (génère une salle privée + notification).
- Chat : **hors périmètre MVP** (reporté V1) — décision justifiée : priorité au gameplay, modération de chat trop coûteuse pour le MVP.

## 22. Progression

XP par action de partie (gagné = 100 + bonus, match nul = 40, perdu = 10), niveaux (formule : `level = floor(sqrt(xp/100)) + 1`), badges (première victoire, 10 victoires, 50 parties, joueur du Quiz, etc.), récompense quotidienne (XP bonus, une fois par jour). Calcul côté serveur uniquement.

## 23. Récompenses

Badges + XP + récompense quotidienne. Monnaie cosmétique « 7G Coins » prévue V1 (purement virtuelle, sans achat ni jeu d'argent).

## 24. Classements

- Global (XP total) + par jeu (score de victoires). Tri décroissant, top 100, position du joueur.
- Égalités départagées par le moins de parties jouées puis pseudo. Mise à jour serveur post-partie.

## 25. Notifications

Internes : demande d'ami, invitation de partie, résultat de partie, récompense débloquée, événement admin. Marquage lu/non lu, pagination.

## 26. Administration

- **Dashboard :** nb utilisateurs, parties jouées, joueurs en ligne, XP moyen, alertes récentes.
- **Utilisateurs :** recherche, consultation, désactivation/activation, changement de rôle.
- **Jeux :** activation/désactivation globale par jeu, configuration des paramètres par jeu.
- **Quiz :** CRUD catégories + questions + réponses + difficultés + activation.
- **Modération :** signalements (résolution), blocages, sanctions.
- **Paramètres :** nom de l'app, texte d'accueil, couleurs (branding), logo (URL), configuration générale.
- **Logs :** actions admin (qui/quoi/quand), événements de sécurité.

## 27. Rôles et permissions

| Action | Joueur | Modérateur | Éditeur | Admin | Super Admin |
|---|---|---|---|---|---|
| Jouer / profil / social | ✓ | ✓ | ✓ | ✓ | ✓ |
| Modérer (signalements, blocages) | ✗ | ✓ | ✗ | ✓ | ✓ |
| Gérer le quiz | ✗ | ✗ | ✓ | ✓ | ✓ |
| Gérer les utilisateurs | ✗ | Limité | ✗ | ✓ | ✓ |
| Configurer jeux/branding | ✗ | ✗ | ✗ | Limité | ✓ |
| Logs / rôles | ✗ | ✗ | ✗ | ✗ | ✓ |

Contrôle **côté serveur** (jamais fiable côté client).

## 28. UI/UX — liste des écrans

Splash, Onboarding, Connexion, Inscription, Mot de passe oublié, Accueil/Lobby, Sélection de jeu (Game Hub), 7 écrans de jeu + résultats, Matchmaking, Salle privée, Profil, Amis, Classements, Récompenses, Notifications, Paramètres, Aide, Signalement, Admin (dashboard, utilisateurs, jeux, quiz, modération, paramètres, logs). Pour chaque écran : états loading / empty / erreur / offline gérés.

## 29. Responsive

Exigence critique. Validation sur 320×568, 360×640, 375×667, 390×844, 414×896, 430×932 et tablettes (768×1024). Aucun overflow horizontal, aucun élément coupé, boutons tactiles ≥ 44 px, safe areas et notch gérés (viewport + env(safe-area-inset-*)).

## 30. Accessibilité

Contrastes WCAG AA minimum, textes ≥ 14 px, zones tactiles ≥ 44 px, alternatives non-couleur (icônes + labels), focus visible, labels d'inputs.

## 31. Architecture technique

| Couche | Choix | Justification |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Rapide, écosystème, mobile-friendly |
| UI | CSS custom (design tokens) | Léger, pas de dépendance lourde, contrôle total |
| Backend | Node.js + TypeScript + Express | Même langage que le frontend, simple, free-tier friendly |
| Temps réel | Socket.IO | Ré-connection, rooms, fallbacks éprouvés |
| Base de données | SQLite (better-sqlite3) | **Dérogation documentée** : PostgreSQL requis par la Skill 01 mais absent de l'environnement (pas d'instance, 8 Go libres). SQLite = base réelle, transactionnelle, embarquée, 0 coût. Migration PostgreSQL possible via couche d'accès isolée. |
| Mobile | Capacitor 6 + Android | Emballage natif du build web, APK réel |
| Hosting MVP | Local / VPS free-tier | cf. §41 |

## 32. Frontend

SPA mobile-first, routing (react-router), états de chargement, intercepteur API avec JWT, hooks Socket.IO, composants réutilisables (Button, Card, Input, Modal, Badge, Avatar, Loader, Toast, EmptyState, ErrorState).

## 33. Backend

Layering : `routes → controllers → services → engines → repositories(DB)`. Modules : auth, users, profiles, games, matches, matchmaking, rooms (socket), friends, leaderboards, rewards, notifications, quiz, reports, admin, settings, logs. Validation des entrées (schémas), gestion centralisée des erreurs (code HTTP + message utilisateur + log technique).

## 34. API

Domaines : `/auth`, `/users`, `/profiles`, `/games`, `/matches`, `/matchmaking`, `/friends`, `/leaderboards`, `/rewards`, `/notifications`, `/quiz`, `/reports`, `/admin`, `/settings`. Chaque endpoint : validation, auth, autorisation, erreurs structurées.

## 35. Database

Entités : `users`, `profiles`, `games`, `matches`, `match_players`, `match_moves`, `rooms`, `friend_requests`, `friendships`, `notifications`, `leaderboard_entries`, `badges`, `user_badges`, `quiz_categories`, `quiz_questions`, `quiz_answers`, `reports`, `bans`, `admin_logs`, `settings`. Migrations SQL versionnées, contraintes, index, transactions pour les écritures multi-tables.

## 36. Temps réel

Socket.IO `connect` → auth JWT → rejoindre/annuler le matchmaking → créer/rejoindre une room (code) → émission `action` → serveur autoritaire → diffusion `state`/`event`. Ré-connection avec reprise d'état. Marquage de présence.

## 37. Sécurité

bcrypt, JWT signé, validation stricte des entrées (longueurs, formats, whitelists), rate limiting (auth : 10/min/IP), protections RBAC serveur, secrets en `.env` jamais committés, logs sans données sensibles, CORS configuré, aucune donnée privée exposée via les endpoints publics, requêtes paramétrées (better-sqlite3 prepared statements).

## 38. Anti-cheat

Serveur autoritaire pour tout ce qui compte : victoire, score, XP, classement. Le client ne peut pas déclarer « j'ai gagné » ; il envoie des actions, le serveur valide via le moteur. Historique `match_moves` conservé. Aucun endpoint ne permet de modifier directement un score/une victoire.

## 39. Performance

Démarrage < 3 s (webview), navigation < 200 ms, rendu léger (mise à jour d'état par événement, memo sur les listes), images légères (SVG/emoji), lazy loading des screens de jeux, requêtes paginées (historique, classements, notifications).

## 40. Offline & réseau

Perte réseau : bannière « Hors ligne » + retries automatiques (exponentiel). Pendant une partie en ligne : statut « Reconnexion… » (60 s). Backend indisponible : écran d'erreur clair + bouton réessayer. Actions critiques jamais perdues silencieusement.

## 41. Hébergement

- **MVP :** exécution locale documentée + prêt pour VPS free-tier (ex : Oracle Cloud Always Free / conteneur Docker). 
- **Frontend :** build statique (prêt pour Netlify/Vercel free). **Backend :** Node (prêt pour un VPS/conteneur). **DB :** SQLite fichier sur le backend.
- **Limites free-tier identifiées :** temps de sommeil des services gratuits, 1 instance à faible RAM → le MVP tient dans 1 Go RAM. **Seuil de migration PostgreSQL :** > 100 utilisateurs simultanés.

## 42. Android

Package : `com.sevenzone.app` — Nom : « 7G Zone » — Icône : générée depuis `7G_ZONE_APP_ICON.svg` (fourni). Splash Capacitor. Version 1.0.0, versionCode 1. Signature debug automatique ; release signée avec keystore généré localement (credentials protégés, jamais committés). Capacitor sync après chaque build web.

## 43. Tests

- **Unitaires** (Vitest) : moteurs des 7 jeux (règles, cas limites), auth, services critiques.
- **Intégration** : API ↔ DB (supertest), flow auth complet.
- **Gameplay :** matrices de règles par jeu (mouvements illégaux refusés, victoires, égalités).
- **Multiplayer :** simulation 2 clients socket (validation, synchro, reconnexion).
- **Responsive :** revue visuelle automatisée des dimensions cibles + audits manuels sur chaque écran.
- **Android :** APK construit, signature vérifiée, contenu vérifié (aapt), installation réelle si un appareil est disponible (sinon NON TESTÉ mentionné).

## 44. Matrice de test (extrait — complète dans AUDIT)

| Domaine | Test | Priorité | Résultat attendu |
|---|---|---|---|
| Auth | Inscription/connexion valides | Critique | Session JWT créée |
| Auth | Mauvais mot de passe | Haute | 401 contrôlé |
| Jeu | Partie solo démarre | Critique | État initial correct |
| Jeu | Coup invalide | Critique | Refusé + état intact |
| Chess | Échec et mat détecté | Critique | Fin de partie |
| Multiplayer | Déconnexion / reconnexion | Critique | État récupéré |
| Matchmaking | 2 joueurs appariés | Haute | Partie créée |
| Mobile | 320 px, toutes pages | Critique | Aucun overflow |
| Admin | Accès utilisateur normal | Critique | 403 |
| Android | APK installable | Critique | Installation réussie |

## 45. Roadmap

Phase 0 Préparation → 1 Fondations (scaffold, DB, auth) → 2 Moteurs (7 jeux) → 3 Frontend (auth, lobby, écrans) → 4 Multiplayer (sockets, rooms, matchmaking) → 5 Social → 6 Progression → 7 Admin → 8 QA → 9 Android/Capacitor → 10 APK → 11 Audit (Skill 03) → 12 Corrections → 13 Builds finaux.

## 46. Priorités (MoSCoW)

- **Must :** auth, lobby, 7 jeux solo+IA, local 2P, online 2P (chess/checkers/uno/domino/ludo/quiz), salles privées, classements, XP/niveaux, admin (utilisateurs/jeux/quiz/modération), responsive, APK.
- **Should :** matchmaking, amis, notifications, récompenses, logs admin.
- **Could :** badges avancés, historique étendu, paysage.
- **Won't (MVP) :** chat, push, ranked ELO, monnaie, tournois.

## 47. Risques

| Risque | Prob. | Impact | Prévention | Plan B |
|---|---|---|---|---|
| Scope trop large pour le MVP | Élevée | Élevé | Coupe stricte « Must », IA simple | V1 reportée |
| Build Android long/fragile | Moyenne | Élevé | Capacitor + wrapper Gradle, SDK vérifié | APK debug minimal |
| Postgres absent | Élevée | Moyen | SQLite (dérogation) | Migration PG documentée |
| Réseau/connexion mobile | Moyenne | Moyen | Reconnexion Socket.IO, bannières | Mode hors-ligne local |
| Régression entre jeux | Moyenne | Moyen | Engines séparés + tests unitaires | Boucle d'audit Skill 03 |

## 48. Critères d'acceptation

- **Auth :** inscription, connexion, logout, session, protection des routes ✓.
- **Jeux :** chaque jeu démarre, accepte des actions valides, refuse les invalides, se termine avec un gagnant/égalité, IA joue légalement ✓.
- **Multiplayer :** 2 clients créent/rejoignent une salle, l'action d'un joueur se synchronise chez l'autre, déconnexion gérée ✓.
- **Classements/progression :** mis à jour par le serveur après chaque partie ✓.
- **Admin :** un joueur normal reçoit 403, un admin peut gérer utilisateurs/quiz/jeux ✓.
- **Responsive :** aucune page ne déborde aux 6 tailles cibles ✓.
- **Android :** APK réel généré, signé, structure vérifiée ✓.

## 49. Definition of Done

[ ] Vision [x] Public cible [x] Périmètre MVP/V1/V2 [x] Architecture [x] 7 jeux + règles [x] Modes de jeu [x] IA [x] Multiplayer [x] Matchmaking [x] Auth [x] Profils [x] Social [x] Progression [x] Récompenses [x] Classements [x] Notifications [x] Administration [x] RBAC [x] UI/UX [x] Responsive [x] Accessibilité [x] Backend [x] API [x] Database [x] Hosting [x] Performance [x] Tests [x] Android [x] APK [x] Roadmap [x] Risques [x] Critères d'acceptation

## 50. Instructions pour la Skill Builder

1. Construire dans l'ordre : scaffold → moteurs (tests verts) → backend (auth/API/DB) → frontend (auth/lobby/jeux) → multiplayer → social/progression/admin → responsive → build → Capacitor → APK.
2. **Non négociable :** aucun mot de passe en clair ; victoire/score/XP calculés serveur ; les 7 jeux réellement jouables ; aucune page débordante sur mobile ; APK réel.
3. Priorité : fonctionnel > complexe. Coupes documentées dans le journal de décisions.
4. Tester après chaque module (BUILD→RUN→TEST→FIX→RETEST).
5. Générer le build web puis `npx cap sync android` puis APK debug puis release.
6. Livrer : code, README, docs, build web, APK réel. Ne jamais simuler.

---

*Fin du PA. Ce document est la source de vérité pour la Skill 02 (Builder) puis la Skill 03 (Auditor).*
