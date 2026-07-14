package com.biopresence.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record ParametresCoursRequete(
  Long coursId,
  @NotBlank(message = "Le nom du cours est obligatoire") String courseName,
  @Min(value = 1, message = "Le nombre de jours doit être supérieur à 0") int courseDays,
  @Min(value = 1, message = "Le nombre d'heures doit être supérieur à 0") int courseHours,
  @Min(value = 1, message = "Le seuil doit être supérieur à 0") int eligibilityThreshold,
  String startTime,
  String endTime
) {
}
