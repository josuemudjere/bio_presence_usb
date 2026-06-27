package com.biopresence.api.controller;

import com.biopresence.api.dto.UtilisateurRequete;
import com.biopresence.api.dto.UtilisateurReponse;
import com.biopresence.api.service.UtilisateurService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UtilisateurController {

  private final UtilisateurService utilisateurService;

  public UtilisateurController(UtilisateurService utilisateurService) {
    this.utilisateurService = utilisateurService;
  }

  @GetMapping
  public List<UtilisateurReponse> list() {
    return utilisateurService.listAll();
  }

  @GetMapping("/{id}")
  public UtilisateurReponse getById(@PathVariable UUID id) {
    return utilisateurService.getById(id);
  }

  @PostMapping
  public UtilisateurReponse create(@Valid @RequestBody UtilisateurRequete request) {
    return utilisateurService.create(request);
  }

  @PutMapping("/{id}")
  public UtilisateurReponse update(@PathVariable UUID id, @Valid @RequestBody UtilisateurRequete request) {
    return utilisateurService.update(id, request);
  }

  @PutMapping("/{id}/toggle-actif")
  public UtilisateurReponse toggleActif(@PathVariable UUID id) {
    return utilisateurService.toggleActif(id);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    utilisateurService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
