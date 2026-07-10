# BioPresence API Java

API REST Spring Boot pour le backend biométrique de BioPresence.

## Stack
- Java 25
- Spring Boot 3.5
- Spring Web
- Spring Data JPA
- Validation
- H2 en base de developpement

## Lancer le projet
1. Installer Java 25 et Maven.
2. Aller dans ce dossier:
   `cd java-api`
3. Demarrer l'API:
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
Le projet utilise H2 pour demarrer rapidement. Tu pourras remplacer ce datasource par PostgreSQL ou MySQL plus tard sans changer l'API frontend.
