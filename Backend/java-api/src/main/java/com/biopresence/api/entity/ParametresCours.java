package com.biopresence.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "parametres_cours")
public class ParametresCours {
  @Id
  public Long id = 1L;

  @Column(nullable = false)
  public String courseName = "";

  @Column(nullable = false)
  public int courseDays = 0;

  @Column(nullable = false)
  public int courseHours = 0;

  @Column(nullable = false)
  public int eligibilityThreshold = 75;

  @Column(name = "cours_id")
  public Long coursId;

  public String startTime;

  public String endTime;

  public ParametresCours() {
  }
}
