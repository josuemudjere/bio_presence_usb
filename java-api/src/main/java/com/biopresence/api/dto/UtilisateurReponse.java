package com.biopresence.api.dto;

import java.util.UUID;

public record UtilisateurReponse(
  UUID id,
  String nom,
  String email,
  Long coursId,
  String photoUrl,
  String role,
  boolean actif
) {
}
