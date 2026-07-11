package com.biopresence.api.dto;

import java.util.UUID;

// DTO public renvoyé au front pour représenter un administrateur authentifié.
public record AdministrateurReponse(UUID id, String name, String email, String photoUrl, String role) {}
