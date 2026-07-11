package com.biopresence.api.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.util.List;

// DTO d'entrée utilisé pour créer ou mettre à jour la fiche académique d'un étudiant.
public record EtudiantRequete(
  @NotBlank(message = "Le nom est obligatoire") String name,
  String postNom,
  String prenom,
  @NotBlank(message = "Le matricule est obligatoire") String matricule,
  LocalDate dateNaissance,
  String lieuNaissance,
  String adresse,
  String telephone,
  @NotBlank(message = "Le département est obligatoire") String department,
  @NotBlank(message = "Le niveau est obligatoire") String level,
  Long coursId,
  Long promotionId,
  List<Long> creditCoursIds,
  String status,
  String photoUrl,
  String fingerprintTemplateId,
  Integer fingerprintCount
) {
}
