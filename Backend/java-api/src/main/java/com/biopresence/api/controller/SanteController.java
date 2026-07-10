package com.biopresence.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

import java.util.Map;

@RestController
public class SanteController {

  @GetMapping("/")
  public RedirectView root() {
    return new RedirectView("/api/health");
  }

  @GetMapping("/api/health")
  public Map<String, String> health() {
    return Map.of("status", "UP", "service", "BioPresence API");
  }
}
