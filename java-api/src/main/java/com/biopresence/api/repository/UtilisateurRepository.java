package com.biopresence.api.repository;

import com.biopresence.api.entity.Utilisateur;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, UUID> {
  Optional<Utilisateur> findByEmail(String email);
  boolean existsByEmail(String email);
}
