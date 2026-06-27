package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "utilisateurs")
public class Utilisateur {

  @Id
  public UUID id;

  @Column(nullable = false)
  public String nom;

  @Column(nullable = false, unique = true)
  public String email;

  @Column(nullable = false)
  public String password;

  @Column(columnDefinition = "LONGTEXT")
  public String photoUrl;

  @Column
  public Long coursId;

  @Column(nullable = false)
  public String role = "user";

  @Column(nullable = false)
  public boolean actif = true;

  public Utilisateur() {}

  public Utilisateur(String nom, String email, String password, Long coursId, String role) {
    this.id = UUID.randomUUID();
    this.nom = nom;
    this.email = email;
    this.password = password;
    this.coursId = coursId;
    this.role = (role != null && !role.isBlank()) ? role : "user";
    this.actif = true;
  }
}
