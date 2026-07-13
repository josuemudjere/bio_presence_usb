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
