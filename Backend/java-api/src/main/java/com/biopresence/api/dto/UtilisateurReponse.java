package com.biopresence.api.dto;

import java.util.UUID;
import java.util.List;

public record UtilisateurReponse(
  UUID id,
  String nom,
  String prenom,
  String email,
  Long coursId,
  List<Long> coursIds,
  String photoUrl,
  String role,
  boolean actif
) {
}
