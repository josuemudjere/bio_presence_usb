package com.biopresence.api.security;

// Requête partielle utilisée pour mettre à jour le profil public d'un compte connecté.
public record MajProfilRequete(String name, String email, String photoUrl) {}
