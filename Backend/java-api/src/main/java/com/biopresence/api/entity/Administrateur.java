package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "administrateurs")
public class Administrateur {

  @Id
  public UUID id;

  @Column(nullable = false)
  public String name;

  @Column
  public String prenom;

  @Column(nullable = false, unique = true)
  public String email;

  @Column(nullable = false)
  public String password;

  @Column(columnDefinition = "LONGTEXT")
  public String photoUrl;

  @Column
  public String niveauAcces;

  @Column(columnDefinition = "TEXT")
  public String permissions;

  @Column(nullable = false)
  public LocalDateTime dateCreation = LocalDateTime.now();

  @Column
  public LocalDateTime derniereConnexion;

  public Administrateur() {}

  public Administrateur(String name, String email, String password) {
    this.id = UUID.randomUUID();
    this.name = name;
    this.email = email;
    this.password = password;
    this.niveauAcces = "GLOBAL";
    this.permissions = "GERER_UTILISATEURS,GERER_EMPREINTES,CONSULTER_LOGS";
  }
}
