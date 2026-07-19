package com.biopresence.api.dto;

import jakarta.validation.constraints.NotBlank;

public record DepartementRequete(
  @NotBlank(message = "Le nom du département est obligatoire") String nom,
  @NotBlank(message = "Le code du département est obligatoire") String code
) {
}
