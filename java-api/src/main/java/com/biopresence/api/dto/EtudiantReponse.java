package com.biopresence.api.dto;

import java.util.UUID;

public record EtudiantReponse(
  UUID id,
  String name,
  String matricule,
  String department,
  String level,
  String photoUrl,
  boolean fingerprintRegistered,
  String fingerprintTemplateId,
  int fingerprintCount,
  String lastFingerprintScan,
  String status
) {
}
