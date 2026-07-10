package com.biopresence.api.security;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AdministrateurController {

  private final AuthService authService;

  public AdministrateurController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/login")
  public ResponseEntity<AuthSessionReponse> login(@RequestBody ConnexionRequete request) {
    return ResponseEntity.ok(authService.login(request));
  }

  @GetMapping("/profile/{id}")
  public ResponseEntity<AuthSessionReponse> getProfile(@PathVariable UUID id) {
    return ResponseEntity.ok(authService.getProfile(id));
  }

  @PutMapping("/profile/{id}")
  public ResponseEntity<AuthSessionReponse> updateProfile(
      @PathVariable UUID id,
      @RequestBody MajProfilRequete request) {
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
