package com.biopresence.api.controller;

import com.biopresence.api.dto.LigneEligibiliteReponse;
import com.biopresence.api.service.PresenceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class RapportController {
  private final PresenceService attendanceService;

  public RapportController(PresenceService attendanceService) {
    this.attendanceService = attendanceService;
  }

  @GetMapping("/eligibility")
  public List<LigneEligibiliteReponse> eligibility(@RequestParam(required = false) Long coursId) {
    // Génère le rapport d'éligibilité à partir des jours de présence déjà consolidés.
    return attendanceService.buildEligibilityReport(coursId);
  }
}
