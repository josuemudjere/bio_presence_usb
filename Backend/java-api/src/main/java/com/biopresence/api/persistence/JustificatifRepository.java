package com.biopresence.api.persistence;

import com.biopresence.api.entity.Justificatif;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JustificatifRepository extends JpaRepository<Justificatif, Long> {
}