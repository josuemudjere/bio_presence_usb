package com.biopresence.api.service;

import com.biopresence.api.Repositories.DepartementRepository;
import com.biopresence.api.Repositories.FiliereRepository;
import com.biopresence.api.Repositories.ProgrammeRepository;
import com.biopresence.api.dto.DepartementRequete;
import com.biopresence.api.dto.DepartementReponse;
import com.biopresence.api.dto.FiliereReponse;
import com.biopresence.api.dto.FiliereRequete;
import com.biopresence.api.dto.ProgrammeRequete;
import com.biopresence.api.dto.ProgrammeReponse;
import com.biopresence.api.entity.CycleLMD;
import com.biopresence.api.entity.Departement;
import com.biopresence.api.entity.Filiere;
import com.biopresence.api.entity.Programme;
import com.biopresence.api.exception.ExceptionIntrouvable;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class AcademicCatalogService {

  private final DepartementRepository departementRepository;
  private final FiliereRepository filiereRepository;
  private final ProgrammeRepository programmeRepository;

  public AcademicCatalogService(DepartementRepository departementRepository, FiliereRepository filiereRepository, ProgrammeRepository programmeRepository) {
    this.departementRepository = departementRepository;
    this.filiereRepository = filiereRepository;
    this.programmeRepository = programmeRepository;
  }

  public List<DepartementReponse> listDepartements() {
    // Transforme les entités de département en DTO légers pour le front.
    return departementRepository.findAll().stream()
      .map(departement -> new DepartementReponse(departement.idDepartement, departement.nom, departement.code))
      .toList();
  }

  public List<ProgrammeReponse> listProgrammes() {
    // Expose les programmes académiques sans divulguer la structure complète des entités.
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

  public List<FiliereReponse> listFilieres() {
    return filiereRepository.findAll().stream()
      .map(filiere -> new FiliereReponse(
        filiere.idFiliere,
        filiere.nom,
        filiere.code,
        filiere.departement == null ? null : filiere.departement.idDepartement
      ))
      .toList();
  }

  public Filiere findFiliere(Long id) {
    return filiereRepository.findById(id)
      .orElseThrow(() -> new ExceptionIntrouvable("Filière introuvable."));
  }

  @Transactional
  public FiliereReponse createFiliere(FiliereRequete request) {
    Departement departement = findDepartement(request.departementId());
    if (filiereRepository.existsByCodeIgnoreCase(request.code().trim())) {
      throw new IllegalArgumentException("Ce code de filière existe déjà.");
    }

    Filiere filiere = new Filiere();
    filiere.nom = request.nom().trim();
    filiere.code = normalizeCode(request.code());
    filiere.departement = departement;
    filiereRepository.save(filiere);
    return toFiliereResponse(filiere);
  }

  @Transactional
  public FiliereReponse updateFiliere(Long id, FiliereRequete request) {
    Filiere filiere = findFiliere(id);
    Departement departement = findDepartement(request.departementId());
    String code = normalizeCode(request.code());
    filiereRepository.findByCodeIgnoreCase(code)
      .filter(existing -> !existing.idFiliere.equals(id))
      .ifPresent(existing -> {
        throw new IllegalArgumentException("Ce code de filière existe déjà.");
      });

    filiere.nom = request.nom().trim();
    filiere.code = code;
    filiere.departement = departement;
    filiereRepository.save(filiere);
    return toFiliereResponse(filiere);
  }

  @Transactional
  public void deleteFiliere(Long id) {
    Filiere filiere = findFiliere(id);
    filiereRepository.delete(filiere);
  }

  private FiliereReponse toFiliereResponse(Filiere filiere) {
    return new FiliereReponse(
      filiere.idFiliere,
      filiere.nom,
      filiere.code,
      filiere.departement == null ? null : filiere.departement.idDepartement
    );
  }

  public Departement findDepartement(Long id) {
    return departementRepository.findById(id)
      .orElseThrow(() -> new ExceptionIntrouvable("Département introuvable."));
  }

  @Transactional
  public DepartementReponse createDepartement(DepartementRequete request) {
    String code = normalizeCode(request.code());
    if (departementRepository.existsByCodeIgnoreCase(code)) {
      throw new IllegalArgumentException("Ce code de département existe déjà.");
    }

    Departement departement = new Departement();
    departement.nom = request.nom().trim();
    departement.code = code;
    departementRepository.save(departement);
    return new DepartementReponse(departement.idDepartement, departement.nom, departement.code);
  }

  @Transactional
  public DepartementReponse updateDepartement(Long id, DepartementRequete request) {
    Departement departement = findDepartement(id);
    String code = normalizeCode(request.code());
    departementRepository.findByCodeIgnoreCase(code)
      .filter(existing -> !existing.idDepartement.equals(id))
      .ifPresent(existing -> {
        throw new IllegalArgumentException("Ce code de département existe déjà.");
      });

    departement.nom = request.nom().trim();
    departement.code = code;
    departementRepository.save(departement);
    return new DepartementReponse(departement.idDepartement, departement.nom, departement.code);
  }

  @Transactional
  public void deleteDepartement(Long id) {
    Departement departement = findDepartement(id);
    departementRepository.delete(departement);
  }

  public Programme findProgramme(Long id) {
    return programmeRepository.findById(id)
      .orElseThrow(() -> new ExceptionIntrouvable("Filière introuvable."));
  }

  @Transactional
  public ProgrammeReponse createProgramme(ProgrammeRequete request) {
    String code = normalizeCode(request.code());
    if (programmeRepository.existsByCodeIgnoreCase(code)) {
      throw new IllegalArgumentException("Ce code de programme existe déjà.");
    }

    Programme programme = new Programme();
    applyProgrammeFields(programme, request);
    programmeRepository.save(programme);
    return toProgrammeResponse(programme);
  }

  @Transactional
  public ProgrammeReponse updateProgramme(Long id, ProgrammeRequete request) {
    Programme programme = findProgramme(id);
    String code = normalizeCode(request.code());
    programmeRepository.findByCodeIgnoreCase(code)
      .filter(existing -> !existing.idProgramme.equals(id))
      .ifPresent(existing -> {
        throw new IllegalArgumentException("Ce code de programme existe déjà.");
      });

    applyProgrammeFields(programme, request);
    programmeRepository.save(programme);
    return toProgrammeResponse(programme);
  }

  @Transactional
  public void deleteProgramme(Long id) {
    Programme programme = findProgramme(id);
    programmeRepository.delete(programme);
  }

  private void applyProgrammeFields(Programme programme, ProgrammeRequete request) {
    programme.nom = request.nom().trim();
    programme.code = normalizeCode(request.code());
    programme.cycle = CycleLMD.valueOf(request.cycle().trim().toUpperCase(Locale.ROOT));
    programme.dureeSemestres = request.dureeSemestres() != null ? request.dureeSemestres() : defaultSemestersForCycle(programme.cycle);
    programme.totalCredits = request.totalCredits() != null ? request.totalCredits() : defaultCreditsForCycle(programme.cycle);
  }

  private ProgrammeReponse toProgrammeResponse(Programme programme) {
    return new ProgrammeReponse(
      programme.idProgramme,
      programme.nom,
      programme.code,
      programme.cycle.name(),
      programme.dureeSemestres,
      programme.totalCredits
    );
  }

  private String normalizeCode(String rawCode) {
    if (rawCode == null || rawCode.isBlank()) {
      throw new IllegalArgumentException("Le code est obligatoire.");
    }
    return rawCode.trim().toUpperCase(Locale.ROOT);
  }

  private int defaultSemestersForCycle(CycleLMD cycle) {
    return switch (cycle) {
      case LICENCE -> 6;
      case MASTER -> 4;
      case DOCTORAT -> 16;
    };
  }

  private int defaultCreditsForCycle(CycleLMD cycle) {
    return switch (cycle) {
      case LICENCE -> 180;
      case MASTER -> 120;
      case DOCTORAT -> 480;
    };
  }
}