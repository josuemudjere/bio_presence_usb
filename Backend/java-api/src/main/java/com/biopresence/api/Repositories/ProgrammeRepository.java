package com.biopresence.api.Repositories;

import com.biopresence.api.entity.Programme;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProgrammeRepository extends JpaRepository<Programme, Long> {
	boolean existsByCodeIgnoreCase(String code);

	Optional<Programme> findByCodeIgnoreCase(String code);
}