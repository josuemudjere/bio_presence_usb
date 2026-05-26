package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(
  name = "etudiants"
)
public class Etudiant {
  @Id
  public UUID id;

  @Column(nullable = false)
  public String name;

  @Column(nullable = false, unique = true)
  public String matricule;

  @Column(nullable = false)
  public String department;

  @Column(nullable = false)
  public String level;

  @Column(columnDefinition = "LONGTEXT")
  public String photoUrl;

  @Column(nullable = false)
  public boolean fingerprintRegistered = false;

  @Column(unique = true)
  public String fingerprintTemplateId;

  @Column(nullable = false)
  public int fingerprintCount = 0;

  public String lastFingerprintScan;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public StatutEtudiant status = StatutEtudiant.READY;

  public Etudiant() {
  }

  public Etudiant(String name, String matricule, String department, String level, String photoUrl, String fingerprintTemplateId) {
    this.id = UUID.randomUUID();
    this.name = name;
    this.matricule = matricule;
    this.department = department;
    this.level = level;
    this.photoUrl = photoUrl;
    this.fingerprintTemplateId = fingerprintTemplateId;
    this.fingerprintRegistered = fingerprintTemplateId != null && !fingerprintTemplateId.isBlank();
    this.fingerprintCount = this.fingerprintRegistered ? 1 : 0;
    this.status = this.fingerprintRegistered ? StatutEtudiant.READY : StatutEtudiant.PENDING;
  }
}
