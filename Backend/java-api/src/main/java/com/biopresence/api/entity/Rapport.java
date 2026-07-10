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

import java.time.LocalDateTime;

@Entity
@Table(name = "rapports")
public class Rapport {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idRapport;

  @Column(nullable = false)
  public String titre;

  @Column(nullable = false)
  public LocalDateTime dateGeneration = LocalDateTime.now();

  @Column(columnDefinition = "LONGTEXT")
  public String contenu;

  @Column(nullable = false)
  public String format;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "cours_id")
  public Cours cours;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "enseignant_id")
  public Enseignant enseignant;
}