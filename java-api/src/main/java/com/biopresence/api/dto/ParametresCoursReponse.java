package com.biopresence.api.dto;

public record ParametresCoursReponse(
  String courseName,
  int courseDays,
  int courseHours,
  int eligibilityThreshold
) {
}
