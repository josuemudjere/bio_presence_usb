package com.biopresence.api.Repositories;

import com.biopresence.api.entity.Inscription;
import com.biopresence.api.entity.StatutInscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;
import java.util.UUID;

// Repository JPA des inscriptions actives liant étudiants et cours.
public interface InscriptionRepository extends JpaRepository<Inscription, Long> {
  List<Inscription> findByEtudiantIdOrderByDateInscriptionAsc(UUID etudiantId);

  List<Inscription> findByCoursIdAndStatut(Long coursId, StatutInscription statut);

  long countByCoursIdAndStatut(Long coursId, StatutInscription statut);

  @Query("""
    select distinct i.etudiant.id
    from Inscription i
    where i.cours.id = :coursId
      and i.statut = :statut
      and i.etudiant is not null
      and i.etudiant.id is not null
    """)
  Set<UUID> findDistinctEtudiantIdsByCoursIdAndStatut(@Param("coursId") Long coursId, @Param("statut") StatutInscription statut);

  @Query("""
    select count(distinct i.etudiant.id)
    from Inscription i
    where i.cours.id = :coursId
      and i.statut = :statut
      and i.etudiant is not null
      and i.etudiant.id is not null
    """)
  long countDistinctEtudiantIdsByCoursIdAndStatut(@Param("coursId") Long coursId, @Param("statut") StatutInscription statut);

  boolean existsByEtudiantIdAndCoursIdAndStatut(UUID etudiantId, Long coursId, StatutInscription statut);

  void deleteByEtudiantId(UUID etudiantId);
}