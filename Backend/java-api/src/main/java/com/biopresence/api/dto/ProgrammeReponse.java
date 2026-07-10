package com.biopresence.api.dto;

public record ProgrammeReponse(
  Long id,
  String nom,
  String code,
  String cycle,
  Integer dureeSemestres,
  Integer totalCredits
) {
}