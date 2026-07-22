package com.biopresence.api.controller;

import com.biopresence.api.dto.JustificatifDepartAnticipeRequete;
import com.biopresence.api.dto.PresenceManuelleRequete;
import com.biopresence.api.dto.PresenceReponse;
import com.biopresence.api.dto.PresenceScanRequete;
import com.biopresence.api.dto.ScanReponse;
import com.biopresence.api.service.PresenceService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import com.biopresence.api.mqtt.MqttBridgeService;

@RestController
@RequestMapping("/api/attendance")
public class PresenceController {
  private final PresenceService attendanceService;
  private final MqttBridgeService mqttBridgeService;

  public PresenceController(PresenceService attendanceService, MqttBridgeService mqttBridgeService) {
    this.attendanceService = attendanceService;
    this.mqttBridgeService = mqttBridgeService;
  }

  @PostMapping("/scan")
  public ScanReponse scan(@Valid @RequestBody PresenceScanRequete request) {
    // Déclenche un pointage biométrique pour le cours ciblé.
    return attendanceService.scan(request);
  }

  record ScanRequestRequete(Long coursId) {}

  @PostMapping("/scan-request")
  public ScanReponse scanRequest(@Valid @RequestBody ScanRequestRequete request) {
    // Le backend publie la commande SCAN vers le capteur, persiste l'événement reçu puis renvoie la présence créée.
    long timeoutMs = 30_000L;
    return mqttBridgeService.requestScan(request.coursId(), timeoutMs);
  }

  @PostMapping("/manual")
  public PresenceReponse manual(@Valid @RequestBody PresenceManuelleRequete request) {
    // Permet une saisie manuelle quand le scan n'est pas possible ou doit être corrigé.
    return attendanceService.createManualAttendance(request);
  }

  @PatchMapping("/{attendanceId}/departure-justification")
  public PresenceReponse saveDepartureJustification(
    @PathVariable String attendanceId,
    @RequestBody JustificatifDepartAnticipeRequete request
  ) {
    // Persiste le motif de départ anticipé dans la table justificatifs et le rattache à la présence.
    return attendanceService.saveDepartureJustification(attendanceId, request);
  }

  @GetMapping("/today")
  public List<PresenceReponse> today() {
    // Raccourci pratique pour la vue journalière courante de l'administration.
    return attendanceService.listForDate(LocalDate.now());
  }

  @GetMapping
  public List<PresenceReponse> byDate(@RequestParam String date) {
    // Filtre les présences sur une date explicite fournie par le client.
    return attendanceService.listForDate(LocalDate.parse(date));
  }

  @GetMapping("/course/{coursId}")
  public List<PresenceReponse> byCourseAndDate(@PathVariable Long coursId, @RequestParam String date) {
    // Restreint l'affichage aux étudiants inscrits dans un cours donné pour une date donnée.
    return attendanceService.listForCourseAndDate(coursId, LocalDate.parse(date));
  }

  @GetMapping("/course/{coursId}/week")
  public List<PresenceReponse> byCourseAndPeriod(
    @PathVariable Long coursId,
    @RequestParam String startDate,
    @RequestParam String endDate
  ) {
    // Sert surtout aux rapports hebdomadaires et exports enseignants.
    return attendanceService.listForCourseBetween(coursId, LocalDate.parse(startDate), LocalDate.parse(endDate));
  }

  @DeleteMapping
  public void resetAll() {
    // Réinitialise le registre des présences, utile en phase de test ou de démonstration.
    attendanceService.resetAllAttendances();
  }
}
