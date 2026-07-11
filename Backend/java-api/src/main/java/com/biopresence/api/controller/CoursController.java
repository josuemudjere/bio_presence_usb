package com.biopresence.api.controller;

import com.biopresence.api.dto.CoursRequete;
import com.biopresence.api.dto.CoursReponse;
import com.biopresence.api.service.CoursService;
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

@RestController
@RequestMapping("/api/courses")
public class CoursController {

  private final CoursService coursService;

  public CoursController(CoursService coursService) {
    this.coursService = coursService;
  }

  @GetMapping
  public List<CoursReponse> list() {
    // Retourne le catalogue complet des cours pour l'administration frontend.
    return coursService.listAll();
  }

  @GetMapping("/{id}")
  public CoursReponse getById(@PathVariable Long id) {
    // Charge un cours précis, notamment pour préremplir les formulaires d'édition.
    return coursService.getById(id);
  }

  @PostMapping
  public CoursReponse create(@Valid @RequestBody CoursRequete request) {
    // Crée un nouveau cours à partir du contrat reçu depuis le front.
    return coursService.create(request);
  }

  @PutMapping("/{id}")
  public CoursReponse update(@PathVariable Long id, @Valid @RequestBody CoursRequete request) {
    // Met à jour le cours ciblé sans exposer directement l'entité JPA.
    return coursService.update(id, request);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id) {
    // Une suppression réussie répond sans corps conformément aux usages REST.
    coursService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
