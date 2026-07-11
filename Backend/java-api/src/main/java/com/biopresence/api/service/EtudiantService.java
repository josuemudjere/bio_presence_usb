package com.biopresence.api.service;

import com.biopresence.api.dto.EtudiantRequete;
import com.biopresence.api.dto.EtudiantReponse;
import com.biopresence.api.entity.Cours;
import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.entity.Promotion;
import com.biopresence.api.entity.StatutEtudiant;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.persistence.EtudiantRepository;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Optional;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EtudiantService {
  private final EtudiantRepository studentRepository;
  private final PromotionService promotionService;
  private final CoursService coursService;
  private final InscriptionService inscriptionService;

  public EtudiantService(
    EtudiantRepository studentRepository,
    PromotionService promotionService,
    CoursService coursService,
    InscriptionService inscriptionService
  ) {
    this.studentRepository = studentRepository;
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

  public EtudiantReponse getById(UUID id) {
    return toResponse(findEntity(id));
  }

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
    // Les inscriptions sont synchronisées après la sauvegarde pour utiliser l'identité persistée de l'étudiant.
    syncInscriptions(student, request);
    return toResponse(student);
  }

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
    syncInscriptions(student, request);
    return toResponse(student);
  }

  public void delete(UUID id) {
    findEntity(id);
    studentRepository.deleteById(Objects.requireNonNull(id));
  }

  public Etudiant save(Etudiant student) {
    syncFingerprintStorage(student, resolveFingerprintIds(student));
    return Objects.requireNonNull(studentRepository.save(Objects.requireNonNull(student)));
  }

  public Optional<Etudiant> findByFingerprintTemplateId(String fingerprintTemplateId) {
    // La recherche gère les cas où plusieurs identifiants d'empreinte sont stockés dans la même fiche.
    String normalized = normalizeFingerprintId(fingerprintTemplateId);
    if (normalized == null) {
      return Optional.empty();
    }

    return studentRepository.findAll().stream()
      .filter(student -> resolveFingerprintIds(student).contains(normalized))
      .findFirst();
  }

  public Etudiant findEntity(UUID id) {
    // Cette recherche centralisée uniformise le message renvoyé quand l'étudiant n'existe pas.
    return studentRepository.findById(Objects.requireNonNull(id)).orElseThrow(() -> new ExceptionIntrouvable("Etudiant introuvable."));
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
    return normalized.isEmpty() ? null : normalized;
  }

  private List<String> parseFingerprintIds(List<String> fingerprintTemplateIds, String fingerprintTemplateId) {
    if (fingerprintTemplateIds != null && !fingerprintTemplateIds.isEmpty()) {
      return fingerprintTemplateIds.stream()
        .filter(value -> value != null && !value.isBlank())
        .map(value -> value.trim().toUpperCase())
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
      .map(value -> value.toUpperCase())
      .collect(Collectors.collectingAndThen(Collectors.toCollection(LinkedHashSet::new), List::copyOf));
  }

  private List<String> resolveFingerprintIds(Etudiant student) {
    // La nouvelle source de vérité est la collection normalisée, avec repli vers le CSV historique.
    if (student.fingerprintTemplateIds != null && !student.fingerprintTemplateIds.isEmpty()) {
      return student.fingerprintTemplateIds.stream()
        .filter(value -> value != null && !value.isBlank())
        .map(value -> value.trim().toUpperCase())
        .collect(Collectors.collectingAndThen(Collectors.toCollection(LinkedHashSet::new), List::copyOf));
    }

    return parseFingerprintIds(student.fingerprintTemplateId);
  }

  private void syncFingerprintStorage(Etudiant student, List<String> fingerprintIds) {
    // J'aligne la collection normalisée et la colonne historique pour garder une transition sans rupture.
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
    List<Long> promotionCourseIds = student.promotion == null
      ? List.of()
      : promotionService.resolveCours(student.promotion).stream().map(cours -> cours.id).toList();
    List<Long> creditCourseIds = assignedCourseIds.stream()
      .filter(courseId -> !promotionCourseIds.contains(courseId))
      .toList();
    List<String> fingerprintIds = resolveFingerprintIds(student);
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
      student.promotion == null ? null : student.promotion.id,
      assignedCourseIds,
      creditCourseIds,
      student.photoUrl,
      student.fingerprintRegistered,
      fingerprintIds,
      fingerprintIds.isEmpty() ? null : String.join(",", fingerprintIds),
      student.fingerprintCount,
      student.lastFingerprintScan,
      student.status.name()
    );
  }

  private void syncInscriptions(Etudiant student, EtudiantRequete request) {
    // Les inscriptions finales combinent les cours hérités de la promotion et les crédits ajoutés manuellement.
    Promotion promotion = student.promotion;
    List<Cours> promotionCourses = promotion == null ? List.of() : promotionService.resolveCours(promotion);
    List<Cours> creditCourses = request.creditCoursIds() == null
      ? List.of()
      : request.creditCoursIds().stream().map(coursService::findEntity).toList();
    inscriptionService.replaceStudentInscriptions(student, promotionCourses, creditCourses);
  }
}
