package com.biopresence.api.controller;

import com.biopresence.api.dto.DepartementReponse;
import com.biopresence.api.dto.ProgrammeReponse;
import com.biopresence.api.service.AcademicCatalogService;
import org.springframework.web.bind.annotation.GetMapping;
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
    return academicCatalogService.listDepartements();
  }

  @GetMapping("/programmes")
  public List<ProgrammeReponse> listProgrammes() {
    return academicCatalogService.listProgrammes();
  }
}