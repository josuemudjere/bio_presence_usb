package com.biopresence.api.dto;

import jakarta.validation.constraints.NotBlank;

public record PresenceScanRequete(
  @NotBlank(message = "L'identifiant biométrique est obligatoire") String fingerprintTemplateId
) {
}
