package com.biopresence.api.controller;

import com.biopresence.api.dto.AdministrateurReponse;
import com.biopresence.api.dto.ConnexionRequete;
import com.biopresence.api.dto.MajProfilRequete;
import com.biopresence.api.service.AdministrateurService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AdministrateurController {

  private final AdministrateurService adminService;

  public AdministrateurController(AdministrateurService adminService) {
    this.adminService = adminService;
  }

  @PostMapping("/login")
  public ResponseEntity<AdministrateurReponse> login(@RequestBody ConnexionRequete request) {
    AdministrateurReponse response = adminService.login(request);
    return ResponseEntity.ok(response);
  }

  @GetMapping("/profile/{id}")
  public ResponseEntity<AdministrateurReponse> getProfile(@PathVariable UUID id) {
    return ResponseEntity.ok(adminService.getById(id));
  }

  @PutMapping("/profile/{id}")
  public ResponseEntity<AdministrateurReponse> updateProfile(
      @PathVariable UUID id,
      @RequestBody MajProfilRequete request) {
    return ResponseEntity.ok(adminService.updateProfile(id, request));
  }

  @PutMapping("/profile/{id}/password")
  public ResponseEntity<Map<String, String>> updatePassword(
      @PathVariable UUID id,
      @RequestBody Map<String, String> body) {
    adminService.updatePassword(id, body.get("currentPassword"), body.get("newPassword"));
    return ResponseEntity.ok(Map.of("message", "Mot de passe mis à jour"));
  }
}
