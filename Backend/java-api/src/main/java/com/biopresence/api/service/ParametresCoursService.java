package com.biopresence.api.service;

import com.biopresence.api.dto.ParametresCoursRequete;
import com.biopresence.api.Repositories.ParametresCoursRepository;
import com.biopresence.api.dto.ParametresCoursReponse;
import com.biopresence.api.entity.Cours;
import com.biopresence.api.entity.ParametresCours;

import org.springframework.stereotype.Service;

@Service
public class ParametresCoursService {
  private final ParametresCoursRepository courseSettingsRepository;
  private final CoursService coursService;

  public ParametresCoursService(ParametresCoursRepository courseSettingsRepository, CoursService coursService) {
    this.courseSettingsRepository = courseSettingsRepository;
    this.coursService = coursService;
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
    settings.coursId = request.coursId();
    settings.courseName = request.courseName().trim();
    settings.courseDays = request.courseDays();
    settings.courseHours = request.courseHours();
    settings.eligibilityThreshold = request.eligibilityThreshold();
    settings.startTime = normalizeNullable(request.startTime());
    settings.endTime = normalizeNullable(request.endTime());
    courseSettingsRepository.save(settings);
    return toResponse(settings);
  }

  public boolean isConfigured() {
    ParametresCoursReponse settings = toResponse(getCurrentEntity());
    return settings.courseName() != null && !settings.courseName().isBlank() && settings.courseDays() > 0 && settings.courseHours() > 0;
  }

  private ParametresCoursReponse toResponse(ParametresCours settings) {
    Cours linkedCourse = resolveLinkedCourse(settings.coursId);
    return new ParametresCoursReponse(
      linkedCourse == null ? settings.coursId : linkedCourse.id,
      linkedCourse == null ? settings.courseName : linkedCourse.nom,
      linkedCourse == null ? settings.courseDays : linkedCourse.nbJours,
      linkedCourse == null ? settings.courseHours : linkedCourse.nbHeures,
      linkedCourse == null ? settings.eligibilityThreshold : linkedCourse.seuilEligibilite,
      linkedCourse == null ? normalizeNullable(settings.startTime) : normalizeNullable(linkedCourse.heureDebut),
      linkedCourse == null ? normalizeNullable(settings.endTime) : normalizeNullable(linkedCourse.heureFin)
    );
  }

  private Cours resolveLinkedCourse(Long coursId) {
    if (coursId == null) {
      return null;
    }

    try {
      return coursService.findEntity(coursId);
    } catch (RuntimeException ignored) {
      return null;
    }
  }

  private String normalizeNullable(String value) {
    if (value == null) {
      return null;
    }

    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }
}
