package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "facultes")
public class Faculte {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idFaculte;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false)
  public String code;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "universite_id")
  public Universite universite;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "doyen_id")
  public Enseignant doyen;

  @OneToMany(mappedBy = "faculte")
  public List<Departement> departements = new ArrayList<>();

  @OneToMany(mappedBy = "faculte")
  public List<Programme> programmes = new ArrayList<>();

  public List<Departement> getDepartements() {
    return departements;
  }

  public List<Programme> getProgrammes() {
    return programmes;
  }
}