package com.biopresence.api.service;

import com.biopresence.api.dto.JustificatifDepartAnticipeRequete;
import com.biopresence.api.dto.PresenceReponse;
import com.biopresence.api.dto.PresenceManuelleRequete;
import com.biopresence.api.dto.PresenceScanRequete;
import com.biopresence.api.dto.LigneEligibiliteReponse;
import com.biopresence.api.dto.ScanReponse;
import com.biopresence.api.entity.EmpreinteDigitale;
import com.biopresence.api.entity.Justificatif;
import com.biopresence.api.entity.ModeSaisie;
import com.biopresence.api.entity.Presence;
import com.biopresence.api.entity.StatutPresence;
import com.biopresence.api.entity.ParametresCours;
import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.persistence.JustificatifRepository;
import com.biopresence.api.persistence.PresenceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
  private static final Logger logger = LoggerFactory.getLogger(PresenceService.class);
  private static final int ATTENDANCE_GRACE_PERIOD_MINUTES = 20;

  private final PresenceRepository attendanceRecordRepository;
  private final JustificatifRepository justificatifRepository;
  private final EtudiantService studentService;
  private final ParametresCoursService courseSettingsService;
  private final InscriptionService inscriptionService;
  private final CoursService coursService;

  public PresenceService(
    PresenceRepository attendanceRecordRepository,
    JustificatifRepository justificatifRepository,
    EtudiantService studentService,
    ParametresCoursService courseSettingsService,
    InscriptionService inscriptionService,
    CoursService coursService
  ) {
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.justificatifRepository = justificatifRepository;
    this.studentService = studentService;
    this.courseSettingsService = courseSettingsService;
    this.inscriptionService = inscriptionService;
    this.coursService = coursService;
  }

  public ScanReponse scan(PresenceScanRequete request) {
    // Le scan biométrique ouvre ou clôture la présence du jour selon l'état déjà enregistré.
    if (!courseSettingsService.isConfigured()) {
      throw new IllegalStateException("Configurez d'abord le cours avant le pointage.");
    }

    String fingerprintTemplateId = normalizeFingerprint(request.fingerprintTemplateId());
    logger.info("Teacher attendance scan received: fingerprintTemplateId='{}', coursId={}", fingerprintTemplateId, request.coursId());

    EmpreinteDigitale matchedFingerprint = studentService.findFingerprintByTemplateId(fingerprintTemplateId).orElse(null);

    Etudiant student = studentService.findByFingerprintTemplateId(fingerprintTemplateId)
      .orElseThrow(() -> new ExceptionIntrouvable("Aucun etudiant ne correspond a cet identifiant d'empreinte."));

    logger.info(
      "Teacher attendance scan matched student: studentId={}, matricule={}, coursId={}, legacyLinked={}, courseIds={}",
      student.id,
      student.matricule,
      request.coursId(),
      studentService.isLegacyLinkedToCourse(student, request.coursId()),
      inscriptionService.getCourseIdsForStudent(student.id)
    );

    validateCourseAccess(student, request.coursId());

    LocalDate today = LocalDate.now();
    LocalTime now = LocalTime.now().withSecond(0).withNano(0);
    validateAttendanceWindow(request.coursId(), now);

    var openRecord = attendanceRecordRepository
      .findFirstByStudentIdAndRecordDateAndCheckOutIsNullOrderByCheckInAsc(student.id, today);

    if (openRecord.isPresent()) {
      // Une présence ouverte devient ici une sortie du même jour.
      Presence record = openRecord.get();
      record.checkOut = now;
      record.status = StatutPresence.PRESENT;
      if (record.coursId == null) {
        record.coursId = request.coursId();
      }
      if (record.empreinteDigitale == null) {
        record.empreinteDigitale = matchedFingerprint;
      }
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
    Presence record = new Presence(student.id, request.coursId(), formatStudentName(student), student.matricule, student.department, today, now);
    record.modeSaisie = ModeSaisie.EMPREINTE;
    record.etudiant = student;
    record.empreinteDigitale = matchedFingerprint;
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

    var openRecord = attendanceRecordRepository
      .findFirstByStudentIdAndRecordDateAndCheckOutIsNullOrderByCheckInAsc(student.id, date);
    List<Presence> dailyRecords = attendanceRecordRepository.findByStudentIdAndRecordDateOrderByCheckInAsc(student.id, date);
    boolean alreadyClosed = dailyRecords.stream().anyMatch(record -> record.checkOut != null);

    if (openRecord.isPresent()) {
      if (alreadyClosed) {
        throw new IllegalStateException("Cet etudiant a deja effectue une entree et une sortie pour cette date.");
      }

      Presence record = openRecord.get();
      LocalTime effectiveCheckOut = checkOut != null ? checkOut : checkIn;
      validateAttendanceWindow(request.coursId(), effectiveCheckOut);
      if (effectiveCheckOut.isBefore(record.checkIn)) {
        throw new IllegalArgumentException("L'heure de sortie doit être postérieure à l'heure d'entrée.");
      }

      record.checkOut = effectiveCheckOut;
      record.status = StatutPresence.PRESENT;
      record.modeSaisie = ModeSaisie.MANUELLE;
      if (record.coursId == null) {
        record.coursId = request.coursId();
      }

      attendanceRecordRepository.save(record);
      student.lastFingerprintScan = LocalDateTime.now().toString();
      studentService.save(student);
      return toResponse(record);
    }

    if (alreadyClosed) {
      throw new IllegalStateException("Cet etudiant a deja effectue une entree et une sortie pour cette date.");
    }

    validateAttendanceWindow(request.coursId(), checkIn);

    Presence record = new Presence(student.id, request.coursId(), formatStudentName(student), student.matricule, student.department, date, checkIn);
    record.modeSaisie = ModeSaisie.MANUELLE;
    record.etudiant = student;
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
      .filter(record -> Objects.equals(record.coursId, coursId) || (record.coursId == null && studentIds.contains(record.studentId)))
      .map(this::toResponse)
      .toList();
  }

  public List<PresenceReponse> listForCourseBetween(Long coursId, LocalDate startDate, LocalDate endDate) {
    Set<UUID> studentIds = getStudentIdsForCourse(coursId);
    return attendanceRecordRepository.findByRecordDateBetweenOrderByRecordDateAscCheckInAsc(startDate, endDate).stream()
      .filter(record -> Objects.equals(record.coursId, coursId) || (record.coursId == null && studentIds.contains(record.studentId)))
      .map(this::toResponse)
      .toList();
  }

  public PresenceReponse saveDepartureJustification(String attendanceId, JustificatifDepartAnticipeRequete request) {
    UUID attendanceUuid = UUID.fromString(attendanceId);
    Presence record = attendanceRecordRepository.findById(Objects.requireNonNull(attendanceUuid, "attendanceUuid"))
      .orElseThrow(() -> new ExceptionIntrouvable("Pointage introuvable."));

    String motif = normalizeOptionalText(request.motifJustificatif());
    Justificatif justificatif = record.justificatif != null ? record.justificatif : new Justificatif();
    justificatif.titre = request.estJustifiee() ? "Départ anticipé" : "Départ anticipé non justifié";
    justificatif.description = motif;
    justificatif.fichierUrl = null;
    justificatif.dateSoumission = LocalDateTime.now();
    justificatif.valide = request.estJustifiee();
    Justificatif savedJustificatif = justificatifRepository.save(justificatif);

    record.justificatif = savedJustificatif;
    record.motifJustificatif = motif;
    record.estJustifiee = request.estJustifiee();

    attendanceRecordRepository.save(record);
    return toResponse(record);
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

    Long effectiveCoursId = coursId != null ? coursId : settings.coursId;
    Set<UUID> studentIds = effectiveCoursId == null ? Set.of() : getStudentIdsForCourse(effectiveCoursId);

    Map<UUID, Set<LocalDate>> daysByStudent = attendanceRecordRepository.findAll().stream()
      .filter(record -> effectiveCoursId == null || Objects.equals(record.coursId, effectiveCoursId) || (record.coursId == null && studentIds.contains(record.studentId)))
      .collect(Collectors.groupingBy(
        record -> record.studentId,
        Collectors.mapping(record -> record.recordDate, Collectors.toSet())
      ));

    return studentService.listEntities().stream()
      .filter(student -> effectiveCoursId == null || inscriptionService.isStudentEnrolledInCourse(student.id, effectiveCoursId))
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
    String resolvedPhotoUrl = null;
    try {
      Etudiant student = studentService.findEntity(record.studentId);
      resolvedStudentName = formatStudentName(student);
      resolvedPhotoUrl = student.photoUrl;
    } catch (ExceptionIntrouvable ignored) {
    }

    return new PresenceReponse(
      record.id,
      record.studentId,
      record.coursId,
      record.seance == null ? null : record.seance.idSeance,
      resolvedStudentName,
      resolvedPhotoUrl,
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
      record.empreinteDigitale == null ? null : record.empreinteDigitale.templateId,
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

    if (inscriptionService.isStudentEnrolledInCourse(student.id, coursId)) {
      return;
    }

    if (studentService.isLegacyLinkedToCourse(student, coursId)) {
      studentService.backfillLegacyInscriptionsIfMissing(student);
      return;
    }

    throw new IllegalStateException("Cet étudiant n'est pas inscrit à ce cours.");
  }

  private void validateAttendanceWindow(Long coursId, LocalTime scanTime) {
    LocalTime startTime = resolveAttendanceStartTime(coursId);
    LocalTime endTime = resolveAttendanceEndTime(coursId);

    if (startTime == null || endTime == null) {
      return;
    }

    LocalTime latestAllowed = endTime.plusMinutes(ATTENDANCE_GRACE_PERIOD_MINUTES);
    if (scanTime.isBefore(startTime)) {
      throw new IllegalStateException(
        String.format(
          "Le pointage n'est autorisé qu'à partir de %s pour ce cours.",
          startTime
        )
      );
    }

    if (scanTime.isAfter(latestAllowed)) {
      throw new IllegalStateException(
        String.format(
          "Le pointage est fermé pour ce cours depuis %s. Une tolérance maximale de %d minutes après la fin est appliquée.",
          latestAllowed,
          ATTENDANCE_GRACE_PERIOD_MINUTES
        )
      );
    }
  }

  private LocalTime resolveAttendanceStartTime(Long coursId) {
    String value = resolveAttendanceTimeValue(coursId, true);
    return value == null || value.isBlank() ? null : LocalTime.parse(value);
  }

  private LocalTime resolveAttendanceEndTime(Long coursId) {
    String value = resolveAttendanceTimeValue(coursId, false);
    return value == null || value.isBlank() ? null : LocalTime.parse(value);
  }

  private String resolveAttendanceTimeValue(Long coursId, boolean start) {
    if (coursId != null) {
      try {
        var cours = coursService.findEntity(coursId);
        return start ? cours.heureDebut : cours.heureFin;
      } catch (RuntimeException ignored) {
      }
    }

    var settings = courseSettingsService.getCurrent();
    return start ? settings.startTime() : settings.endTime();
  }

  private Set<UUID> getStudentIdsForCourse(Long coursId) {
    return inscriptionService.getStudentIdsForCourse(coursId);
  }

  private String normalizeOptionalText(String value) {
    if (value == null) {
      return null;
    }

    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }

  private String formatStudentName(Etudiant student) {
    return Stream.of(student.name, student.postNom, student.prenom)
      .filter(Objects::nonNull)
      .map(value -> value.trim())
      .filter(value -> !value.isEmpty())
      .collect(Collectors.joining(" "));
  }
}
