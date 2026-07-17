package com.biopresence.api.service;

import com.biopresence.api.Repositories.EtudiantRepository;
import com.biopresence.api.Repositories.PromotionRepository;
import com.biopresence.api.dto.PromotionReponse;
import com.biopresence.api.dto.PromotionRequete;
import com.biopresence.api.entity.Cours;
import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.entity.Promotion;
import com.biopresence.api.exception.ExceptionIntrouvable;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

@Service
public class PromotionService {

  private final PromotionRepository promotionRepository;
  private final EtudiantRepository studentRepository;
  private final CoursService coursService;
  private final InscriptionService inscriptionService;

  public PromotionService(
    PromotionRepository promotionRepository,
    EtudiantRepository studentRepository,
    CoursService coursService,
    InscriptionService inscriptionService
  ) {
    this.promotionRepository = promotionRepository;
    this.studentRepository = studentRepository;
    this.coursService = coursService;
    this.inscriptionService = inscriptionService;
  }

  public List<PromotionReponse> listAll() {
    return promotionRepository.findAll().stream()
      .sorted(Comparator.comparing((Promotion promotion) -> promotion.nom, String.CASE_INSENSITIVE_ORDER))
      .map(this::toResponse)
      .toList();
  }

  public PromotionReponse getById(Long id) {
    return toResponse(findEntity(id));
  }

  public Promotion findEntity(Long id) {
    return promotionRepository.findById(id)
      .orElseThrow(() -> new ExceptionIntrouvable("Promotion introuvable."));
  }

  @Transactional
  public PromotionReponse create(PromotionRequete request) {
    Promotion promotion = new Promotion();
    applyFields(promotion, request);
    promotionRepository.save(promotion);
    return toResponse(promotion);
  }

  @Transactional
  public PromotionReponse update(Long id, PromotionRequete request) {
    Promotion promotion = findEntity(id);
    List<Long> previousPromotionCourseIds = parseCoursIds(promotion.coursIds);
    applyFields(promotion, request);
    promotionRepository.save(promotion);
    syncStudentsForPromotion(promotion, previousPromotionCourseIds);
    return toResponse(promotion);
  }

  @Transactional
  public void delete(Long id) {
    Promotion promotion = findEntity(id);
    List<Long> promotionCourseIds = parseCoursIds(promotion.coursIds);

    for (Etudiant student : studentRepository.findByPromotionId(id)) {
      List<Cours> creditCourses = resolveCreditCoursesForStudent(student, promotionCourseIds);
      student.promotion = null;
      studentRepository.save(student);
      inscriptionService.replaceStudentInscriptions(student, List.of(), creditCourses);
    }

    promotionRepository.delete(promotion);
  }

  public List<Cours> resolveCours(Promotion promotion) {
    return parseCoursIds(promotion.coursIds).stream().map(coursService::findEntity).toList();
  }

  private void syncStudentsForPromotion(Promotion promotion, List<Long> previousPromotionCourseIds) {
    for (Etudiant student : studentRepository.findByPromotionId(promotion.id)) {
      List<Cours> promotionCourses = resolveCours(promotion);
      List<Cours> creditCourses = resolveCreditCoursesForStudent(student, previousPromotionCourseIds);
      inscriptionService.replaceStudentInscriptions(student, promotionCourses, creditCourses);
    }
  }

  private List<Cours> resolveCreditCoursesForStudent(Etudiant student, List<Long> previousPromotionCourseIds) {
    LinkedHashSet<Long> assignedCourseIds = new LinkedHashSet<>(inscriptionService.getCourseIdsForStudent(student.id));

    if (assignedCourseIds.isEmpty()) {
      if (student.coursId != null) {
        assignedCourseIds.add(student.coursId);
      }
      assignedCourseIds.addAll(previousPromotionCourseIds);
    }

    return assignedCourseIds.stream()
      .filter(courseId -> !previousPromotionCourseIds.contains(courseId))
      .map(coursService::findEntity)
      .toList();
  }

  private void applyFields(Promotion promotion, PromotionRequete request) {
    String niveau = request.niveau().trim();
    promotion.nom = niveau;
    promotion.niveau = niveau;
    promotion.description = normalizeNullable(request.description());
    promotion.departement = request.departement().trim();
    promotion.programme = request.programme().trim();
    promotion.coursIds = normalizeCoursIds(request.coursIds());
  }

  private PromotionReponse toResponse(Promotion promotion) {
    List<Long> coursIds = parseCoursIds(promotion.coursIds);
    return new PromotionReponse(
      promotion.id,
      promotion.nom,
      promotion.niveau,
      promotion.description,
      promotion.departement,
      promotion.programme,
      coursIds
    );
  }

  private String normalizeCoursIds(List<Long> coursIds) {
    List<Long> normalizedIds = coursIds == null ? List.of() : coursIds.stream()
      .filter(Objects::nonNull)
      .distinct()
      .map(coursService::findEntity)
      .map(cours -> cours.id)
      .toList();

    if (normalizedIds.isEmpty()) {
      throw new IllegalArgumentException("Sélectionnez au moins un cours pour la promotion.");
    }

    return normalizedIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
  }

  private List<Long> parseCoursIds(String rawCoursIds) {
    if (rawCoursIds == null || rawCoursIds.isBlank()) {
      return List.of();
    }

    return Arrays.stream(rawCoursIds.split(","))
      .map(String::trim)
      .filter(value -> !value.isEmpty())
      .map(Long::valueOf)
      .collect(java.util.stream.Collectors.collectingAndThen(java.util.stream.Collectors.toCollection(LinkedHashSet::new), List::copyOf));
  }

  private String normalizeNullable(String value) {
    if (value == null) {
      return null;
    }

    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }
}