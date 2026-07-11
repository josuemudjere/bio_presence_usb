package com.biopresence.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

import java.util.Map;

@RestController
public class SanteController {

  @GetMapping("/")
  public RedirectView root() {
    // La racine redirige vers le healthcheck pour donner un point d'entrée simple aux tests manuels.
    return new RedirectView("/api/health");
  }

  @GetMapping("/api/health")
  public Map<String, String> health() {
    // Endpoint minimal de supervision pour vérifier que l'API répond bien.
    return Map.of("status", "UP", "service", "BioPresence API");
  }
}
