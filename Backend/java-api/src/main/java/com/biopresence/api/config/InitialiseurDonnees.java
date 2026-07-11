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
    // Je recopie au démarrage les anciens CSV d'empreintes vers la table normalisée multi-doigts.
    for (Etudiant student : studentService.listEntities()) {
      List<String> normalizedIds = parseFingerprintIds(student.fingerprintTemplateId);

      if (normalizedIds.isEmpty()) {
        if (!student.fingerprintTemplateIds.isEmpty() || student.fingerprintRegistered || student.fingerprintCount != 0) {
          student.fingerprintTemplateIds.clear();
          student.fingerprintTemplateId = null;
          student.fingerprintRegistered = false;
          student.fingerprintCount = 0;
          studentService.save(student);
        }
        continue;
      }

      boolean needsSync = !student.fingerprintTemplateIds.equals(new LinkedHashSet<>(normalizedIds))
        || !String.join(",", normalizedIds).equals(student.fingerprintTemplateId)
        || !student.fingerprintRegistered
        || student.fingerprintCount != normalizedIds.size();

      if (!needsSync) {
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
