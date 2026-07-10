package com.biopresence.api.dto;

public record CoursReponse(
  Long id,
  String nom,
  String code,
  String intitule,
  int credits,
  int volumeHoraire,
  String salle,
  String horaire,
  String jourSemaine,
  Long enseignantId,
  Long departementId,
  Long programmeId,
  Long semestreId,
  int nbJours,
  int nbHeures,
  int seuilEligibilite,
  String heureDebut,
  String heureFin
) {
}
