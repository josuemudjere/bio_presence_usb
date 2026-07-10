package com.biopresence.api.dto;

import java.util.List;

public record PromotionReponse(
  Long id,
  String nom,
  String niveau,
  String description,
  String departement,
  String programme,
  List<Long> coursIds
) {
}