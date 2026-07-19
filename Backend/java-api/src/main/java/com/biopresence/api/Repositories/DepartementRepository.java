package com.biopresence.api.Repositories;

import com.biopresence.api.entity.Departement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DepartementRepository extends JpaRepository<Departement, Long> {
	boolean existsByCodeIgnoreCase(String code);

	Optional<Departement> findByCodeIgnoreCase(String code);
}