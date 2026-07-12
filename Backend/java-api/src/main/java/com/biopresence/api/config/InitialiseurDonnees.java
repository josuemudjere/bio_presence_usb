package com.biopresence.api.config;

import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.service.AdministrateurService;
import com.biopresence.api.service.EtudiantService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

@Component
public class InitialiseurDonnees implements CommandLineRunner {

  private final AdministrateurService adminService;
  private final JdbcTemplate jdbcTemplate;
  private final EtudiantService studentService;

  public InitialiseurDonnees(AdministrateurService adminService, JdbcTemplate jdbcTemplate, EtudiantService studentService) {
    this.adminService = adminService;
    this.jdbcTemplate = jdbcTemplate;
    this.studentService = studentService;
  }

  @Override
  public void run(String... args) {
    migrateStudentStatusColumn();
    migrateStudentFingerprintStorage();
    migrateStudentInscriptions();
    adminService.seedDefault();
  }

  private void migrateStudentStatusColumn() {
    jdbcTemplate.execute("""
      ALTER TABLE etudiants
      MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIF'
      """);

    jdbcTemplate.update("""
      UPDATE etudiants
      SET status = CASE UPPER(status)
        WHEN 'READY' THEN 'ACTIF'
        WHEN 'PENDING' THEN 'INACTIF'
        ELSE UPPER(status)
      END
      WHERE status IS NOT NULL
      """);
  }

  private void migrateStudentFingerprintStorage() {
    // Je recopie au démarrage les anciens CSV d'empreintes vers les stockages normalisés liés à l'étudiant.
    for (Etudiant student : studentService.listEntities()) {
      List<String> normalizedIds = parseFingerprintIds(student.fingerprintTemplateId);

      if (normalizedIds.isEmpty()) {
        student.fingerprintTemplateIds.clear();
        student.fingerprintTemplateId = null;
        student.fingerprintRegistered = false;
        student.fingerprintCount = 0;
        studentService.save(student);
        continue;
      }

      student.fingerprintTemplateIds.clear();
      student.fingerprintTemplateIds.addAll(normalizedIds);
      student.fingerprintTemplateId = String.join(",", normalizedIds);
      student.fingerprintRegistered = true;
      student.fingerprintCount = normalizedIds.size();
      studentService.save(student);
    }
  }

  private void migrateStudentInscriptions() {
    // Je convertis les anciennes affectations étudiant->promotion/cours vers la table inscriptions quand elle est vide.
    jdbcTemplate.update("""
      INSERT INTO inscriptions (date_inscription, statut, notes, etudiant_id, cours_id, semestre_id)
      SELECT CURRENT_DATE, 'VALIDEE', 'Affectation legacy via coursId', e.id, e.cours_id, NULL
      FROM etudiants e
      LEFT JOIN inscriptions i ON i.etudiant_id = e.id AND i.cours_id = e.cours_id
      LEFT JOIN cours c ON c.id = e.cours_id
      WHERE e.cours_id IS NOT NULL AND c.id IS NOT NULL AND i.id_inscription IS NULL
      """);

    for (Etudiant student : studentService.listEntities()) {
      studentService.backfillLegacyInscriptionsIfMissing(student);
    }
  }

  private List<String> parseFingerprintIds(String fingerprintTemplateId) {
    if (fingerprintTemplateId == null || fingerprintTemplateId.isBlank()) {
      return List.of();
    }

    return Arrays.stream(fingerprintTemplateId.split(","))
      .map(value -> value.trim().toUpperCase())
      .filter(value -> !value.isEmpty())
      .collect(java.util.stream.Collectors.collectingAndThen(
        java.util.stream.Collectors.toCollection(LinkedHashSet::new),
        List::copyOf
      ));
  }
}
