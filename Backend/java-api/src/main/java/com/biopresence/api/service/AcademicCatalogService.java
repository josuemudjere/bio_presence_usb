package com.biopresence.api.service;

import com.biopresence.api.dto.DepartementReponse;
import com.biopresence.api.dto.ProgrammeReponse;
import com.biopresence.api.entity.Departement;
import com.biopresence.api.entity.Programme;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.persistence.DepartementRepository;
import com.biopresence.api.persistence.ProgrammeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AcademicCatalogService {

  private final DepartementRepository departementRepository;
  private final ProgrammeRepository programmeRepository;

  public AcademicCatalogService(DepartementRepository departementRepository, ProgrammeRepository programmeRepository) {
    this.departementRepository = departementRepository;
    this.programmeRepository = programmeRepository;
  }

  public List<DepartementReponse> listDepartements() {
    return departementRepository.findAll().stream()
      .map(departement -> new DepartementReponse(departement.idDepartement, departement.nom, departement.code))
      .toList();
  }

  public List<ProgrammeReponse> listProgrammes() {
    return programmeRepository.findAll().stream()
      .map(programme -> new ProgrammeReponse(
        programme.idProgramme,
        programme.nom,
        programme.code,
        programme.cycle.name(),
        programme.dureeSemestres,
        programme.totalCredits
      ))
      .toList();
  }

  public Departement findDepartement(Long id) {
    return departementRepository.findById(id)
      .orElseThrow(() -> new ExceptionIntrouvable("Département introuvable."));
  }

  public Programme findProgramme(Long id) {
    return programmeRepository.findById(id)
      .orElseThrow(() -> new ExceptionIntrouvable("Filière introuvable."));
  }
}