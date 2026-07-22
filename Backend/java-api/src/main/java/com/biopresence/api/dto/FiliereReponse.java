package com.biopresence.api.dto;

// DTO de sortie représentant une filière académiques.
public record FiliereReponse(
  Long id,
  String nom,
  String code,
  Long departementId
) {
}
