package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "enseignants")
public class Enseignant {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idEnseignant;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false)
  public String prenom;

  @Column(nullable = false)
  public String specialite;

  @Column(nullable = false)
  public String grade;

  @Column
  public String bureau;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "departement_id")
  public Departement departement;

  @OneToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "utilisateur_id", unique = true)
  public Utilisateur utilisateur;
}