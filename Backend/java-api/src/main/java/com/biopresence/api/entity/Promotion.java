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
@Table(name = "promotions")
public class Promotion {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long id;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false)
  public String niveau;

  @Column
  public String description;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "filiere_id")
  public Filiere filiere;

  @Column(nullable = false)
  public String departement;

  @Column(nullable = false)
  public String programme;

  @Column(name = "cours_ids", columnDefinition = "TEXT")
  public String coursIds;
}