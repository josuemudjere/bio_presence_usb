package com.biopresence.api.security;

import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AdministrateurController {

  private final AuthService authService;
  private final JwtService jwtService;
  private final UserSessionEventService userSessionEventService;

  public AdministrateurController(
    AuthService authService,
    JwtService jwtService,
    UserSessionEventService userSessionEventService
  ) {
    this.authService = authService;
    this.jwtService = jwtService;
    this.userSessionEventService = userSessionEventService;
  }

  @PostMapping("/login")
  public ResponseEntity<AuthSessionReponse> login(@RequestBody ConnexionRequete request) {
    // Point d'entrée d'authentification commun aux administrateurs et enseignants.
    return ResponseEntity.ok(authService.login(request));
  }

  @PostMapping("/logout")
  public ResponseEntity<Map<String, String>> logout(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
    String token = extractBearerToken(authorization);
    authService.logout(token);
    return ResponseEntity.ok(Map.of("message", "Déconnexion effectuée"));
  }

  @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter subscribeToSessionEvents(@RequestParam("token") String token) {
    String subject = jwtService.extractSubject(token);
    UUID userId = UUID.fromString(subject);

    if (!jwtService.isTokenValid(token, userId)) {
      throw new RuntimeException("Jeton invalide");
    }

    return userSessionEventService.subscribe(userId);
  }

  private String extractBearerToken(String authorization) {
    if (authorization == null || !authorization.startsWith("Bearer ")) {
      return null;
    }

    return authorization.substring(7);
  }

  @GetMapping("/profile/{id}")
  public ResponseEntity<AuthSessionReponse> getProfile(@PathVariable UUID id) {
    // Retourne la session publique d'un utilisateur à partir de son identifiant.
    return ResponseEntity.ok(authService.getProfile(id));
  }

  @PutMapping("/profile/{id}")
  public ResponseEntity<AuthSessionReponse> updateProfile(
      @PathVariable UUID id,
      @RequestBody MajProfilRequete request) {
    // Met à jour les informations de profil accessibles depuis le front.
    return ResponseEntity.ok(authService.updateProfile(id, request));
  }

  @PutMapping("/profile/{id}/password")
  public ResponseEntity<Map<String, String>> updatePassword(
      @PathVariable UUID id,
      @RequestBody Map<String, String> body) {
    authService.updatePassword(id, body.get("currentPassword"), body.get("newPassword"));
    return ResponseEntity.ok(Map.of("message", "Mot de passe mis à jour"));
  }
}
