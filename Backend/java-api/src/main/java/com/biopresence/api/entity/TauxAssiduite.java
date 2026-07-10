package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "taux_assiduite")
public class TauxAssiduite {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idTaux;

  @Column(nullable = false)
  public Double taux;

  @Column(nullable = false)
  public Double seuilMinimum;

  @Column(nullable = false)
  public boolean estConforme;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "etudiant_id")
  public Etudiant etudiant;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "semestre_id")
  public Semestre semestre;
}