package com.biopresence.api.dto;

import jakarta.validation.constraints.NotBlank;

// Requête minimale attendue lors d'un pointage biométrique.
public record PresenceScanRequete(
  @NotBlank(message = "L'identifiant biométrique est obligatoire") String fingerprintTemplateId,
  Long coursId
) {
}
