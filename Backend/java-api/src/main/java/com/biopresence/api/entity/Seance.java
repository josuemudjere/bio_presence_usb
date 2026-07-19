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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "seances")
public class Seance {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idSeance;

  @Column(nullable = false)
  public LocalDate date;

  @Column(nullable = false)
  public LocalTime heureDebut;

  @Column(nullable = false)
  public LocalTime heureFin;

  @Column
  public String salle;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public StatutSeance statut = StatutSeance.PLANIFIEE;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "cours_id")
  public Cours cours;

  @OneToMany(mappedBy = "seance")
  public List<Presence> presences = new ArrayList<>();

  public List<Presence> getPresences() {
    return presences;
  }
}