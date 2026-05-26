package com.biopresence.api.controller;

import com.biopresence.api.dto.ParametresCoursRequete;
import com.biopresence.api.dto.ParametresCoursReponse;
import com.biopresence.api.service.ParametresCoursService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/course-settings")
public class ParametresCoursController {
  private final ParametresCoursService courseSettingsService;

  public ParametresCoursController(ParametresCoursService courseSettingsService) {
    this.courseSettingsService = courseSettingsService;
  }

  @GetMapping
  public ParametresCoursReponse getCurrent() {
    return courseSettingsService.getCurrent();
  }

  @PutMapping
  public ParametresCoursReponse save(@Valid @RequestBody ParametresCoursRequete request) {
    return courseSettingsService.save(request);
  }
}
