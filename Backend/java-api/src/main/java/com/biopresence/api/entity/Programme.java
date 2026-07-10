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

@Entity
@Table(name = "programmes")
public class Programme {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idProgramme;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false, unique = true)
  public String code;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public CycleLMD cycle = CycleLMD.LICENCE;

  @Column(nullable = false)
  public Integer dureeSemestres;

  @Column(nullable = false)
  public Integer totalCredits;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "faculte_id")
  public Faculte faculte;
}