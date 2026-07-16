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
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "empreintes_digitales")
public class EmpreinteDigitale {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idEmpreinte;

  @Column(nullable = false, unique = true)
  public String templateId;

  @Lob
  @Column(nullable = false, columnDefinition = "LONGBLOB")
  public byte[] template;

  @Column(nullable = false)
  public LocalDateTime dateEnrolement = LocalDateTime.now();

  @Column(nullable = false)
  public Integer qualite;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public Doigt doigt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "etudiant_id")
  public Etudiant etudiant;
}