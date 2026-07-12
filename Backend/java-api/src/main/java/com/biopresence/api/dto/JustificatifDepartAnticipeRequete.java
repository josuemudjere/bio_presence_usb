package com.biopresence.api.dto;

// Requête utilisée pour rattacher un justificatif de départ anticipé à une présence existante.
public record JustificatifDepartAnticipeRequete(
  String motifJustificatif,
  boolean estJustifiee
) {
}