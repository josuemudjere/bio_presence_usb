# Clean Architecture - Backend

Le backend est organisé par couches:

- Domain: règles métier pures, entités et contrats.
- Application: cas d'usage orchestrant le métier.
- Infrastructure: implémentations techniques (repository mémoire, config env).
- Presentation: HTTP (contrôleurs, routes, middlewares).
- Main: composition des dépendances et bootstrap serveur.

## Arborescence

- src/domain/auth
  - User.ts
  - AuthRepository.ts
  - AuthErrors.ts
- src/application/auth
  - LoginUseCase.ts
- src/infrastructure/auth
  - InMemoryAuthRepository.ts
- src/infrastructure/config
  - env.ts
- src/presentation/http/controllers
  - AuthController.ts
- src/presentation/http/routes
  - authRoutes.ts
- src/presentation/http/middlewares
  - errorHandler.ts
- src/presentation/http
  - app.ts
- src/main
  - dependencies.ts
  - server.ts

## Flux login

1. Route HTTP POST /api/auth/login
2. AuthController valide l'entrée et appelle LoginUseCase
3. LoginUseCase consomme AuthRepository
4. InMemoryAuthRepository retourne l'utilisateur de test
5. Le contrôleur renvoie l'utilisateur public (sans mot de passe)

## Endpoints

- GET /api/health
- POST /api/auth/login

Body attendu:

{
  "email": "admin@usb.org",
  "password": "password",
  "role": "admin"
}
