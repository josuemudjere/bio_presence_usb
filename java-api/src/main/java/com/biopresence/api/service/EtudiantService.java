package com.biopresence.api.service;

import com.biopresence.api.dto.EtudiantRequete;
import com.biopresence.api.dto.EtudiantReponse;
import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.entity.StatutEtudiant;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.repository.EtudiantRepository;
import org.springframework.data.domain.Sort;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class EtudiantService {
  private final EtudiantRepository studentRepository;

  public EtudiantService(EtudiantRepository studentRepository) {
    this.studentRepository = studentRepository;
  }

  public List<EtudiantReponse> listAll() {
    return studentRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream().map(this::toResponse).toList();
  }

  public List<Etudiant> listEntities() {
    return studentRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
  }

  public EtudiantReponse getById(@NonNull UUID id) {
    return toResponse(findEntity(id));
  }

  public EtudiantReponse create(EtudiantRequete request) {
    validateUniqueFields(request.matricule(), request.fingerprintTemplateId(), null);

    Etudiant student = new Etudiant(
      request.name().trim(),
      request.matricule().trim().toUpperCase(),
      request.department().trim(),
      request.level().trim(),
      normalizePhotoUrl(request.photoUrl()),
      normalizeFingerprint(request.fingerprintTemplateId())
    );
    if (request.fingerprintCount() != null) {
      student.fingerprintCount = request.fingerprintCount();
    }
    studentRepository.save(student);
    return toResponse(student);
  }

  public EtudiantReponse update(@NonNull UUID id, EtudiantRequete request) {
    Etudiant student = findEntity(id);
    validateUniqueFields(request.matricule(), request.fingerprintTemplateId(), id);

    student.name = request.name().trim();
    student.matricule = request.matricule().trim().toUpperCase();
    student.department = request.department().trim();
    student.level = request.level().trim();
    student.photoUrl = normalizePhotoUrl(request.photoUrl());
    student.fingerprintTemplateId = normalizeFingerprint(request.fingerprintTemplateId());
    student.fingerprintRegistered = student.fingerprintTemplateId != null;
    student.status = student.fingerprintRegistered ? StatutEtudiant.READY : StatutEtudiant.PENDING;
    if (request.fingerprintCount() != null) {
      student.fingerprintCount = request.fingerprintCount();
    } else if (student.fingerprintRegistered && student.fingerprintCount == 0) {
      student.fingerprintCount = 1;
    }
    studentRepository.save(student);
    return toResponse(student);
  }

  public void delete(@NonNull UUID id) {
    findEntity(id);
    studentRepository.deleteById(id);
  }

  public Etudiant save(@NonNull Etudiant student) {
    return studentRepository.save(student);
  }

  public Optional<Etudiant> findByFingerprintTemplateId(String fingerprintTemplateId) {
    String normalized = normalizeFingerprint(fingerprintTemplateId);
    if (normalized == null) {
      return Optional.empty();
    }

    return studentRepository.findByFingerprintTemplateIdIgnoreCase(normalized);
  }

  public Etudiant findEntity(@NonNull UUID id) {
    return studentRepository.findById(id).orElseThrow(() -> new ExceptionIntrouvable("Etudiant introuvable."));
  }

  private void validateUniqueFields(String matricule, String fingerprintTemplateId, UUID currentId) {
    String normalizedMatricule = matricule == null ? null : matricule.trim().toUpperCase();
    if (normalizedMatricule != null) {
      studentRepository.findByMatriculeIgnoreCase(normalizedMatricule).ifPresent(existing -> {
        if (currentId == null || !existing.id.equals(currentId)) {
          throw new IllegalArgumentException("Ce matricule existe deja.");
        }
      });
    }

    String normalizedFingerprint = normalizeFingerprint(fingerprintTemplateId);
    if (normalizedFingerprint != null) {
      studentRepository.findByFingerprintTemplateIdIgnoreCase(normalizedFingerprint).ifPresent(existing -> {
        if (currentId == null || !existing.id.equals(currentId)) {
          throw new IllegalArgumentException("Cet identifiant d'empreinte existe deja.");
        }
      });
    }
  }

  private String normalizeFingerprint(String fingerprintTemplateId) {
    if (fingerprintTemplateId == null) {
      return null;
    }

    String normalized = fingerprintTemplateId.trim();
    return normalized.isEmpty() ? null : normalized.toUpperCase();
  }

  private String normalizePhotoUrl(String photoUrl) {
    if (photoUrl == null) {
      return null;
    }

    String normalized = photoUrl.trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private EtudiantReponse toResponse(Etudiant student) {
    return new EtudiantReponse(
      student.id,
      student.name,
      student.matricule,
      student.department,
      student.level,
      student.photoUrl,
      student.fingerprintRegistered,
      student.fingerprintTemplateId,
      student.fingerprintCount,
      student.lastFingerprintScan,
      student.status.name()
    );
  }
}
