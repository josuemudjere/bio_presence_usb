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
@Table(name = "filieres")
public class Filiere {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Long idFiliere;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false, unique = true)
  public String code;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "departement_id")
  public Departement departement;

  @OneToMany(mappedBy = "filiere")
  public List<Promotion> promotions = new ArrayList<>();

  public Filiere() {
  }

  public List<Promotion> getPromotions() {
    return promotions;
  }
}
