package com.biopresence.api.service;

import com.biopresence.api.dto.EtudiantRequete;
import com.biopresence.api.dto.EtudiantReponse;
import com.biopresence.api.entity.Cours;
import com.biopresence.api.entity.Doigt;
import com.biopresence.api.entity.EmpreinteDigitale;
import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.entity.Promotion;
import com.biopresence.api.entity.StatutEtudiant;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.persistence.EmpreinteDigitaleRepository;
import com.biopresence.api.persistence.EtudiantRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EtudiantService {
  private final EtudiantRepository studentRepository;
  private final EmpreinteDigitaleRepository fingerprintRepository;
  private final PromotionService promotionService;
  private final CoursService coursService;
  private final InscriptionService inscriptionService;

  public EtudiantService(
    EtudiantRepository studentRepository,
    EmpreinteDigitaleRepository fingerprintRepository,
    PromotionService promotionService,
    CoursService coursService,
    InscriptionService inscriptionService
  ) {
    this.studentRepository = studentRepository;
    this.fingerprintRepository = fingerprintRepository;
    this.promotionService = promotionService;
    this.coursService = coursService;
    this.inscriptionService = inscriptionService;
  }

  public List<EtudiantReponse> listAll() {
    // Le front consomme des DTO triés par nom pour garder une liste stable et lisible.
    return studentRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream().map(this::toResponse).toList();
  }

  public List<Etudiant> listEntities() {
    // Cette variante reste utile pour les services internes qui manipulent directement les entités.
    return studentRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
  }

  @Transactional(readOnly = true)
  public List<EtudiantReponse> listForCourse(Long coursId) {
    // La vue enseignant lit d'abord inscriptions, avec repli legacy sur coursId et promotion quand nécessaire.
    Set<UUID> studentIds = inscriptionService.getStudentIdsForCourse(coursId);
    return studentRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
      .filter(student -> studentIds.contains(student.id) || isLegacyLinkedToCourse(student, coursId))
      .map(this::toResponse)
      .toList();
  }

  public EtudiantReponse getById(UUID id) {
    return toResponse(findEntity(id));
  }

  @Transactional
  public EtudiantReponse create(EtudiantRequete request) {
    // Je vérifie d'abord les collisions métier avant de créer la fiche étudiant.
    String normalizedFingerprints = normalizeFingerprints(request.fingerprintTemplateIds(), request.fingerprintTemplateId());
    validateUniqueFields(request.matricule(), normalizedFingerprints, null);

    Etudiant student = new Etudiant(
      request.name().trim(),
      request.matricule().trim().toUpperCase(),
      request.department().trim(),
      request.level().trim(),
      request.coursId(),
      normalizePhotoUrl(request.photoUrl()),
      normalizedFingerprints
    );
    student.postNom = normalizeText(request.postNom());
    student.prenom = normalizeText(request.prenom());
    student.dateNaissance = request.dateNaissance();
    student.lieuNaissance = normalizeText(request.lieuNaissance());
    student.adresse = normalizeText(request.adresse());
    student.telephone = normalizeText(request.telephone());
    student.status = parseStatus(request.status());
    student.promotion = request.promotionId() == null ? null : promotionService.findEntity(request.promotionId());
    syncFingerprintStorage(student, parseFingerprintIds(normalizedFingerprints));
    if (request.fingerprintCount() != null) {
      student.fingerprintCount = request.fingerprintCount();
    }
    student.fingerprintRegistered = !student.fingerprintTemplateIds.isEmpty();
    if (request.fingerprintCount() == null) {
      student.fingerprintCount = student.fingerprintTemplateIds.size();
    }
    studentRepository.save(student);
    syncDigitalFingerprintStorage(student, resolveFingerprintIds(student));
    // Les inscriptions sont synchronisées après la sauvegarde pour utiliser l'identité persistée de l'étudiant.
    syncInscriptions(student, request);
    return toResponse(student);
  }

  @Transactional
  public EtudiantReponse update(UUID id, EtudiantRequete request) {
    // La mise à jour repart de l'entité existante pour ne pas perdre les informations déjà persistées.
    Etudiant student = findEntity(id);
    String normalizedFingerprints = normalizeFingerprints(request.fingerprintTemplateIds(), request.fingerprintTemplateId());
    validateUniqueFields(request.matricule(), normalizedFingerprints, id);

    student.name = request.name().trim();
    student.postNom = normalizeText(request.postNom());
    student.prenom = normalizeText(request.prenom());
    student.matricule = request.matricule().trim().toUpperCase();
    student.dateNaissance = request.dateNaissance();
    student.lieuNaissance = normalizeText(request.lieuNaissance());
    student.adresse = normalizeText(request.adresse());
    student.telephone = normalizeText(request.telephone());
    student.department = request.department().trim();
    student.level = request.level().trim();
    student.coursId = request.coursId();
    student.promotion = request.promotionId() == null ? null : promotionService.findEntity(request.promotionId());
    student.photoUrl = normalizePhotoUrl(request.photoUrl());
    syncFingerprintStorage(student, parseFingerprintIds(normalizedFingerprints));
    student.status = parseStatus(request.status());
    if (request.fingerprintCount() != null) {
      student.fingerprintCount = request.fingerprintCount();
    }
    student.fingerprintRegistered = !student.fingerprintTemplateIds.isEmpty();
    if (request.fingerprintCount() == null) {
      student.fingerprintCount = student.fingerprintTemplateIds.size();
    }
    studentRepository.save(student);
    syncDigitalFingerprintStorage(student, resolveFingerprintIds(student));
    syncInscriptions(student, request);
    return toResponse(student);
  }

  @Transactional
  public void delete(UUID id) {
    Etudiant student = findEntity(id);
    fingerprintRepository.deleteByEtudiantId(student.id);
    inscriptionService.replaceStudentInscriptions(student, List.of(), List.of());
    studentRepository.deleteById(Objects.requireNonNull(id));
  }

  @Transactional
  public Etudiant save(Etudiant student) {
    syncFingerprintStorage(student, resolveFingerprintIds(student));
    Etudiant savedStudent = Objects.requireNonNull(studentRepository.save(Objects.requireNonNull(student)));
    syncDigitalFingerprintStorage(savedStudent, resolveFingerprintIds(savedStudent));
    return savedStudent;
  }

  @Transactional(readOnly = true)
  public Optional<Etudiant> findByFingerprintTemplateId(String fingerprintTemplateId) {
    // La recherche gère les cas où plusieurs identifiants d'empreinte sont stockés dans la même fiche.
    String normalized = normalizeFingerprintId(fingerprintTemplateId);
    if (normalized == null) {
      return Optional.empty();
    }

    Optional<Etudiant> studentFromFingerprintTable = fingerprintRepository
      .findFirstByTemplateIdIgnoreCase(normalized)
      .map(fingerprint -> fingerprint.etudiant);

    if (studentFromFingerprintTable.isPresent()) {
      return studentFromFingerprintTable;
    }

    return studentRepository.findAll().stream()
      .filter(student -> resolveFingerprintIds(student).contains(normalized))
      .findFirst();
  }

  @Transactional(readOnly = true)
  public Optional<EmpreinteDigitale> findFingerprintByTemplateId(String fingerprintTemplateId) {
    String normalized = normalizeFingerprintId(fingerprintTemplateId);
    if (normalized == null) {
      return Optional.empty();
    }

    return fingerprintRepository.findFirstByTemplateIdIgnoreCase(normalized);
  }

  public Etudiant findEntity(UUID id) {
    // Cette recherche centralisée uniformise le message renvoyé quand l'étudiant n'existe pas.
    return studentRepository.findById(Objects.requireNonNull(id)).orElseThrow(() -> new ExceptionIntrouvable("Etudiant introuvable."));
  }

  @Transactional(readOnly = true)
  public boolean isLegacyLinkedToCourse(Etudiant student, Long coursId) {
    if (coursId == null) {
      return false;
    }

    if (student.coursId != null && student.coursId.equals(coursId)) {
      return true;
    }

    return resolvePromotionCourseIdsSafely(student).contains(coursId);
  }

  @Transactional
  public void backfillLegacyInscriptionsIfMissing(Etudiant student) {
    // Les anciens étudiants peuvent encore porter leur affectation sur promotion ou coursId sans ligne dans inscriptions.
    if (!inscriptionService.getCourseIdsForStudent(student.id).isEmpty()) {
      return;
    }

    List<Cours> promotionCourses = student.promotion == null ? List.of() : promotionService.resolveCours(student.promotion);
    List<Cours> legacyCourses = student.coursId == null ? List.of() : List.of(coursService.findEntity(student.coursId));
    if (promotionCourses.isEmpty() && legacyCourses.isEmpty()) {
      return;
    }

    inscriptionService.replaceStudentInscriptions(student, promotionCourses, legacyCourses);
  }

  @Transactional
  public int resyncAllInscriptions() {
    List<Etudiant> students = studentRepository.findAll();
    students.forEach(this::resyncCourseLinks);
    return students.size();
  }

  @Transactional
  public void resyncCourseLinks(Etudiant student) {
    List<Long> promotionCourseIds = resolvePromotionCourseIdsSafely(student);
    LinkedHashSet<Long> assignedCourseIds = new LinkedHashSet<>(inscriptionService.getCourseIdsForStudent(student.id));

    if (assignedCourseIds.isEmpty()) {
      assignedCourseIds.addAll(resolveLegacyAssignedCourseIds(student));
    }

    List<Cours> baseCourses = new java.util.ArrayList<>(promotionCourseIds.stream().map(coursService::findEntity).toList());
    if (student.coursId != null && promotionCourseIds.stream().noneMatch(courseId -> courseId.equals(student.coursId))) {
      baseCourses.add(coursService.findEntity(student.coursId));
    }

    List<Cours> creditCourses = assignedCourseIds.stream()
      .filter(courseId -> !promotionCourseIds.contains(courseId))
      .filter(courseId -> student.coursId == null || !student.coursId.equals(courseId))
      .map(coursService::findEntity)
      .toList();

    inscriptionService.replaceStudentInscriptions(student, baseCourses, creditCourses);
  }

  private void validateUniqueFields(String matricule, String fingerprintTemplateId, UUID currentId) {
    // Le matricule et les empreintes doivent rester uniques à l'échelle du registre.
    String normalizedMatricule = matricule == null ? null : matricule.trim().toUpperCase();
    if (normalizedMatricule != null) {
      studentRepository.findByMatriculeIgnoreCase(normalizedMatricule).ifPresent(existing -> {
        if (currentId == null || !existing.id.equals(currentId)) {
          throw new IllegalArgumentException("Ce matricule existe deja.");
        }
      });
    }

    List<String> normalizedFingerprints = parseFingerprintIds(fingerprintTemplateId);
    if (!normalizedFingerprints.isEmpty()) {
      normalizedFingerprints.forEach(fingerprintId -> fingerprintRepository.findFirstByTemplateIdIgnoreCase(fingerprintId).ifPresent(existing -> {
        if (currentId == null || existing.etudiant == null || !existing.etudiant.id.equals(currentId)) {
          throw new IllegalArgumentException("Cet identifiant d'empreinte existe deja.");
        }
      }));

      studentRepository.findAll().forEach(existing -> {
        if (currentId != null && existing.id.equals(currentId)) {
          return;
        }

        List<String> existingFingerprints = resolveFingerprintIds(existing);
        boolean duplicateExists = normalizedFingerprints.stream().anyMatch(existingFingerprints::contains);
        if (duplicateExists) {
          throw new IllegalArgumentException("Cet identifiant d'empreinte existe deja.");
        }
      });
    }
  }

  private String normalizeFingerprints(List<String> fingerprintTemplateIds, String fingerprintTemplateId) {
    // Le contrat moderne passe une liste, mais je garde aussi la chaîne CSV pour compatibilité.
    List<String> fingerprintIds = parseFingerprintIds(fingerprintTemplateIds, fingerprintTemplateId);
    return fingerprintIds.isEmpty() ? null : String.join(",", fingerprintIds);
  }

  private String normalizeFingerprintId(String fingerprintTemplateId) {
    if (fingerprintTemplateId == null) {
      return null;
    }

    String normalized = fingerprintTemplateId.trim().toUpperCase();
    if (normalized.isEmpty()) {
      return null;
    }

    if (normalized.matches("\\d{1,4}")) {
      return String.format("%04d", Integer.parseInt(normalized));
    }

    if (normalized.matches("FP-ETU-\\d{1,4}")) {
      String suffix = normalized.substring(normalized.lastIndexOf('-') + 1);
      return String.format("%04d", Integer.parseInt(suffix));
    }

    return normalized;
  }

  private List<String> parseFingerprintIds(List<String> fingerprintTemplateIds, String fingerprintTemplateId) {
    if (fingerprintTemplateIds != null && !fingerprintTemplateIds.isEmpty()) {
      return fingerprintTemplateIds.stream()
        .filter(value -> value != null && !value.isBlank())
        .map(this::normalizeFingerprintId)
        .filter(Objects::nonNull)
        .collect(Collectors.collectingAndThen(Collectors.toCollection(LinkedHashSet::new), List::copyOf));
    }

    return parseFingerprintIds(fingerprintTemplateId);
  }

  private List<String> parseFingerprintIds(String fingerprintTemplateId) {
    // Je normalise et déduplique les identifiants pour éviter les doublons liés à la casse ou aux espaces.
    if (fingerprintTemplateId == null || fingerprintTemplateId.isBlank()) {
      return List.of();
    }

    return Arrays.stream(fingerprintTemplateId.split(","))
      .map(value -> value.trim())
      .filter(value -> !value.isEmpty())
      .map(this::normalizeFingerprintId)
      .filter(Objects::nonNull)
      .collect(Collectors.collectingAndThen(Collectors.toCollection(LinkedHashSet::new), List::copyOf));
  }

  private List<String> resolveFingerprintIds(Etudiant student) {
    // La nouvelle source de vérité est la table empreintes_digitales, avec repli vers l'état legacy si nécessaire.
    List<String> fingerprintIdsFromRepository = fingerprintRepository.findByEtudiantIdOrderByDateEnrolementAsc(student.id).stream()
      .map(fingerprint -> normalizeFingerprintId(fingerprint.templateId))
      .filter(Objects::nonNull)
      .collect(Collectors.collectingAndThen(Collectors.toCollection(LinkedHashSet::new), List::copyOf));

    if (!fingerprintIdsFromRepository.isEmpty()) {
      student.fingerprintTemplateIds.clear();
      student.fingerprintTemplateIds.addAll(fingerprintIdsFromRepository);
      return fingerprintIdsFromRepository;
    }

    if (student.fingerprintTemplateIds != null && !student.fingerprintTemplateIds.isEmpty()) {
      return student.fingerprintTemplateIds.stream()
        .filter(value -> value != null && !value.isBlank())
        .map(this::normalizeFingerprintId)
        .filter(Objects::nonNull)
        .collect(Collectors.collectingAndThen(Collectors.toCollection(LinkedHashSet::new), List::copyOf));
    }

    return parseFingerprintIds(student.fingerprintTemplateId);
  }

  private void syncFingerprintStorage(Etudiant student, List<String> fingerprintIds) {
    // La colonne CSV reste un miroir de compatibilité pendant la transition, sans redevenir la source de vérité.
    student.fingerprintTemplateIds.clear();
    student.fingerprintTemplateIds.addAll(fingerprintIds);
    student.fingerprintTemplateId = fingerprintIds.isEmpty() ? null : String.join(",", fingerprintIds);
    student.fingerprintRegistered = !fingerprintIds.isEmpty();
    if (!student.fingerprintRegistered) {
      student.fingerprintCount = 0;
    } else if (student.fingerprintCount <= 0) {
      student.fingerprintCount = fingerprintIds.size();
    }
  }

  private void syncDigitalFingerprintStorage(Etudiant student, List<String> fingerprintIds) {
    List<EmpreinteDigitale> existingFingerprints = fingerprintRepository.findByEtudiantIdOrderByDateEnrolementAsc(student.id);
    Map<String, EmpreinteDigitale> existingByTemplateId = existingFingerprints.stream()
      .filter(fingerprint -> fingerprint.templateId != null && !fingerprint.templateId.isBlank())
      .collect(Collectors.toMap(
        fingerprint -> fingerprint.templateId.toUpperCase(),
        fingerprint -> fingerprint,
        (left, right) -> left,
        java.util.LinkedHashMap::new
      ));

    List<EmpreinteDigitale> fingerprintsToDelete = existingFingerprints.stream()
      .filter(fingerprint -> fingerprint.templateId == null || !fingerprintIds.contains(fingerprint.templateId.toUpperCase()))
      .toList();
    if (!fingerprintsToDelete.isEmpty()) {
      fingerprintRepository.deleteAll(fingerprintsToDelete);
    }

    for (int index = 0; index < fingerprintIds.size(); index += 1) {
      String fingerprintId = fingerprintIds.get(index);
      EmpreinteDigitale fingerprint = existingByTemplateId.get(fingerprintId);
      if (fingerprint == null) {
        fingerprint = new EmpreinteDigitale();
        fingerprint.etudiant = student;
      }

      fingerprint.templateId = fingerprintId;
      fingerprint.template = fingerprintId.getBytes(StandardCharsets.UTF_8);
      fingerprint.qualite = 100;
      fingerprint.doigt = resolveFinger(index);
      fingerprintRepository.save(fingerprint);
    }
  }

  private Doigt resolveFinger(int index) {
    Doigt[] fingers = Doigt.values();
    return fingers[Math.max(0, Math.min(index, fingers.length - 1))];
  }

  private String normalizePhotoUrl(String photoUrl) {
    if (photoUrl == null) {
      return null;
    }

    String normalized = photoUrl.trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private String normalizeText(String value) {
    if (value == null) {
      return null;
    }

    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private StatutEtudiant parseStatus(String rawStatus) {
    // Sans statut explicite, un étudiant est considéré actif par défaut.
    if (rawStatus == null || rawStatus.isBlank()) {
      return StatutEtudiant.ACTIF;
    }

    return StatutEtudiant.valueOf(rawStatus.trim().toUpperCase());
  }

  private EtudiantReponse toResponse(Etudiant student) {
    // Je reconstruis la vue client en séparant les cours de promotion des cours de crédit additionnels.
    List<Long> assignedCourseIds = inscriptionService.getCourseIdsForStudent(student.id);
    if (assignedCourseIds.isEmpty()) {
      assignedCourseIds = resolveLegacyAssignedCourseIds(student);
    }
    List<Long> promotionCourseIds = resolvePromotionCourseIdsSafely(student);
    List<Long> creditCourseIds = assignedCourseIds.stream()
      .filter(courseId -> !promotionCourseIds.contains(courseId))
      .toList();
    List<String> fingerprintIds = resolveFingerprintIds(student);
    String status = student.status == null ? StatutEtudiant.ACTIF.name() : student.status.name();
    return new EtudiantReponse(
      student.id,
      student.name,
      student.postNom,
      student.prenom,
      student.matricule,
      student.dateNaissance,
      student.lieuNaissance,
      student.adresse,
      student.telephone,
      student.department,
      student.level,
      student.coursId,
      resolvePromotionIdSafely(student),
      assignedCourseIds,
      creditCourseIds,
      student.photoUrl,
      student.fingerprintRegistered,
      fingerprintIds,
      fingerprintIds.isEmpty() ? null : String.join(",", fingerprintIds),
      student.fingerprintCount,
      student.lastFingerprintScan,
      status
    );
  }

  private Long resolvePromotionIdSafely(Etudiant student) {
    if (student.promotion == null) {
      return null;
    }

    try {
      return student.promotion.id;
    } catch (RuntimeException ignored) {
      return null;
    }
  }

  private List<Long> resolvePromotionCourseIdsSafely(Etudiant student) {
    if (student.promotion == null) {
      return List.of();
    }

    try {
      return promotionService.resolveCours(student.promotion).stream().map(cours -> cours.id).toList();
    } catch (RuntimeException ignored) {
      // Une promotion legacy mal synchronisée ne doit pas empêcher de charger la liste globale des étudiants.
      return List.of();
    }
  }

  private List<Long> resolveLegacyAssignedCourseIds(Etudiant student) {
    LinkedHashSet<Long> courseIds = new LinkedHashSet<>();
    if (student.coursId != null) {
      courseIds.add(student.coursId);
    }
    courseIds.addAll(resolvePromotionCourseIdsSafely(student));
    return List.copyOf(courseIds);
  }

  private void syncInscriptions(Etudiant student, EtudiantRequete request) {
    // Les inscriptions finales combinent les cours hérités de la promotion et les crédits ajoutés manuellement.
    Promotion promotion = student.promotion;
    LinkedHashSet<Long> assignedCourseIds = new LinkedHashSet<>();
    if (request.creditCoursIds() != null) {
      assignedCourseIds.addAll(request.creditCoursIds());
    }
    if (request.coursId() != null) {
      assignedCourseIds.add(request.coursId());
    }

    List<Cours> promotionCourses = promotion == null ? List.of() : promotionService.resolveCours(promotion);
    List<Long> promotionCourseIds = promotionCourses.stream().map(cours -> cours.id).toList();
    List<Cours> baseCourses = new java.util.ArrayList<>(promotionCourses);
    if (request.coursId() != null && promotionCourseIds.stream().noneMatch(courseId -> courseId.equals(request.coursId()))) {
      baseCourses.add(coursService.findEntity(request.coursId()));
    }

    List<Cours> creditCourses = assignedCourseIds.stream()
      .filter(courseId -> !promotionCourseIds.contains(courseId))
      .filter(courseId -> request.coursId() == null || !request.coursId().equals(courseId))
      .map(coursService::findEntity)
      .toList();

    inscriptionService.replaceStudentInscriptions(student, baseCourses, creditCourses);
  }
}
