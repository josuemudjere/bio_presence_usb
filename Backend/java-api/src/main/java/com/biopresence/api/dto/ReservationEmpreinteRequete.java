package com.biopresence.api.dto;

import jakarta.validation.constraints.NotBlank;

public record ReservationEmpreinteRequete(
  @NotBlank(message = "L'identifiant biométrique est obligatoire") String fingerprintTemplateId,
  String fingerprintTemplateDataBase64,
  String doigt
) {
}