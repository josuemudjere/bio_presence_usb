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
    validateUniqueFields(request.matricule(), request.fingerprintTemplateId(), null);

    Etudiant student = new Etudiant(
      request.name().trim(),
      request.matricule().trim().toUpperCase(),
      request.department().trim(),
      request.level().trim(),
      request.coursId(),
      normalizePhotoUrl(request.photoUrl()),
      normalizeFingerprint(request.fingerprintTemplateId())
    );
    student.postNom = normalizeText(request.postNom());
    student.prenom = normalizeText(request.prenom());
    student.dateNaissance = request.dateNaissance();
    student.lieuNaissance = normalizeText(request.lieuNaissance());
    student.adresse = normalizeText(request.adresse());
    student.telephone = normalizeText(request.telephone());
    student.status = parseStatus(request.status());
    student.promotion = request.promotionId() == null ? null : promotionService.findEntity(request.promotionId());
    if (request.fingerprintCount() != null) {
      student.fingerprintCount = request.fingerprintCount();
    }
    studentRepository.save(student);
    // Les inscriptions sont synchronisées après la sauvegarde pour utiliser l'identité persistée de l'étudiant.
    syncInscriptions(student, request);
    return toResponse(student);
  }

  public EtudiantReponse update(UUID id, EtudiantRequete request) {
    // La mise à jour repart de l'entité existante pour ne pas perdre les informations déjà persistées.
    Etudiant student = findEntity(id);
    validateUniqueFields(request.matricule(), request.fingerprintTemplateId(), id);

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
    student.fingerprintTemplateId = normalizeFingerprint(request.fingerprintTemplateId());
    student.fingerprintRegistered = student.fingerprintTemplateId != null;
    student.status = parseStatus(request.status());
    if (request.fingerprintCount() != null) {
      student.fingerprintCount = request.fingerprintCount();
    } else if (student.fingerprintRegistered && student.fingerprintCount == 0) {
      student.fingerprintCount = 1;
    }
    studentRepository.save(student);
    syncInscriptions(student, request);
    return toResponse(student);
  }

  public void delete(UUID id) {
    findEntity(id);
    studentRepository.deleteById(id);
  }

  public Etudiant save(Etudiant student) {
    return studentRepository.save(student);
  }

  public Optional<Etudiant> findByFingerprintTemplateId(String fingerprintTemplateId) {
    // La recherche gère les cas où plusieurs identifiants d'empreinte sont stockés dans la même fiche.
    String normalized = normalizeFingerprint(fingerprintTemplateId);
    if (normalized == null) {
      return Optional.empty();
    }

    return studentRepository.findAll().stream()
      .filter(student -> parseFingerprintIds(student.fingerprintTemplateId).contains(normalized))
      .findFirst();
  }

  public Etudiant findEntity(UUID id) {
    // Cette recherche centralisée uniformise le message renvoyé quand l'étudiant n'existe pas.
    return studentRepository.findById(id).orElseThrow(() -> new ExceptionIntrouvable("Etudiant introuvable."));
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

        List<String> existingFingerprints = parseFingerprintIds(existing.fingerprintTemplateId);
        boolean duplicateExists = normalizedFingerprints.stream().anyMatch(existingFingerprints::contains);
        if (duplicateExists) {
          throw new IllegalArgumentException("Cet identifiant d'empreinte existe deja.");
        }
      });
    }
  }

  private String normalizeFingerprint(String fingerprintTemplateId) {
    // J'aplatis ici la liste d'empreintes dans le format texte attendu par l'entité actuelle.
    if (fingerprintTemplateId == null) {
      return null;
    }

    List<String> fingerprintIds = parseFingerprintIds(fingerprintTemplateId);
    return fingerprintIds.isEmpty() ? null : String.join(",", fingerprintIds);
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
      student.fingerprintTemplateId,
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
