package com.biopresence.api.dto;

public record ReservationEmpreinteReponse(
  String fingerprintTemplateId,
  boolean reserved,
  String message
) {
}