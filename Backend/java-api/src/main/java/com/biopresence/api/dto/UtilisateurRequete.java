package com.biopresence.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UtilisateurRequete(
  @NotBlank(message = "Le nom est obligatoire") String nom,
  String prenom,
  @NotBlank(message = "L'email est obligatoire") @Email(message = "Email invalide") String email,
  @NotBlank(message = "Le mot de passe est obligatoire") @Size(min = 4, message = "Le mot de passe doit contenir au moins 4 caractères") String password,
  Long coursId,
  List<Long> coursIds,
  String role
) {
}
