package com.biopresence.api.persistence;

import com.biopresence.api.entity.Inscription;
import com.biopresence.api.entity.StatutInscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

// Repository JPA des inscriptions actives liant étudiants et cours.
public interface InscriptionRepository extends JpaRepository<Inscription, Long> {
  List<Inscription> findByEtudiantIdOrderByDateInscriptionAsc(UUID etudiantId);

  List<Inscription> findByCoursIdAndStatut(Long coursId, StatutInscription statut);

  long countByCoursIdAndStatut(Long coursId, StatutInscription statut);

  boolean existsByEtudiantIdAndCoursIdAndStatut(UUID etudiantId, Long coursId, StatutInscription statut);

  void deleteByEtudiantId(UUID etudiantId);
}