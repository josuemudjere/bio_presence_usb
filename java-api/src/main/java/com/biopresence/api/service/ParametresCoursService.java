package com.biopresence.api.service;

import com.biopresence.api.dto.ParametresCoursRequete;
import com.biopresence.api.dto.ParametresCoursReponse;
import com.biopresence.api.entity.ParametresCours;
import com.biopresence.api.repository.ParametresCoursRepository;
import org.springframework.stereotype.Service;

@Service
public class ParametresCoursService {
  private final ParametresCoursRepository courseSettingsRepository;

  public ParametresCoursService(ParametresCoursRepository courseSettingsRepository) {
    this.courseSettingsRepository = courseSettingsRepository;
  }

  public ParametresCours getCurrentEntity() {
    return courseSettingsRepository.findById(1L).orElseGet(ParametresCours::new);
  }

  public ParametresCoursReponse getCurrent() {
    return toResponse(getCurrentEntity());
  }

  public ParametresCoursReponse save(ParametresCoursRequete request) {
    ParametresCours settings = getCurrentEntity();
    settings.id = 1L;
    settings.courseName = request.courseName().trim();
    settings.courseDays = request.courseDays();
    settings.courseHours = request.courseHours();
    settings.eligibilityThreshold = request.eligibilityThreshold();
    courseSettingsRepository.save(settings);
    return toResponse(settings);
  }

  public boolean isConfigured() {
    ParametresCours settings = getCurrentEntity();
    return settings.courseName != null && !settings.courseName.isBlank() && settings.courseDays > 0 && settings.courseHours > 0;
  }

  private ParametresCoursReponse toResponse(ParametresCours settings) {
    return new ParametresCoursReponse(
      settings.courseName,
      settings.courseDays,
      settings.courseHours,
      settings.eligibilityThreshold
    );
  }
}
