package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "universites")
public class Universite {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idUniversite;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false)
  public String sigle;

  @Column
  public String adresse;

  @Column
  public String siteWeb;
}