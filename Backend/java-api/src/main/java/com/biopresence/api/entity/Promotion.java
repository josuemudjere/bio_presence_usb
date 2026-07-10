package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

  @Column(nullable = false)
  public String departement;

  @Column(nullable = false)
  public String programme;

  @Column(name = "cours_ids", columnDefinition = "TEXT")
  public String coursIds;
}