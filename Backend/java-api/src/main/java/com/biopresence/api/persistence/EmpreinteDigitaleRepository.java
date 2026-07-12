package com.biopresence.api.persistence;

import com.biopresence.api.entity.EmpreinteDigitale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmpreinteDigitaleRepository extends JpaRepository<EmpreinteDigitale, Long> {
  List<EmpreinteDigitale> findByEtudiantIdOrderByDateEnrolementAsc(UUID etudiantId);

  Optional<EmpreinteDigitale> findFirstByTemplateIdIgnoreCase(String templateId);

  void deleteByEtudiantId(UUID etudiantId);
}