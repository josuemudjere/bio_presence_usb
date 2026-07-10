package com.biopresence.api.persistence;

import com.biopresence.api.entity.Cours;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoursRepository extends JpaRepository<Cours, Long> {
  boolean existsByNomIgnoreCase(String nom);
}
