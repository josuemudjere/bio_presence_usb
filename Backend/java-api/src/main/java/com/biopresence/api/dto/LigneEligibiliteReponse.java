package com.biopresence.api.dto;

import java.util.UUID;

// Ligne de rapport synthétisant l'assiduité et l'éligibilité d'un étudiant.
public record LigneEligibiliteReponse(
  UUID studentId,
  String matricule,
  String studentName,
  int attendedDays,
  int courseDays,
  double attendancePercentage,
  boolean eligible
) {
}
