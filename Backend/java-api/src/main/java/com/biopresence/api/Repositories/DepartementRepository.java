package com.biopresence.api.Repositories;

import com.biopresence.api.entity.Departement;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartementRepository extends JpaRepository<Departement, Long> {
}