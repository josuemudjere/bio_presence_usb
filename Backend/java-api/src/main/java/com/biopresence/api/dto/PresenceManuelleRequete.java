package com.biopresence.api.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record PresenceManuelleRequete(
  @NotNull(message = "L'étudiant est obligatoire") UUID studentId,
  Long coursId,
  String date,
  String checkIn,
  String checkOut
) {
}