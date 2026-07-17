# BioPresence API Java

API REST Spring Boot pour le backend biométrique de BioPresence.

## Stack
- Java 25
- Spring Boot 3.5
- Spring Web
- Spring Data JPA
- Validation
- MySQL en base de developpement via le profil `local`

## Lancer le projet
1. Installer Java 25 et Maven.
2. Aller dans ce dossier:
   `cd java-api`
3. Configurer l'acces MySQL via variables d'environnement si besoin:
   `export DB_HOST=127.0.0.1`
   `export DB_PORT=3306`
   `export DB_NAME=biopresence`
   `export DB_USERNAME=root`
   `export DB_PASSWORD=mot_de_passe_mysql`
4. Demarrer l'API:
   `mvn spring-boot:run`

## Endpoints principaux
- `GET /api/health`
- `GET /api/students`
- `POST /api/students`
- `PUT /api/students/{id}`
- `DELETE /api/students/{id}`
- `GET /api/course-settings`
- `PUT /api/course-settings`
- `POST /api/attendance/scan`
- `GET /api/attendance/today`
- `GET /api/reports/eligibility`

## Base de donnees
Le projet charge par defaut le profil Spring `local`.

La datasource locale lit en priorite les variables d'environnement suivantes:
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`

Si elles sont absentes, elle retombe sur ces variables applicatives:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`

Sans `DB_PASSWORD`, Spring tente une connexion MySQL sans mot de passe, ce qui provoque l'erreur `Access denied for user 'root'@'localhost' (using password: NO)` si votre serveur MySQL protege le compte `root`.

## Initialisation du compte administrateur
Pour un deploiement sur serveur distant, un script SQL idempotent est fourni dans `src/main/resources/sql/init-admin.sql`.

Il initialise le compte administrateur par defaut si aucun compte `admin@usb.org` n'existe, et remplace aussi un ancien mot de passe en clair par une version bcrypt.

Identifiants de connexion par defaut:
- Email: `admin@usb.org`
- Mot de passe: `Josue2026`

Le mot de passe est stocke hache en bcrypt dans la base.

Execution manuelle possible sur le serveur MySQL:

```sql
UPDATE administrateurs
SET email = 'admin@usb.org',
      password = '$2a$10$iq6q5GcbgdiPZeHFBwH0feU0Ne6HlnETiDUuBkBnO.CPHAvSXBV7i',
      niveau_acces = 'GLOBAL',
      permissions = 'GERER_UTILISATEURS,GERER_EMPREINTES,CONSULTER_LOGS'
WHERE email = 'admin@university.edu';

UPDATE administrateurs
SET password = '$2a$10$iq6q5GcbgdiPZeHFBwH0feU0Ne6HlnETiDUuBkBnO.CPHAvSXBV7i',
      niveau_acces = COALESCE(niveau_acces, 'GLOBAL'),
      permissions = COALESCE(permissions, 'GERER_UTILISATEURS,GERER_EMPREINTES,CONSULTER_LOGS')
WHERE email = 'admin@usb.org'
   AND (password = 'Josue2026' OR password IS NULL OR password = '');

INSERT INTO administrateurs (
   id,
   name,
   prenom,
   email,
   password,
   photo_url,
   niveau_acces,
   permissions,
   date_creation,
   derniere_connexion
)
SELECT
   UUID(),
   'Administrateur',
   NULL,
   'admin@usb.org',
   '$2a$10$iq6q5GcbgdiPZeHFBwH0feU0Ne6HlnETiDUuBkBnO.CPHAvSXBV7i',
   NULL,
   'GLOBAL',
   'GERER_UTILISATEURS,GERER_EMPREINTES,CONSULTER_LOGS',
   NOW(),
   NULL
WHERE NOT EXISTS (
   SELECT 1
   FROM administrateurs
   WHERE email = 'admin@usb.org'
);
```
