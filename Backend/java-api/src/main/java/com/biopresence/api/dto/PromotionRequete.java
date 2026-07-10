package com.biopresence.api.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record PromotionRequete(
  String nom,
  @NotBlank(message = "Le niveau de la promotion est obligatoire") String niveau,
  String description,
  @NotBlank(message = "Le département est obligatoire") String departement,
  @NotBlank(message = "La filière est obligatoire") String programme,
  List<Long> coursIds
) {
}