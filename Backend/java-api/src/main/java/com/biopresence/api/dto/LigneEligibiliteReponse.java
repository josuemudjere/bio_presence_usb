package com.biopresence.api.dto;

import java.util.UUID;

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
