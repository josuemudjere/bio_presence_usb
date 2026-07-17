package com.biopresence.api.Repositories;

import com.biopresence.api.entity.Etudiant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Repository JPA des étudiants, avec recherches par matricule et empreinte biométrique.
public interface EtudiantRepository extends JpaRepository<Etudiant, UUID> {
  List<Etudiant> findByPromotionId(Long promotionId);

  Optional<Etudiant> findByMatriculeIgnoreCase(String matricule);

  Optional<Etudiant> findByFingerprintTemplateIdIgnoreCase(String fingerprintTemplateId);

  boolean existsByMatriculeIgnoreCase(String matricule);

  boolean existsByFingerprintTemplateIdIgnoreCase(String fingerprintTemplateId);
}
