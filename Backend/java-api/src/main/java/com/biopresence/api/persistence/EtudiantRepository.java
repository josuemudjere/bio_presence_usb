package com.biopresence.api.persistence;

import com.biopresence.api.entity.Etudiant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EtudiantRepository extends JpaRepository<Etudiant, UUID> {
  Optional<Etudiant> findByMatriculeIgnoreCase(String matricule);

  Optional<Etudiant> findByFingerprintTemplateIdIgnoreCase(String fingerprintTemplateId);

  boolean existsByMatriculeIgnoreCase(String matricule);

  boolean existsByFingerprintTemplateIdIgnoreCase(String fingerprintTemplateId);
}
