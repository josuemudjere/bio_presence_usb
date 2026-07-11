package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;
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

  @Column
  public String postNom;

  @Column
  public String prenom;

  @Column(nullable = false, unique = true)
  public String matricule;

  @Column
  public LocalDate dateNaissance;

  @Column
  public String lieuNaissance;

  @Column(columnDefinition = "TEXT")
  public String adresse;

  @Column
  public String telephone;

  @Column(nullable = false)
  public String department;

  @Column(nullable = false)
  public String level;

  @Column
  public Long coursId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "promotion_id")
  public Promotion promotion;

  @Column(columnDefinition = "LONGTEXT")
  public String photoUrl;

  @Column(nullable = false)
  public boolean fingerprintRegistered = false;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
    name = "etudiant_fingerprint_template_ids",
    joinColumns = @JoinColumn(name = "etudiant_id"),
    uniqueConstraints = @UniqueConstraint(columnNames = { "fingerprint_template_id" })
  )
  @Column(name = "fingerprint_template_id", nullable = false)
  public Set<String> fingerprintTemplateIds = new LinkedHashSet<>();

  @Column(unique = true)
  public String fingerprintTemplateId;

  @Column(nullable = false)
  public int fingerprintCount = 0;

  public String lastFingerprintScan;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, columnDefinition = "VARCHAR(20)")
  public StatutEtudiant status = StatutEtudiant.ACTIF;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "programme_id")
  public Programme programme;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "annee_academique_id")
  public AnneeAcademique anneeAcademique;

  public Etudiant() {
  }

  public Etudiant(String name, String matricule, String department, String level, Long coursId, String photoUrl, String fingerprintTemplateId) {
    this.id = UUID.randomUUID();
    this.name = name;
    this.matricule = matricule;
    this.department = department;
    this.level = level;
    this.coursId = coursId;
    this.photoUrl = photoUrl;
    this.fingerprintTemplateId = fingerprintTemplateId;
    if (fingerprintTemplateId != null && !fingerprintTemplateId.isBlank()) {
      this.fingerprintTemplateIds.add(fingerprintTemplateId);
    }
    this.fingerprintRegistered = fingerprintTemplateId != null && !fingerprintTemplateId.isBlank();
    this.fingerprintCount = this.fingerprintRegistered ? 1 : 0;
    this.status = StatutEtudiant.ACTIF;
  }
}
