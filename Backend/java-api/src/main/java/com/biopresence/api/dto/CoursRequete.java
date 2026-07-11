package com.biopresence.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

// DTO d'entrée validé lors de la création ou mise à jour d'un cours.
public record CoursRequete(
  @NotBlank(message = "Le nom du cours est obligatoire") String nom,
  String code,
  String intitule,
  @Min(value = 0, message = "Les crédits ne peuvent pas être négatifs") int credits,
  @Min(value = 0, message = "Le volume horaire ne peut pas être négatif") Integer volumeHoraire,
  String salle,
  String horaire,
  String jourSemaine,
  @Min(value = 1, message = "Le nombre de jours doit être supérieur à 0") Integer nbJours,
  @Min(value = 1, message = "Le nombre d'heures doit être supérieur à 0") Integer nbHeures,
  @Min(value = 1, message = "Le seuil doit être supérieur à 0") Integer seuilEligibilite,
  String heureDebut,
  String heureFin,
  Long departementId,
  Long programmeId
) {
}
