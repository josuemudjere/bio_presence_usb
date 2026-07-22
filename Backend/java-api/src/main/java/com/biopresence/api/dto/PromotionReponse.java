package com.biopresence.api.dto;

import java.util.List;

// DTO de lecture utilisé pour éditer et afficher une promotion académique.
public record PromotionReponse(
  Long id,
  String nom,
  String niveau,
  String description,
  String departement,
  String programme,
  Long filiereId,
  List<Long> coursIds
) {
}