package com.biopresence.api.dto;

public record ParametresCoursReponse(
  Long coursId,
  String courseName,
  int courseDays,
  int courseHours,
  int eligibilityThreshold,
  String startTime,
  String endTime
) {
}
