package com.biopresence.api.Repositories;

import com.biopresence.api.entity.Programme;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProgrammeRepository extends JpaRepository<Programme, Long> {
}