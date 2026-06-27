package com.biopresence.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record CoursRequete(
  @NotBlank(message = "Le nom du cours est obligatoire") String nom,
  @Min(value = 1, message = "Le nombre de jours doit être supérieur à 0") int nbJours,
  @Min(value = 1, message = "Le nombre d'heures doit être supérieur à 0") int nbHeures,
  @Min(value = 1, message = "Le seuil doit être supérieur à 0") int seuilEligibilite,
  String heureDebut,
  String heureFin
) {
}
