package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "annees_academiques")
public class AnneeAcademique {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idAnnee;

  @Column(nullable = false, unique = true)
  public String libelle;

  @Column(nullable = false)
  public LocalDate dateDebut;

  @Column(nullable = false)
  public LocalDate dateFin;

  @Column(nullable = false)
  public boolean estActive;

  @OneToMany(mappedBy = "anneeAcademique")
  public List<Semestre> semestres = new ArrayList<>();

  public List<Semestre> getSemestres() {
    return semestres;
  }
}