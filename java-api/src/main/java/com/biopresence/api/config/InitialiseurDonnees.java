package com.biopresence.api.config;

import com.biopresence.api.service.AdministrateurService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class InitialiseurDonnees implements CommandLineRunner {

  private final AdministrateurService adminService;

  public InitialiseurDonnees(AdministrateurService adminService) {
    this.adminService = adminService;
  }

  @Override
  public void run(String... args) {
    adminService.seedDefault();
  }
}
