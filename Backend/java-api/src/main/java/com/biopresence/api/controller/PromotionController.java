package com.biopresence.api.controller;

import com.biopresence.api.dto.PromotionReponse;
import com.biopresence.api.dto.PromotionRequete;
import com.biopresence.api.service.PromotionService;
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
@RequestMapping("/api/promotions")
public class PromotionController {

  private final PromotionService promotionService;

  public PromotionController(PromotionService promotionService) {
    this.promotionService = promotionService;
  }

  @GetMapping
  public List<PromotionReponse> list() {
    // Retourne toutes les promotions configurées pour l'enrôlement et les affectations.
    return promotionService.listAll();
  }

  @GetMapping("/{id}")
  public PromotionReponse getById(@PathVariable Long id) {
    // Charge une promotion précise pour édition ou consultation.
    return promotionService.getById(id);
  }

  @PostMapping
  public PromotionReponse create(@Valid @RequestBody PromotionRequete request) {
    // Crée une promotion avec son département, sa filière et ses cours associés.
    return promotionService.create(request);
  }

  @PutMapping("/{id}")
  public PromotionReponse update(@PathVariable Long id, @Valid @RequestBody PromotionRequete request) {
    return promotionService.update(id, request);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id) {
    promotionService.delete(id);
    return ResponseEntity.noContent().build();
  }
}