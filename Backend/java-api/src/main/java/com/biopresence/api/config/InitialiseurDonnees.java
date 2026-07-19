package com.biopresence.api.config;

import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.service.AdministrateurService;
import com.biopresence.api.service.EtudiantService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

@Component
public class InitialiseurDonnees implements CommandLineRunner {
  private static final Logger logger = LoggerFactory.getLogger(InitialiseurDonnees.class);

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
    migrateFingerprintTemplateColumn();
    migrateFingerprintQualityColumn();
    migrateInscriptionStatusColumn();
    migrateStudentStatusColumn();
    migrateStudentFingerprintStorage();
    migrateStudentInscriptions();
    migratePresenceRelations();
    adminService.seedDefault();
  }

  private void migrateFingerprintTemplateColumn() {
    jdbcTemplate.execute("""
      ALTER TABLE empreintes_digitales
      MODIFY COLUMN template LONGBLOB NOT NULL
      """);
  }

  private void migrateFingerprintQualityColumn() {
    // Le champ qualite n'est plus utilisé côté application, on le retire des instances existantes.
    if (columnExists("empreintes_digitales", "qualite")) {
      jdbcTemplate.execute("""
        ALTER TABLE empreintes_digitales
        DROP COLUMN qualite
        """);
    }
  }

  private boolean columnExists(String tableName, String columnName) {
    Integer count = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(*)
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      """,
      Integer.class,
      tableName,
      columnName
    );

    return count != null && count > 0;
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
    // Je recopie les anciens identifiants CSV dans empreintes_digitales puis je supprime la table legacy.
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

    jdbcTemplate.execute("DROP TABLE IF EXISTS etudiant_fingerprint_template_ids");
  }

  private void migrateStudentInscriptions() {
    // Je convertis les anciennes affectations étudiant->promotion/cours vers la table inscriptions quand elle est vide.
    jdbcTemplate.update("""
      INSERT INTO inscriptions (date_inscription, statut, notes, etudiant_id, cours_id, semestre_id)
      SELECT CURRENT_DATE, 'VALIDE', 'Affectation legacy via coursId', e.id, e.cours_id, NULL
      FROM etudiants e
      LEFT JOIN inscriptions i ON i.etudiant_id = e.id AND i.cours_id = e.cours_id
      LEFT JOIN cours c ON c.id = e.cours_id
      WHERE e.cours_id IS NOT NULL AND c.id IS NOT NULL AND i.id_inscription IS NULL
      """);

    // Migration de compatibilité: l'ancienne valeur VALIDEE devient VALIDE.
    jdbcTemplate.update("""
      UPDATE inscriptions
      SET statut = 'VALIDE'
      WHERE statut = 'VALIDEE'
      """);

    for (Etudiant student : studentService.listEntities()) {
      studentService.backfillLegacyInscriptionsIfMissing(student);
    }
  }

  private void migrateInscriptionStatusColumn() {
    // Certains schémas legacy ont un ENUM incompatible (ex: VALIDEE) qui rejette la valeur VALIDE.
    jdbcTemplate.execute("""
      ALTER TABLE inscriptions
      MODIFY COLUMN statut VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
      """);

    jdbcTemplate.update("""
      UPDATE inscriptions
      SET statut = 'VALIDE'
      WHERE UPPER(statut) = 'VALIDEE'
      """);
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

  private void migratePresenceRelations() {
    // Nettoie les références optionnelles cassées pour permettre l'ajout des contraintes FK.
    if (columnExists("presences", "cours_id")) {
      jdbcTemplate.update("""
        UPDATE presences p
        LEFT JOIN cours c ON c.id = p.cours_id
        SET p.cours_id = NULL
        WHERE p.cours_id IS NOT NULL AND c.id IS NULL
        """);
    }

    if (columnExists("presences", "empreinte_digitale_id")) {
      jdbcTemplate.update("""
        UPDATE presences p
        LEFT JOIN empreintes_digitales ed ON ed.id_empreinte = p.empreinte_digitale_id
        SET p.empreinte_digitale_id = NULL
        WHERE p.empreinte_digitale_id IS NOT NULL AND ed.id_empreinte IS NULL
        """);
    }

    addForeignKeyIfSafe(
      "presences",
      "fk_presences_student",
      "student_id",
      "etudiants",
      "id"
    );

    addForeignKeyIfSafe(
      "presences",
      "fk_presences_cours",
      "cours_id",
      "cours",
      "id"
    );

    addForeignKeyIfSafe(
      "presences",
      "fk_presences_empreinte",
      "empreinte_digitale_id",
      "empreintes_digitales",
      "id_empreinte"
    );
  }

  private void addForeignKeyIfSafe(
    String sourceTable,
    String constraintName,
    String sourceColumn,
    String targetTable,
    String targetColumn
  ) {
    if (!columnExists(sourceTable, sourceColumn)) {
      return;
    }

    if (foreignKeyExists(sourceTable, constraintName)
      || foreignKeyForColumnExists(sourceTable, sourceColumn, targetTable, targetColumn)) {
      return;
    }

    Integer invalidRows = jdbcTemplate.queryForObject(
      String.format(
        """
        SELECT COUNT(*)
        FROM %s s
        LEFT JOIN %s t ON t.%s = s.%s
        WHERE s.%s IS NOT NULL AND t.%s IS NULL
        """,
        sourceTable,
        targetTable,
        targetColumn,
        sourceColumn,
        sourceColumn,
        targetColumn
      ),
      Integer.class
    );

    if (invalidRows != null && invalidRows > 0) {
      logger.warn(
        "Skip FK {} on {}.{} -> {}.{} because {} invalid rows remain",
        constraintName,
        sourceTable,
        sourceColumn,
        targetTable,
        targetColumn,
        invalidRows
      );
      return;
    }

    jdbcTemplate.execute(
      String.format(
        "ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s(%s)",
        sourceTable,
        constraintName,
        sourceColumn,
        targetTable,
        targetColumn
      )
    );
  }

  private boolean foreignKeyExists(String tableName, String constraintName) {
    Integer count = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(*)
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      """,
      Integer.class,
      tableName,
      constraintName
    );

    return count != null && count > 0;
  }

  private boolean foreignKeyForColumnExists(
    String tableName,
    String columnName,
    String referencedTableName,
    String referencedColumnName
  ) {
    Integer count = jdbcTemplate.queryForObject(
      """
      SELECT COUNT(*)
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME = ?
        AND REFERENCED_COLUMN_NAME = ?
      """,
      Integer.class,
      tableName,
      columnName,
      referencedTableName,
      referencedColumnName
    );

    return count != null && count > 0;
  }
}
