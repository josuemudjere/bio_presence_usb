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
@Table(name = "facultes")
public class Faculte {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idFaculte;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false)
  public String sigle;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "universite_id")
  public Universite universite;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "doyen_id")
  public Enseignant doyen;
}