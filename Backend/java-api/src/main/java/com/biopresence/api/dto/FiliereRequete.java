package com.biopresence.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

// DTO d'entrée pour créer ou mettre à jour une filière.
public record FiliereRequete(
  @NotBlank(message = "Le nom de la filière est obligatoire") String nom,
  @NotBlank(message = "Le code de la filière est obligatoire") String code,
  @NotNull(message = "Le département est obligatoire") Long departementId
) {
}
