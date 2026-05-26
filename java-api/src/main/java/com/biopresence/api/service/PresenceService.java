package com.biopresence.api.service;

import com.biopresence.api.dto.PresenceReponse;
import com.biopresence.api.dto.PresenceScanRequete;
import com.biopresence.api.dto.LigneEligibiliteReponse;
import com.biopresence.api.dto.ScanReponse;
import com.biopresence.api.entity.Presence;
import com.biopresence.api.entity.StatutPresence;
import com.biopresence.api.entity.ParametresCours;
import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.repository.PresenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class PresenceService {
  private final PresenceRepository attendanceRecordRepository;
  private final EtudiantService studentService;
  private final ParametresCoursService courseSettingsService;

  public PresenceService(
    PresenceRepository attendanceRecordRepository,
    EtudiantService studentService,
    ParametresCoursService courseSettingsService
  ) {
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.studentService = studentService;
    this.courseSettingsService = courseSettingsService;
  }

  public ScanReponse scan(PresenceScanRequete request) {
    if (!courseSettingsService.isConfigured()) {
      throw new IllegalStateException("Configurez d'abord le cours avant le pointage.");
    }

    String fingerprintTemplateId = normalizeFingerprint(request.fingerprintTemplateId());
    Etudiant student = studentService.findByFingerprintTemplateId(fingerprintTemplateId)
      .orElseThrow(() -> new ExceptionIntrouvable("Aucun etudiant ne correspond a cet identifiant d'empreinte."));

    LocalDate today = LocalDate.now();
    LocalTime now = LocalTime.now().withSecond(0).withNano(0);

    var openRecord = attendanceRecordRepository
      .findFirstByStudentIdAndRecordDateAndCheckOutIsNullOrderByCheckInAsc(student.id, today);

    if (openRecord.isPresent()) {
      Presence record = openRecord.get();
      record.checkOut = now;
      record.status = StatutPresence.CLOSED;
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

    Presence record = new Presence(student.id, student.name, student.matricule, student.department, today, now);
    attendanceRecordRepository.save(record);
    student.lastFingerprintScan = LocalDateTime.now().toString();
    studentService.save(student);
    return new ScanReponse("Entree enregistree", toResponse(record));
  }

  public List<PresenceReponse> listForDate(LocalDate date) {
    return attendanceRecordRepository.findByRecordDateOrderByCheckInAsc(date).stream().map(this::toResponse).toList();
  }

  public List<LigneEligibiliteReponse> buildEligibilityReport() {
    ParametresCours settings = courseSettingsService.getCurrentEntity();
    if (settings.courseName == null || settings.courseName.isBlank() || settings.courseDays <= 0 || settings.courseHours <= 0) {
      throw new IllegalStateException("Configurez d'abord le cours avant de generer le rapport d'eligibilite.");
    }

    Map<UUID, Set<LocalDate>> daysByStudent = attendanceRecordRepository.findAll().stream()
      .collect(Collectors.groupingBy(
        record -> record.studentId,
        Collectors.mapping(record -> record.recordDate, Collectors.toSet())
      ));

    return studentService.listEntities().stream().map(student -> {
      int attendedDays = daysByStudent.getOrDefault(student.id, Set.of()).size();
      double percentage = Math.min(100.0, (attendedDays * 100.0) / settings.courseDays);
      boolean eligible = percentage >= settings.eligibilityThreshold;
      return new LigneEligibiliteReponse(
        student.id,
        student.matricule,
        student.name,
        attendedDays,
        settings.courseDays,
        percentage,
        eligible
      );
    }).toList();
  }

  public PresenceReponse toResponse(Presence record) {
    return new PresenceReponse(
      record.id,
      record.studentId,
      record.studentName,
      record.matricule,
      record.department,
      record.recordDate,
      record.checkIn,
      record.checkOut,
      record.status.name()
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
}
