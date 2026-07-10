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
@Table(name = "cours")
public class Cours {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false)
  public String nom;

  @Column(unique = true)
  public String code;

  @Column
  public String intitule;

  @Column(nullable = false)
  public int credits = 0;

  @Column(nullable = false)
  public int volumeHoraire = 0;

  @Column
  public String salle;

  @Column
  public String horaire;

  @Column
  public String jourSemaine;

  @Column(nullable = false)
  public int nbJours = 0;

  @Column(nullable = false)
  public int nbHeures = 0;

  @Column(nullable = false)
  public int seuilEligibilite = 75;

  @Column
  public String heureDebut;

  @Column
  public String heureFin;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "enseignant_id")
  public Enseignant enseignant;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "departement_id")
  public Departement departement;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "programme_id")
  public Programme programme;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "semestre_id")
  public Semestre semestre;

  public Cours() {}

  public Cours(String nom, int nbJours, int nbHeures, int seuilEligibilite, String heureDebut, String heureFin) {
    this.nom = nom;
    this.intitule = nom;
    this.nbJours = nbJours;
    this.nbHeures = nbHeures;
    this.volumeHoraire = nbHeures;
    this.seuilEligibilite = seuilEligibilite;
    this.heureDebut = heureDebut;
    this.heureFin = heureFin;
  }
}
