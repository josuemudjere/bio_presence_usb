package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "justificatifs")
public class Justificatif {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idJustificatif;

  @Column(nullable = false)
  public String titre;

  @Column(columnDefinition = "TEXT")
  public String description;

  @Column
  public String fichierUrl;

  @Column(nullable = false)
  public LocalDateTime dateSoumission = LocalDateTime.now();

  @Column(nullable = false)
  public boolean valide;
}