package com.biopresence.api.controller;

import com.biopresence.api.dto.EtudiantRequete;
import com.biopresence.api.dto.MetadataEmpreinteRequete;
import com.biopresence.api.dto.EtudiantReponse;
import com.biopresence.api.dto.ReservationEmpreinteReponse;
import com.biopresence.api.dto.ReservationEmpreinteRequete;
import com.biopresence.api.service.EtudiantService;
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
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/students")
public class EtudiantController {
  private final EtudiantService studentService;

  public EtudiantController(EtudiantService studentService) {
    this.studentService = studentService;
  }

  @GetMapping
  public List<EtudiantReponse> list() {
    // Retourne la liste complète des étudiants pour l'interface d'administration.
    return studentService.listAll();
  }

  @GetMapping("/course/{coursId}")
  public List<EtudiantReponse> listForCourse(@PathVariable Long coursId) {
    // Retourne uniquement les étudiants réellement inscrits au cours via la table inscriptions.
    return studentService.listForCourse(coursId);
  }

  @GetMapping("/{id}")
  public EtudiantReponse getById(@PathVariable UUID id) {
    // Charge un étudiant précis pour consultation ou préremplissage du formulaire.
    return studentService.getById(id);
  }

  @PostMapping
  public EtudiantReponse create(@Valid @RequestBody EtudiantRequete request) {
    // Crée un étudiant avec ses données d'identité, d'affectation et d'empreinte éventuelle.
    return studentService.create(request);
  }

  @PostMapping("/fingerprint-reservations")
  public ReservationEmpreinteReponse reserveFingerprint(@Valid @RequestBody ReservationEmpreinteRequete request) {
    return studentService.reserveFingerprintForEnrollment(
      request.fingerprintTemplateId(),
      request.fingerprintTemplateDataBase64(),
      request.doigt()
    );
  }

  @PutMapping("/fingerprints/{fingerprintTemplateId}/metadata")
  public ResponseEntity<Void> updateFingerprintMetadata(
    @PathVariable String fingerprintTemplateId,
    @RequestBody MetadataEmpreinteRequete request
  ) {
    studentService.updateFingerprintMetadata(fingerprintTemplateId, request);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/fingerprint-reservations/{fingerprintTemplateId}")
  public ResponseEntity<Void> releaseFingerprint(@PathVariable String fingerprintTemplateId) {
    studentService.releaseFingerprintReservation(fingerprintTemplateId);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/resync-inscriptions")
  public Map<String, Object> resyncInscriptions() {
    int syncedStudents = studentService.resyncAllInscriptions();
    return Map.of(
      "message", "Les inscriptions étudiants ont été resynchronisées.",
      "syncedStudents", syncedStudents
    );
  }

  @PutMapping("/{id}")
  public EtudiantReponse update(@PathVariable UUID id, @Valid @RequestBody EtudiantRequete request) {
    // Met à jour la fiche sans exposer directement l'entité persistée au client.
    return studentService.update(id, request);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    // Une suppression réussie répond en 204 pour rester conforme aux usages REST.
    studentService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
