package com.biopresence.api.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

// DTO de sortie représentant un enregistrement de présence prêt pour les tableaux et exports.
public record PresenceReponse(
  UUID id,
  UUID studentId,
  Long seanceId,
  String studentName,
  String photoUrl,
  String matricule,
  String department,
  LocalDateTime dateHeure,
  LocalTime heureArrivee,
  LocalDate recordDate,
  LocalTime checkIn,
  LocalTime checkOut,
  String status,
  boolean estJustifiee,
  String motifJustificatif,
  String modeSaisie,
  Long justificatifId
) {
}
