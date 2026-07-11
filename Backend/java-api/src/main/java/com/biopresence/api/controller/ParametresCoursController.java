package com.biopresence.api.controller;

import com.biopresence.api.dto.ParametresCoursRequete;
import com.biopresence.api.dto.ParametresCoursReponse;
import com.biopresence.api.service.ParametresCoursService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/course-settings")
public class ParametresCoursController {
  private final ParametresCoursService courseSettingsService;

  public ParametresCoursController(ParametresCoursService courseSettingsService) {
    this.courseSettingsService = courseSettingsService;
  }

  @GetMapping
  public ParametresCoursReponse getCurrent() {
    // Renvoie la configuration active utilisée pour le calcul des présences et de l'éligibilité.
    return courseSettingsService.getCurrent();
  }

  @PutMapping
  public ParametresCoursReponse save(@Valid @RequestBody ParametresCoursRequete request) {
    // Enregistre les paramètres globaux du cours pilotant les règles de pointage.
    return courseSettingsService.save(request);
  }
}
