package com.biopresence.api.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// DTO de sortie détaillant la fiche complète d'un étudiant pour le front admin.
public record EtudiantReponse(
  UUID id,
  String name,
  String postNom,
  String prenom,
  String matricule,
  LocalDate dateNaissance,
  String lieuNaissance,
  String adresse,
  String telephone,
  String department,
  String level,
  Long coursId,
  Long promotionId,
  List<Long> coursIds,
  List<Long> creditCoursIds,
  String photoUrl,
  boolean fingerprintRegistered,
  List<String> fingerprintTemplateIds,
  String fingerprintTemplateId,
  int fingerprintCount,
  String fingerprintDoigt,
  String lastFingerprintScan,
  String status
) {
}
