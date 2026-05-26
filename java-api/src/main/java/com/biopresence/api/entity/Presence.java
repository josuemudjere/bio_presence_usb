package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(
  name = "presences"
)
public class Presence {
  @Id
  public UUID id;

  @Column(nullable = false)
  public UUID studentId;

  @Column(nullable = false)
  public String studentName;

  @Column(nullable = false)
  public String matricule;

  @Column(nullable = false)
  public String department;

  @Column(nullable = false)
  public LocalDate recordDate;

  @Column(nullable = false)
  public LocalTime checkIn;

  public LocalTime checkOut;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  public StatutPresence status = StatutPresence.OPEN;

  public Presence() {
  }

  public Presence(UUID studentId, String studentName, String matricule, String department, LocalDate recordDate, LocalTime checkIn) {
    this.id = UUID.randomUUID();
    this.studentId = studentId;
    this.studentName = studentName;
    this.matricule = matricule;
    this.department = department;
    this.recordDate = recordDate;
    this.checkIn = checkIn;
    this.status = StatutPresence.OPEN;
  }
}
