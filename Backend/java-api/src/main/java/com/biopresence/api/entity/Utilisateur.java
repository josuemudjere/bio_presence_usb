package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@Entity
@Table(name = "utilisateurs")
public class Utilisateur {

  @Id
  public UUID id;

  @Column(nullable = false)
  public String nom;

  @Column
  public String prenom;

  @Column(nullable = false, unique = true)
  public String email;

  @Column(nullable = false)
  public String password;

  @Column(columnDefinition = "LONGTEXT")
  public String photoUrl;

  @Column(nullable = false)
  public LocalDateTime dateCreation = LocalDateTime.now();

  @Column
  public LocalDateTime derniereConnexion;

  @Column
  public Long coursId;

  @Column(name = "cours_ids", columnDefinition = "TEXT")
  public String coursIds;

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
    this.coursIds = coursId == null ? null : String.valueOf(coursId);
    this.role = normalizeRole(role);
    this.actif = true;
  }

  private String normalizeRole(String role) {
    if (role == null || role.isBlank()) {
      return "teacher";
    }

    String normalized = role.trim().toLowerCase(Locale.ROOT);
    return normalized.equals("user") ? "teacher" : normalized;
  }
}
