package com.biopresence.api.dto;

public record CoursReponse(
  Long id,
  String nom,
  int nbJours,
  int nbHeures,
  int seuilEligibilite,
  String heureDebut,
  String heureFin
) {
}
