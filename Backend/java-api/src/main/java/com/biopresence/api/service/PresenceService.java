package com.biopresence.api.service;

import com.biopresence.api.dto.PresenceReponse;
import com.biopresence.api.dto.PresenceManuelleRequete;
import com.biopresence.api.dto.PresenceScanRequete;
import com.biopresence.api.dto.LigneEligibiliteReponse;
import com.biopresence.api.dto.ScanReponse;
import com.biopresence.api.entity.ModeSaisie;
import com.biopresence.api.entity.Presence;
import com.biopresence.api.entity.StatutPresence;
import com.biopresence.api.entity.ParametresCours;
import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.persistence.PresenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Transactional
public class PresenceService {
  private final PresenceRepository attendanceRecordRepository;
  private final EtudiantService studentService;
  private final ParametresCoursService courseSettingsService;
  private final InscriptionService inscriptionService;

  public PresenceService(
    PresenceRepository attendanceRecordRepository,
    EtudiantService studentService,
    ParametresCoursService courseSettingsService,
    InscriptionService inscriptionService
  ) {
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.studentService = studentService;
    this.courseSettingsService = courseSettingsService;
    this.inscriptionService = inscriptionService;
  }

  public ScanReponse scan(PresenceScanRequete request) {
    // Le scan biométrique ouvre ou clôture la présence du jour selon l'état déjà enregistré.
    if (!courseSettingsService.isConfigured()) {
      throw new IllegalStateException("Configurez d'abord le cours avant le pointage.");
    }

    String fingerprintTemplateId = normalizeFingerprint(request.fingerprintTemplateId());
    Etudiant student = studentService.findByFingerprintTemplateId(fingerprintTemplateId)
      .orElseThrow(() -> new ExceptionIntrouvable("Aucun etudiant ne correspond a cet identifiant d'empreinte."));
    validateCourseAccess(student, request.coursId());

    LocalDate today = LocalDate.now();
    LocalTime now = LocalTime.now().withSecond(0).withNano(0);

    var openRecord = attendanceRecordRepository
      .findFirstByStudentIdAndRecordDateAndCheckOutIsNullOrderByCheckInAsc(student.id, today);

    if (openRecord.isPresent()) {
      // Une présence ouverte devient ici une sortie du même jour.
      Presence record = openRecord.get();
      record.checkOut = now;
      record.status = StatutPresence.PRESENT;
      attendanceRecordRepository.save(record);
      student.lastFingerprintScan = LocalDateTime.now().toString();
      studentService.save(student);
      return new ScanReponse("Sortie enregistree", toResponse(record));
    }

    List<Presence> dailyRecords = attendanceRecordRepository.findByStudentIdAndRecordDateOrderByCheckInAsc(student.id, today);
    boolean alreadyClosed = dailyRecords.stream().anyMatch(record -> record.checkOut != null);
    if (alreadyClosed) {
      throw new IllegalStateException("Cet etudiant a deja effectue une entree et une sortie pour cette date.");
    }

    // Si rien n'est ouvert et qu'aucun cycle complet n'existe, on crée l'entrée du jour.
    Presence record = new Presence(student.id, formatStudentName(student), student.matricule, student.department, today, now);
    record.modeSaisie = ModeSaisie.EMPREINTE;
    attendanceRecordRepository.save(record);
    student.lastFingerprintScan = LocalDateTime.now().toString();
    studentService.save(student);
    return new ScanReponse("Entree enregistree", toResponse(record));
  }

  public PresenceReponse createManualAttendance(PresenceManuelleRequete request) {
    // La saisie manuelle suit les mêmes règles d'accès au cours que le scan biométrique.
    Etudiant student = studentService.findEntity(Objects.requireNonNull(request.studentId(), "studentId"));
    validateCourseAccess(student, request.coursId());

    LocalDate date = request.date() == null || request.date().isBlank()
      ? LocalDate.now()
      : LocalDate.parse(request.date());
    LocalTime checkIn = request.checkIn() == null || request.checkIn().isBlank()
      ? LocalTime.now().withSecond(0).withNano(0)
      : LocalTime.parse(request.checkIn());
    LocalTime checkOut = request.checkOut() == null || request.checkOut().isBlank()
      ? null
      : LocalTime.parse(request.checkOut());

    Presence record = new Presence(student.id, formatStudentName(student), student.matricule, student.department, date, checkIn);
    record.modeSaisie = ModeSaisie.MANUELLE;
    if (checkOut != null) {
      if (checkOut.isBefore(checkIn)) {
        throw new IllegalArgumentException("L'heure de sortie doit être postérieure à l'heure d'entrée.");
      }
      record.checkOut = checkOut;
      record.status = StatutPresence.PRESENT;
    }

    attendanceRecordRepository.save(record);
    student.lastFingerprintScan = LocalDateTime.now().toString();
    studentService.save(student);
    return toResponse(record);
  }

  public List<PresenceReponse> listForDate(LocalDate date) {
    // Retourne le registre complet d'une date donnée dans l'ordre chronologique.
    return attendanceRecordRepository.findByRecordDateOrderByCheckInAsc(date).stream().map(this::toResponse).toList();
  }

  public List<PresenceReponse> listForCourseAndDate(Long coursId, LocalDate date) {
    Set<UUID> studentIds = getStudentIdsForCourse(coursId);
    return attendanceRecordRepository.findByRecordDateOrderByCheckInAsc(date).stream()
      .filter(record -> studentIds.contains(record.studentId))
      .map(this::toResponse)
      .toList();
  }

  public List<PresenceReponse> listForCourseBetween(Long coursId, LocalDate startDate, LocalDate endDate) {
    Set<UUID> studentIds = getStudentIdsForCourse(coursId);
    return attendanceRecordRepository.findByRecordDateBetweenOrderByRecordDateAscCheckInAsc(startDate, endDate).stream()
      .filter(record -> studentIds.contains(record.studentId))
      .map(this::toResponse)
      .toList();
  }

  public void resetAllAttendances() {
    // Utilisé surtout pour repartir d'un état vierge en démonstration ou test fonctionnel.
    attendanceRecordRepository.deleteAllInBatch();
  }

  public List<LigneEligibiliteReponse> buildEligibilityReport(Long coursId) {
    // L'éligibilité est calculée à partir du nombre de jours distincts pointés pour chaque étudiant.
    ParametresCours settings = courseSettingsService.getCurrentEntity();
    if (settings.courseName == null || settings.courseName.isBlank() || settings.courseDays <= 0 || settings.courseHours <= 0) {
      throw new IllegalStateException("Configurez d'abord le cours avant de generer le rapport d'eligibilite.");
    }

    Map<UUID, Set<LocalDate>> daysByStudent = attendanceRecordRepository.findAll().stream()
      .collect(Collectors.groupingBy(
        record -> record.studentId,
        Collectors.mapping(record -> record.recordDate, Collectors.toSet())
      ));

    return studentService.listEntities().stream()
      .filter(student -> coursId == null || inscriptionService.isStudentEnrolledInCourse(student.id, coursId))
      .map(student -> {
      int attendedDays = daysByStudent.getOrDefault(student.id, Set.of()).size();
      double percentage = Math.min(100.0, (attendedDays * 100.0) / settings.courseDays);
      boolean eligible = percentage >= settings.eligibilityThreshold;
      return new LigneEligibiliteReponse(
        student.id,
        student.matricule,
        formatStudentName(student),
        attendedDays,
        settings.courseDays,
        percentage,
        eligible
      );
    }).toList();
  }

  public PresenceReponse toResponse(Presence record) {
    // Je reconstruis le nom depuis la fiche étudiante si elle existe encore pour garder une sortie cohérente.
    String resolvedStudentName = record.studentName;
    try {
      resolvedStudentName = formatStudentName(studentService.findEntity(record.studentId));
    } catch (ExceptionIntrouvable ignored) {
    }

    return new PresenceReponse(
      record.id,
      record.studentId,
      record.seance == null ? null : record.seance.idSeance,
      resolvedStudentName,
      record.matricule,
      record.department,
      record.dateHeure,
      record.heureArrivee,
      record.recordDate,
      record.checkIn,
      record.checkOut,
      record.status.name(),
      record.estJustifiee,
      record.motifJustificatif,
      record.modeSaisie.name(),
      record.justificatif == null ? null : record.justificatif.idJustificatif
    );
  }

  private String normalizeFingerprint(String fingerprintTemplateId) {
    if (fingerprintTemplateId == null) {
      throw new IllegalArgumentException("L'identifiant biometrique est obligatoire.");
    }

    String normalized = fingerprintTemplateId.trim().toUpperCase();
    if (normalized.isEmpty()) {
      throw new IllegalArgumentException("L'identifiant biometrique est obligatoire.");
    }

    return normalized;
  }

  private void validateCourseAccess(Etudiant student, Long coursId) {
    // Un pointage ne doit être accepté que si l'étudiant est bien inscrit au cours ciblé.
    if (coursId == null) {
      return;
    }

    if (!inscriptionService.isStudentEnrolledInCourse(student.id, coursId)) {
      throw new IllegalStateException("Cet étudiant n'est pas enrôlé dans ce cours.");
    }
  }

  private Set<UUID> getStudentIdsForCourse(Long coursId) {
    return inscriptionService.getStudentIdsForCourse(coursId);
  }

  private String formatStudentName(Etudiant student) {
    return Stream.of(student.name, student.postNom, student.prenom)
      .filter(Objects::nonNull)
      .map(value -> value.trim())
      .filter(value -> !value.isEmpty())
      .collect(Collectors.joining(" "));
  }
}
