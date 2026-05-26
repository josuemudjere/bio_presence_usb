package com.biopresence.api.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record PresenceReponse(
  UUID id,
  UUID studentId,
  String studentName,
  String matricule,
  String department,
  LocalDate recordDate,
  LocalTime checkIn,
  LocalTime checkOut,
  String status
) {
}
