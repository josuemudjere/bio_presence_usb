package com.biopresence.api.persistence;

import com.biopresence.api.entity.Administrateur;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

// Repository JPA des administrateurs, avec recherche par email pour l'authentification.
public interface AdministrateurRepository extends JpaRepository<Administrateur, UUID> {
  Optional<Administrateur> findByEmail(String email);
}
