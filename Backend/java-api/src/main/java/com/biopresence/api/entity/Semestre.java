package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

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

  @OneToMany(mappedBy = "semestre")
  public List<Cours> cours = new ArrayList<>();

  @OneToMany(mappedBy = "semestre")
  public List<Inscription> inscriptions = new ArrayList<>();

  public List<Cours> getCours() {
    return cours;
  }

  public List<Inscription> getInscriptions() {
    return inscriptions;
  }
}