package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "cours")
public class Cours {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false)
  public String nom;

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

  public Cours() {}

  public Cours(String nom, int nbJours, int nbHeures, int seuilEligibilite, String heureDebut, String heureFin) {
    this.nom = nom;
    this.nbJours = nbJours;
    this.nbHeures = nbHeures;
    this.seuilEligibilite = seuilEligibilite;
    this.heureDebut = heureDebut;
    this.heureFin = heureFin;
  }
}
