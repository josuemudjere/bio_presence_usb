package com.biopresence.api.security;

import java.util.UUID;
import java.util.List;

// Réponse de session renvoyée au front après authentification ou lecture de profil.
public record AuthSessionReponse(
  UUID id,
  String name,
  String email,
  String photoUrl,
  String role,
  Long coursId,
  List<Long> coursIds
) {
}