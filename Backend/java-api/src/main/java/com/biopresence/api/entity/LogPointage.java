package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "logs_pointage")
public class LogPointage {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idLog;

  @Column(nullable = false)
  public LocalDateTime dateHeure = LocalDateTime.now();

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public TypeEvenement typeEvenement;

  @Column(nullable = false)
  public String message;

  @Column(columnDefinition = "TEXT")
  public String details;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "etudiant_id")
  public Etudiant etudiant;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "enseignant_id")
  public Enseignant enseignant;
}