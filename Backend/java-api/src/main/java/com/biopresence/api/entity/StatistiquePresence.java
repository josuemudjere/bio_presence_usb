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
@Table(name = "statistiques_presence")
public class StatistiquePresence {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idStat;

  @Column(nullable = false)
  public Double tauxGlobal;

  @Column(nullable = false)
  public Double tauxRetards;

  @Column(nullable = false)
  public Double tauxAbsences;

  @Column(nullable = false)
  public Integer totalSeances;

  @Column(nullable = false)
  public Integer totalPresences;

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