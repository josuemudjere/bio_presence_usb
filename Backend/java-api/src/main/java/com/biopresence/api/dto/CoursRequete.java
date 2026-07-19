package com.biopresence.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

// DTO d'entrée validé lors de la création ou mise à jour d'un cours.
public record CoursRequete(
  @NotBlank(message = "Le nom du cours est obligatoire") String nom,
  String code,
  @Min(value = 0, message = "Les crédits ne peuvent pas être négatifs") int credits,
  @Min(value = 0, message = "Le volume horaire ne peut pas être négatif") Integer volumeHoraire,
  String horaire,
  @Min(value = 1, message = "Le seuil doit être supérieur à 0") Integer seuilEligibilite,
  String heureDebut,
  String heureFin,
  Long departementId,
  Long programmeId
) {
}
