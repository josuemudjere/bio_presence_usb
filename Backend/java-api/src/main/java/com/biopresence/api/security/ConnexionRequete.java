package com.biopresence.api.security;

// Requête minimale de connexion envoyée depuis l'écran d'authentification.
public record ConnexionRequete(String email, String password) {}
