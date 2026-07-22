package com.biopresence.api.Repositories;

import com.biopresence.api.entity.Filiere;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FiliereRepository extends JpaRepository<Filiere, Long> {
  boolean existsByCodeIgnoreCase(String code);
  Optional<Filiere> findByCodeIgnoreCase(String code);
}
