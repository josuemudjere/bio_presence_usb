package com.biopresence.api.config;

import com.biopresence.api.service.AdministrateurService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class InitialiseurDonnees implements CommandLineRunner {

  private final AdministrateurService adminService;
  private final JdbcTemplate jdbcTemplate;

  public InitialiseurDonnees(AdministrateurService adminService, JdbcTemplate jdbcTemplate) {
    this.adminService = adminService;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public void run(String... args) {
    migrateStudentStatusColumn();
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
}
