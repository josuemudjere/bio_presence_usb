package com.biopresence.api.Repositories;

import com.biopresence.api.entity.Cours;
import org.springframework.data.jpa.repository.JpaRepository;

// Repository JPA des cours, enrichi de quelques vérifications métier simples.
public interface CoursRepository extends JpaRepository<Cours, Long> {
  boolean existsByNomIgnoreCase(String nom);
}
