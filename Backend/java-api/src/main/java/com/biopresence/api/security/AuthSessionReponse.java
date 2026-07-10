package com.biopresence.api.security;

import java.util.UUID;
import java.util.List;

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