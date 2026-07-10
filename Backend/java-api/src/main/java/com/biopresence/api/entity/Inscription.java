package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "inscriptions")
public class Inscription {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idInscription;

  @Column(nullable = false)
  public LocalDate dateInscription;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public StatutInscription statut = StatutInscription.EN_ATTENTE;

  @Column(columnDefinition = "TEXT")
  public String notes;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "etudiant_id")
  public Etudiant etudiant;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "cours_id")
  public Cours cours;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "semestre_id")
  public Semestre semestre;
}