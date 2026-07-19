package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(
  name = "presences"
)
public class Presence {
  @Id
  public UUID id;

  @Column(name = "student_id", nullable = false)
  public UUID studentId;

  @Column(name = "cours_id")
  public Long coursId;

  @Column(nullable = false)
  public String studentName;

  @Column(nullable = false)
  public String matricule;

  @Column(nullable = false)
  public String department;

  @Column(nullable = false)
  public LocalDateTime dateHeure;

  @Column(nullable = false)
  public LocalTime heureArrivee;

  @Column(nullable = false)
  public LocalDate recordDate;

  @Column(nullable = false)
  public LocalTime checkIn;

  public LocalTime checkOut;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public StatutPresence status = StatutPresence.PRESENT;

  @Column(nullable = false)
  public boolean estJustifiee = false;

  @Column(columnDefinition = "TEXT")
  public String motifJustificatif;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public ModeSaisie modeSaisie = ModeSaisie.EMPREINTE;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "student_id", referencedColumnName = "id", insertable = false, updatable = false)
  public Etudiant etudiant;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "empreinte_digitale_id")
  public EmpreinteDigitale empreinteDigitale;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "seance_id")
  public Seance seance;

  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "justificatif_id")
  public Justificatif justificatif;

  public Presence() {
  }

  public Presence(UUID studentId, Long coursId, String studentName, String matricule, String department, LocalDate recordDate, LocalTime checkIn) {
    this.id = UUID.randomUUID();
    this.studentId = studentId;
    this.coursId = coursId;
    this.studentName = studentName;
    this.matricule = matricule;
    this.department = department;
    this.dateHeure = LocalDateTime.of(recordDate, checkIn);
    this.heureArrivee = checkIn;
    this.recordDate = recordDate;
    this.checkIn = checkIn;
    this.status = StatutPresence.PRESENT;
  }
}
