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

import java.time.LocalDate;

@Entity
@Table(name = "semestres")
public class Semestre {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idSemestre;

  @Column(nullable = false)
  public Integer numero;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "annee_academique_id")
  public AnneeAcademique anneeAcademique;

  @Column(nullable = false)
  public LocalDate dateDebut;

  @Column(nullable = false)
  public LocalDate dateFin;

  @Column(nullable = false)
  public Integer creditsECTS = 30;
}