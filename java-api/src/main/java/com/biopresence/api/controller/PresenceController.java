package com.biopresence.api.controller;

import com.biopresence.api.dto.PresenceReponse;
import com.biopresence.api.dto.PresenceScanRequete;
import com.biopresence.api.dto.ScanReponse;
import com.biopresence.api.service.PresenceService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class PresenceController {
  private final PresenceService attendanceService;

  public PresenceController(PresenceService attendanceService) {
    this.attendanceService = attendanceService;
  }

  @PostMapping("/scan")
  public ScanReponse scan(@Valid @RequestBody PresenceScanRequete request) {
    return attendanceService.scan(request);
  }

  @GetMapping("/today")
  public List<PresenceReponse> today() {
    return attendanceService.listForDate(LocalDate.now());
  }

  @GetMapping
  public List<PresenceReponse> byDate(@RequestParam String date) {
    return attendanceService.listForDate(LocalDate.parse(date));
  }
}
