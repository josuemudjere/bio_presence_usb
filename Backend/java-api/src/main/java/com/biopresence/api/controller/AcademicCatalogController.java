package com.biopresence.api.controller;

import com.biopresence.api.dto.DepartementRequete;
import com.biopresence.api.dto.DepartementReponse;
import com.biopresence.api.dto.ProgrammeRequete;
import com.biopresence.api.dto.ProgrammeReponse;
import com.biopresence.api.entity.CycleLMD;
import com.biopresence.api.service.AcademicCatalogService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/academic")
public class AcademicCatalogController {

  private final AcademicCatalogService academicCatalogService;

  public AcademicCatalogController(AcademicCatalogService academicCatalogService) {
    this.academicCatalogService = academicCatalogService;
  }

  @GetMapping("/departements")
  public List<DepartementReponse> listDepartements() {
    // Expose le référentiel des départements pour alimenter les listes de sélection du front.
    return academicCatalogService.listDepartements();
  }

  @PostMapping("/departements")
  public DepartementReponse createDepartement(@Valid @RequestBody DepartementRequete request) {
    return academicCatalogService.createDepartement(request);
  }

  @PutMapping("/departements/{id}")
  public DepartementReponse updateDepartement(@PathVariable Long id, @Valid @RequestBody DepartementRequete request) {
    return academicCatalogService.updateDepartement(id, request);
  }

  @DeleteMapping("/departements/{id}")
  public ResponseEntity<Void> deleteDepartement(@PathVariable Long id) {
    academicCatalogService.deleteDepartement(id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/programmes")
  public List<ProgrammeReponse> listProgrammes() {
    // Retourne les programmes académiques disponibles pour le paramétrage des promotions et cours.
    return academicCatalogService.listProgrammes();
  }

  @PostMapping("/programmes")
  public ProgrammeReponse createProgramme(@Valid @RequestBody ProgrammeRequete request) {
    return academicCatalogService.createProgramme(request);
  }

  @PutMapping("/programmes/{id}")
  public ProgrammeReponse updateProgramme(@PathVariable Long id, @Valid @RequestBody ProgrammeRequete request) {
    return academicCatalogService.updateProgramme(id, request);
  }

  @DeleteMapping("/programmes/{id}")
  public ResponseEntity<Void> deleteProgramme(@PathVariable Long id) {
    academicCatalogService.deleteProgramme(id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/cycles")
  public List<String> listCycles() {
    return java.util.Arrays.stream(CycleLMD.values()).map(Enum::name).toList();
  }
}