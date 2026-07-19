package com.biopresence.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record ProgrammeRequete(
  @NotBlank(message = "Le nom du programme est obligatoire") String nom,
  @NotBlank(message = "Le code du programme est obligatoire") String code,
  @NotBlank(message = "Le cycle LMD est obligatoire") String cycle,
  @Min(value = 1, message = "La durée en semestres doit être supérieure à 0") Integer dureeSemestres,
  @Min(value = 1, message = "Le total de crédits doit être supérieur à 0") Integer totalCredits
) {
}
