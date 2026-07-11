## BioPresence — Système de Contrôle de Présence Biométrique

Application web full-stack permettant la gestion des présences étudiantes via empreinte biométrique, avec un tableau de bord d'administration complet.

---

## Structure globale du projet

```
Projet_tutoré_bio/
├── Frontend/
│   ├── assets/              → Images et ressources statiques
│   ├── client/              → Application frontend (React + TypeScript)
│   └── shared/              → Constantes et modules partagés frontend
├── Backend/
│   ├── java-api/            → Backend REST (Spring Boot + MariaDB)
│   └── server/              → Serveur Express (déploiement production)
├── patches/                 → Correctifs de dépendances
├── package.json             → Dépendances et scripts du projet
├── vite.config.ts           → Configuration du bundler Vite
├── tsconfig.json            → Configuration TypeScript
└── components.json          → Configuration de la bibliothèque UI
```

---

##  Fichiers racine

| Fichier | Rôle |
|---|---|
| `package.json` | Déclare toutes les dépendances npm/pnpm et les scripts (`dev`, `build`, `start`). C'est le fichier central pour gérer les packages du frontend et du serveur Node. |
| `pnpm-lock.yaml` | Verrouille les versions exactes de chaque dépendance installée. Garantit que tout le monde installe les mêmes versions. Ne pas modifier manuellement. |
| `vite.config.ts` | Configure le serveur de développement Vite (port 3000, alias `@/`, chemin du build). Vite compile et recharge le frontend en temps réel. |
| `tsconfig.json` | Configuration TypeScript pour le code frontend (`client/src`). Définit les règles de typage strict et les chemins d'alias. |
| `tsconfig.node.json` | Configuration TypeScript spécifique aux outils Node.js (Vite, scripts de build). Séparé de `tsconfig.json` pour éviter les conflits. |
| `components.json` | Configuration de **shadcn/ui** — définit le style, le chemin des composants et l'alias `@`. Utilisé par la CLI shadcn pour ajouter des composants. |
| `.prettierrc` | Règles de formatage automatique du code (indentation, guillemets, virgules). |
| `.prettierignore` | Liste des fichiers exclus du formatage automatique (ex: `pnpm-lock.yaml`). |
| `.gitignore` | Liste des fichiers et dossiers exclus du suivi Git (`node_modules`, `dist`, etc.). |
| `README.md` | Ce fichier — documentation complète du projet. |

---

##  Dossier `Frontend/assets/`

| Fichier | Rôle |
|---|---|
| `Frontend/assets/images/bio.png` | Logo principal de l'application BioPresence. Importé dans la page d'accueil, la page de connexion et la barre latérale. |

---

##  Dossier `Frontend/client/` — Frontend React

### Point d'entrée

| Fichier | Rôle |
|---|---|
| `Frontend/client/index.html` | Page HTML racine chargée par le navigateur. Contient le `<div id="root">` où React monte l'application. |
| `Frontend/client/src/main.tsx` | Point d'entrée JavaScript de l'application React. Monte le composant `<App />` dans le DOM et active le mode strict de React. |
| `Frontend/client/src/App.tsx` | Composant racine qui configure le **routeur** (Wouter), les providers globaux (Auth, Thème, Tooltip) et définit toutes les routes de l'application (`/accueil`, `/connexion`, `/admin/*`). |
| `Frontend/client/src/index.css` | Feuille de styles globale. Importe Tailwind CSS, définit les variables de couleur, le thème clair/sombre et les utilitaires CSS personnalisés. |
| `Frontend/client/src/const.ts` | Constantes globales partagées dans tout le frontend (valeurs fixes, configurations communes). |
| `Frontend/client/public/bio.png` | Copie du logo accessible directement via l'URL `/bio.png` (utilisée comme favicon ou dans le HTML). |

---

###  Pages (`Frontend/client/src/pages/`)

Chaque fichier correspond à une page complète de l'application.

| Fichier | Rôle |
|---|---|
| `Connexion.tsx` | Page de connexion administrateur. Contient le formulaire email/mot de passe qui s'authentifie auprès de l'API Java. Route : `/connexion`. |
| `AdminTableauDeBord.tsx` | Tableau de bord principal de l'administrateur. Affiche les statistiques globales (présences, étudiants, taux d'assiduité) et les graphiques. Route : `/admin/tableau-de-bord`. |
| `AdminEtudiants.tsx` | Gestion complète des étudiants : création, modification, suppression, enrôlement biométrique, paramètres de cours. Route : `/admin/etudiants`. |
| `AdminPresence.tsx` | Interface de scan biométrique en temps réel. Gère la connexion au capteur d'empreinte, l'enregistrement des présences et l'affichage des scans récents. Route : `/admin/presence`. |
| `Introuvable.tsx` | Page d'erreur 404 affichée quand une route n'existe pas. Propose un lien de retour vers l'accueil. |

---

###  Composants (`Frontend/client/src/components/`)

Composants réutilisables utilisés dans plusieurs pages.

| Fichier | Rôle |
|---|---|
| `ErrorBoundary.tsx` | Composant React qui capture les erreurs JavaScript non gérées et affiche un message d'erreur propre à la place d'un écran blanc. Entoure toute l'application dans `App.tsx`. |
| `ProtectedRoute.tsx` | Garde de route qui vérifie si l'utilisateur est connecté avant d'afficher les pages admin. Redirige vers `/connexion` si non authentifié. |
| `Sidebar.tsx` | Barre de navigation latérale de l'espace administrateur. Contient les liens vers le tableau de bord, les étudiants et les présences, ainsi que le bouton de déconnexion. |
| `Map.tsx` | Composant d'intégration Google Maps. Permet d'afficher une carte interactive dans l'application si nécessaire. |

#### Composants UI (`Frontend/client/src/components/ui/`)

Bibliothèque de **40+ composants d'interface** basés sur **shadcn/ui** (bibliothèque de composants UI pour les applications web modernes) + **Radix UI** (une bibliothèque de composants React). Ces composants sont accessibles, personnalisables et stylisés avec Tailwind CSS.

| Composant | Usage |
|---|---|
| `button.tsx`, `input.tsx`, `label.tsx` | Éléments de formulaire de base |
| `dialog.tsx`, `sheet.tsx`, `drawer.tsx` | Fenêtres modales et panneaux glissants |
| `table.tsx`, `pagination.tsx` | Affichage de données tabulaires |
| `select.tsx`, `checkbox.tsx`, `switch.tsx` | Contrôles de sélection |
| `card.tsx`, `badge.tsx`, `avatar.tsx` | Éléments d'affichage |
| `tabs.tsx`, `accordion.tsx` | Navigation par onglets et accordéons |
| `chart.tsx` | Graphiques (basé sur Recharts) |
| `sidebar.tsx` | Structure de la barre latérale admin |
| `sonner.tsx` | Notifications toast (messages de succès/erreur) |
| `spinner.tsx`, `skeleton.tsx` | Indicateurs de chargement |
| `tooltip.tsx`, `popover.tsx`, `hover-card.tsx` | Infobulles et cartes au survol |

---

###  Contextes (`Frontend/client/src/contexts/`)

Fournisseurs de données globales accessibles partout dans l'application via `useContext`.

| Fichier | Rôle |
|---|---|
| `AuthContext.tsx` | Gère l'état d'authentification global : connexion, déconnexion, profil utilisateur, mise à jour du mot de passe. Communique avec l'endpoint `/api/auth` de l'API Java. |
| `ThemeContext.tsx` | Gère le thème de l'application (clair/sombre). Permet de basculer entre les deux modes via le hook `useTheme()`. |

---

###  Hooks (`Frontend/client/src/hooks/`)

Hooks React personnalisés encapsulant de la logique réutilisable.

| Fichier | Rôle |
|---|---|
| `useMobile.tsx` | Détecte si l'utilisateur est sur un appareil mobile (< 768px). Utilisé pour adapter l'interface (ex: fermer la sidebar sur mobile). |
| `useComposition.ts` | Gère les événements de composition IME (saisie de caractères asiatiques). Évite les soumissions prématurées de formulaires. |
| `usePersistFn.ts` | Retourne une référence stable à une fonction qui ne change pas entre les rendus. Évite des re-rendus inutiles dans les composants enfants. |

---

###  Bibliothèques (`Frontend/client/src/lib/`)

Modules de logique métier et d'accès aux données.

| Fichier | Rôle |
|---|---|
| `adminApi.ts` | **Couche d'accès à l'API Java.** Contient toutes les fonctions HTTP (`fetchStudents`, `createStudent`, `scanAttendance`, `saveCourseSettingsApi`, etc.) qui communiquent avec le backend Spring Boot sur `http://localhost:8080`. |
| `adminData.ts` | Données locales de l'administration (état persisté dans le navigateur, données par défaut). Utilisé comme fallback quand l'API Java est indisponible. |
| `biometricSensor.ts` | Interface de communication avec le **capteur d'empreinte biométrique**. Gère la connexion, la lecture et le traitement des données du capteur. |
| `serialSensor.ts` | Passerelle frontend vers le capteur via **MQTT sur WebSocket**. Ouvre la connexion broker, publie les commandes de scan et consomme les événements du capteur. |
| `mqttSensorProtocol.ts` | Contrat partagé du protocole MQTT du capteur: topics par défaut, version de protocole, types de messages `command`, `events`, `status`. |
| `utils.ts` | Fonctions utilitaires générales : formatage de dates, fusion de classes CSS (`cn()`), calculs divers. |

---

##  Comment le frontend communique avec le backend

Le lien entre le frontend React et le backend Spring Boot passe principalement par trois fichiers côté frontend :

| Fichier | Rôle dans la connexion |
|---|---|
| `Frontend/client/src/lib/apiBase.ts` | Définit l'URL de base de l'API. Par défaut, le frontend appelle `http://localhost:8080/api`, sauf si `VITE_API_BASE_URL` est défini. |
| `Frontend/client/src/lib/adminApi.ts` | Contient la couche HTTP principale du projet. C'est ici que sont centralisés les appels `fetch()` vers le backend pour les étudiants, cours, présences, promotions, rapports et paramètres. |
| `Frontend/client/src/contexts/AuthContext.tsx` | Gère les appels d'authentification (`/api/auth/login`, `/api/auth/profile/{id}`, `/api/auth/profile/{id}/password`). Ce fichier connecte directement le frontend au backend pour la session utilisateur. |

### Flux réel d'un appel frontend vers le backend

Le chemin standard est le suivant :

```text
Page React -> fonction dans adminApi.ts ou AuthContext.tsx -> URL construite par apiBase.ts -> contrôleur Spring Boot -> service métier -> repository -> base de données
```

Exemple concret pour la liste des cours :

```text
Frontend/client/src/pages/AdminCours.tsx
  -> appelle fetchCours() dans Frontend/client/src/lib/adminApi.ts
  -> envoie une requête HTTP vers /api/courses
  -> reçue par Backend/java-api/src/main/java/com/biopresence/api/controller/CoursController.java
  -> traitée par Backend/java-api/src/main/java/com/biopresence/api/service/CoursService.java
  -> lue en base via Backend/java-api/src/main/java/com/biopresence/api/persistence/CoursRepository.java
```

Exemple concret pour la connexion utilisateur :

```text
Frontend/client/src/pages/Connexion.tsx
  -> appelle login() dans Frontend/client/src/contexts/AuthContext.tsx
  -> envoie une requête HTTP vers /api/auth/login
  -> reçue par Backend/java-api/src/main/java/com/biopresence/api/security/AdministrateurController.java
  -> traitée par Backend/java-api/src/main/java/com/biopresence/api/security/AuthService.java
  -> vérifie les comptes administrateur / utilisateur en base
```

### Fichier de raccord réseau le plus important

Si l'on doit désigner un seul fichier principal de raccord frontend-backend, c'est `Frontend/client/src/lib/adminApi.ts`, car c'est lui qui centralise la majorité des appels HTTP métier.

Pour l'authentification, le fichier clé complémentaire est `Frontend/client/src/contexts/AuthContext.tsx`.

### Autorisation navigateur entre ports différents

En développement, le frontend tourne généralement sur le port `3000` et l'API Java sur le port `8080`.
Le fichier `Backend/java-api/src/main/java/com/biopresence/api/config/ConfigCors.java` autorise cette communication cross-origin pour que le navigateur ne bloque pas les requêtes.

### Support multi-doigts par étudiant

BioPresence supporte maintenant proprement plusieurs empreintes pour un même étudiant.

- Le frontend manipule un tableau `fingerprintTemplateIds` dans ses échanges API.
- Le backend Spring stocke ces identifiants dans une collection normalisée liée à l'étudiant.
- Le champ historique `fingerprintTemplateId` est encore conservé comme chaîne CSV de compatibilité transitoire pour ne pas casser les anciens flux déjà branchés dessus.
- `fingerprintCount` reflète désormais le nombre réel d'empreintes associées à l'étudiant.

Concrètement, cela permet d'enrôler plusieurs doigts pour un seul étudiant tout en gardant la recherche biométrique et la détection d'unicité actives sur chaque identifiant individuel.

---

##  Dossier `Backend/java-api/` — Backend Spring Boot

##  Protocole MQTT du capteur

Le contrat exact utilisé par le frontend est documenté dans [Frontend/client/src/lib/mqttSensorProtocol.ts](Frontend/client/src/lib/mqttSensorProtocol.ts) pour les types et dans [docs/MQTT_SENSOR_PROTOCOL.md](docs/MQTT_SENSOR_PROTOCOL.md) pour les échanges JSON, les topics et les règles de corrélation `requestId`.

Un firmware NodeMCU ESP8266 compatible avec ce protocole est fourni dans [platformio-projects-main/esp8266-projects/biopresence-nodemcu-mqtt/README.md](platformio-projects-main/esp8266-projects/biopresence-nodemcu-mqtt/README.md).

### Chaîne locale de test MQTT

Le frontend attend par défaut un broker MQTT en WebSocket sur `ws://localhost:9001/mqtt` et des publications sur les topics:

- `biopresence/sensor/command` (SerialSensor.ts)
- `biopresence/sensor/events`
- `biopresence/sensor/status`

Le dépôt fournit maintenant une chaîne locale minimale pour tester ce flux sans carte physique:

```bash
pnpm mqtt:broker:up
pnpm mqtt:sensor:mock
pnpm dev
```

Ce que chaque commande fait:

- `pnpm mqtt:broker:up`: démarre un broker Eclipse Mosquitto via Docker avec MQTT TCP sur `1884 ou 1883` côté machine locale et MQTT over WebSocket sur `9001`
- `pnpm mqtt:sensor:mock`: lance un faux capteur qui consomme `command` et publie `status` / `events`
- `pnpm mqtt:broker:down`: arrête le broker local

Avec cette chaîne active, le bouton `Connecter MQTT` de l'interface admin doit passer à l'état connecté, puis les scans doivent recevoir des réponses simulées.

API REST Java qui gère toutes les données persistantes en base de données MariaDB.

**Démarrage :**
```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home \
  /opt/homebrew/Cellar/maven/3.9.16/bin/mvn -f Backend/java-api/pom.xml spring-boot:run
```
**URL de base :** `http://localhost:8080/api`

### Fichiers de configuration

| Fichier | Rôle |
|---|---|
| `pom.xml` | Fichier Maven principal. Déclare les dépendances Java (Spring Boot, Spring Data JPA, MariaDB Driver, Lombok) et configure le build. |
| `src/main/resources/application.yml` | Configuration Spring Boot : URL de la base de données, port du serveur (8080), stratégie JPA (`ddl-auto: update`), paramètres de connexion MariaDB. |
| `BioPresenceApplication.java` | Point d'entrée de l'application Spring Boot. Contient la méthode `main()` qui démarre le serveur embarqué Tomcat. |

### Architecture en couches

```
controller/ → dto/ → service/ → repository/ → entity/ → Base de données
```

#### `entity/` — Entités JPA (tables de la base de données)

| Fichier | Table BDD | Rôle |
|---|---|---|
| `Administrateur.java` | `administrateurs` | Compte administrateur (email, mot de passe, nom) |
| `Etudiant.java` | `etudiants` + `etudiant_fingerprint_template_ids` | Étudiant (nom, matricule, département, niveau) avec collection normalisée d'empreintes biométriques multi-doigts |
| `Presence.java` | `presences` | Enregistrement de présence (étudiant, horodatage, type entrée/sortie) |
| `ParametresCours.java` | `parametres_cours` | Configuration du cours (nom, jours, heures, seuil d'éligibilité) |
| `StatutEtudiant.java` | — | Énumération des statuts d'un étudiant (actif, inactif) |
| `StatutPresence.java` | — | Énumération des types de présence (entrée, sortie, absence) |

#### `repository/` — Accès base de données

Interfaces Spring Data JPA. Chaque repository fournit automatiquement les opérations CRUD (Create, Read, Update, Delete) sur sa table.

| Fichier | Rôle |
|---|---|
| `AdministrateurRepository.java` | Requêtes sur la table `administrateurs` (ex: recherche par email) |
| `EtudiantRepository.java` | Requêtes sur la table `etudiants` (ex: recherche par matricule, par empreinte) |
| `PresenceRepository.java` | Requêtes sur la table `presences` (ex: présences du jour, par étudiant) |
| `ParametresCoursRepository.java` | Requêtes sur la table `parametres_cours` |

#### `service/` — Logique métier

Contient toute la logique de traitement entre les controllers et la base de données.

| Fichier | Rôle |
|---|---|
| `AdministrateurService.java` | Authentification, gestion du profil admin, initialisation du compte par défaut (`seedDefault()`). Identifiants par défaut : `admin@usb.org` / `Josue2026`. |
| `EtudiantService.java` | Création, modification, suppression d'étudiants, vérification des doublons de matricule. |
| `PresenceService.java` | Enregistrement des scans biométriques, calcul du taux de présence, vérification de l'éligibilité aux examens. |
| `ParametresCoursService.java` | Gestion des paramètres de cours (nom, horaires, seuil d'assiduité). |

#### `controller/` — Endpoints REST (routes API)

Exposent les fonctionnalités via HTTP. Tous les endpoints sont préfixés par `/api`.

| Fichier | Préfixe | Endpoints principaux |
|---|---|---|
| `AdministrateurController.java` | `/api/auth` | `POST /login`, `GET /profile/{id}`, `PUT /profile/{id}/password` |
| `EtudiantController.java` | `/api/etudiants` | `GET /`, `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `PresenceController.java` | `/api/presences` | `POST /scan`, `GET /today`, `GET /etudiant/{id}` |
| `ParametresCoursController.java` | `/api/parametres-cours` | `GET /`, `POST /` |
| `RapportController.java` | `/api/rapports` | Génération de rapports de présence |
| `SanteController.java` | `/api/sante` | `GET /ping` — vérifie que l'API est en ligne |

#### `dto/` — Objets de transfert de données

Classes utilisées pour structurer les données échangées entre le frontend et le backend (entrées des requêtes et sorties des réponses).

| Fichier | Sens | Rôle |
|---|---|---|
| `ConnexionRequete.java` | Entrée | Email + mot de passe pour la connexion |
| `EtudiantRequete.java` | Entrée | Données pour créer/modifier un étudiant |
| `PresenceScanRequete.java` | Entrée | Données du scan biométrique (ID empreinte) |
| `ParametresCoursRequete.java` | Entrée | Paramètres du cours à enregistrer |
| `MajProfilRequete.java` | Entrée | Mise à jour du profil administrateur |
| `AdministrateurReponse.java` | Sortie | Données de l'admin renvoyées au frontend |
| `EtudiantReponse.java` | Sortie | Données étudiant renvoyées au frontend |
| `PresenceReponse.java` | Sortie | Données de présence renvoyées au frontend |
| `ParametresCoursReponse.java` | Sortie | Paramètres de cours renvoyés au frontend |
| `ScanReponse.java` | Sortie | Résultat d'un scan biométrique |
| `LigneEligibiliteReponse.java` | Sortie | Résumé d'éligibilité d'un étudiant aux examens |

#### `config/` — Configuration Spring

| Fichier | Rôle |
|---|---|
| `ConfigCors.java` | Configure les autorisations CORS pour permettre au frontend React (port 3000) d'appeler l'API (port 8080) sans être bloqué par le navigateur. |
| `InitialiseurDonnees.java` | Exécuté au démarrage de l'API. Appelle `seedDefault()` pour s'assurer qu'un compte administrateur existe toujours en base de données. |

#### `exception/` — Gestion des erreurs

| Fichier | Rôle |
|---|---|
| `ExceptionIntrouvable.java` | Exception personnalisée levée quand une ressource (étudiant, présence) n'est pas trouvée en base. Retourne un HTTP 404. |
| `GestionnaireExceptions.java` | Intercepteur global des exceptions (`@ControllerAdvice`). Transforme les exceptions Java en réponses HTTP JSON propres avec le bon code d'erreur. |

---

##  Dossier `Backend/server/` — Serveur Express (Production)

Serveur Node.js Express utilisé uniquement en **production** pour servir les fichiers statiques du frontend compilé.

| Fichier | Rôle |
|---|---|
| `index.ts` | Point d'entrée du serveur Express. Sert les fichiers du build Vite (`dist/public`) et redirige toutes les routes vers `index.html` pour le routage côté client. |
| `src/domain/auth/` | Modèles domaine pour l'authentification (User, AuthRepository, AuthErrors). |
| `src/application/auth/LoginUseCase.ts` | Cas d'usage de connexion (architecture DDD). |
| `src/infrastructure/config/env.ts` | Lecture des variables d'environnement du serveur. |
| `ARCHITECTURE.md` | Documentation de l'architecture du serveur Node. |

---

##  Dossier `patches/`

| Fichier | Rôle |
|---|---|
| `patches/wouter@3.7.1.patch` | Correctif appliqué automatiquement par pnpm sur la librairie de routage **Wouter**. Corrige un comportement non désiré de la version 3.7.1. **Ne pas supprimer** — pnpm l'applique à chaque `pnpm install`. |

---

##  Démarrage du projet

### Prérequis
- Java 21 + Maven 3.9+
- MariaDB (XAMPP) démarré sur le port 3306
- Node.js + pnpm

### 1. Démarrer la base de données
Démarrer XAMPP et activer le service **MySQL/MariaDB**.
Base de données : `biopresence` (créée automatiquement par Spring Boot).

### 2. Démarrer l'API Java
```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home \
  /opt/homebrew/Cellar/maven/3.9.16/bin/mvn -f Backend/java-api/pom.xml spring-boot:run
```
→ API disponible sur `http://localhost:8080`

### 3. Démarrer le frontend
```bash
pnpm install
pnpm dev
```
→ Frontend disponible sur `http://localhost:3000`

### Identifiants administrateur par défaut
| Champ | Valeur |
|---|---|
| Email | `admin@usb.org` |
| Mot de passe | `Josue2026` |
