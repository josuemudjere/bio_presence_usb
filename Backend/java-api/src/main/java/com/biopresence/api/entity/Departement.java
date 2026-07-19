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
@Table(name = "departements")
public class Departement {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idDepartement;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false, unique = true)
  public String code;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "faculte_id")
  public Faculte faculte;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "chef_departement_id")
  public Enseignant chefDepartement;

  @OneToMany(mappedBy = "departement")
  public List<Enseignant> enseignants = new ArrayList<>();

  @OneToMany(mappedBy = "departement")
  public List<Cours> cours = new ArrayList<>();

  public List<Enseignant> getEnseignants() {
    return enseignants;
  }

  public List<Cours> getCours() {
    return cours;
  }
}