package com.biopresence.api.dto;

import java.util.UUID;

public record AdministrateurReponse(UUID id, String name, String email, String photoUrl, String role) {}
