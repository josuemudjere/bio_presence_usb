package com.biopresence.api.dto;

import jakarta.validation.constraints.NotBlank;

public record EtudiantRequete(
  @NotBlank(message = "Le nom est obligatoire") String name,
  @NotBlank(message = "Le matricule est obligatoire") String matricule,
  @NotBlank(message = "Le département est obligatoire") String department,
  @NotBlank(message = "Le niveau est obligatoire") String level,
  String photoUrl,
  String fingerprintTemplateId,
  Integer fingerprintCount
) {
}
