package com.biopresence.api.persistence;

import com.biopresence.api.entity.Utilisateur;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

// Repository JPA des comptes utilisateurs gérés par l'authentification métier.
public interface UtilisateurRepository extends JpaRepository<Utilisateur, UUID> {
  Optional<Utilisateur> findByEmail(String email);
  boolean existsByEmail(String email);
}
