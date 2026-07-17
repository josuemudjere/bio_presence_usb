package com.biopresence.api.service;

import com.biopresence.api.dto.UtilisateurRequete;
import com.biopresence.api.Repositories.UtilisateurRepository;
import com.biopresence.api.dto.UtilisateurReponse;
import com.biopresence.api.entity.Utilisateur;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.security.ConnexionRequete;
import com.biopresence.api.security.UserSessionEventService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
public class UtilisateurService {

  private final UtilisateurRepository utilisateurRepository;
  private final PasswordEncoder passwordEncoder;
  private final UserSessionEventService userSessionEventService;

  public UtilisateurService(
    UtilisateurRepository utilisateurRepository,
    PasswordEncoder passwordEncoder,
    UserSessionEventService userSessionEventService
  ) {
    this.utilisateurRepository = utilisateurRepository;
    this.passwordEncoder = passwordEncoder;
    this.userSessionEventService = userSessionEventService;
  }

  public List<UtilisateurReponse> listAll() {
    return utilisateurRepository.findAll().stream().map(this::toResponse).toList();
  }

  public UtilisateurReponse getById(UUID id) {
    return toResponse(findEntity(id));
  }

  public Utilisateur findEntity(UUID id) {
    return utilisateurRepository.findById(Objects.requireNonNull(id, "id"))
        .orElseThrow(() -> new ExceptionIntrouvable("Utilisateur introuvable."));
  }

  public UtilisateurReponse create(UtilisateurRequete request) {
    if (utilisateurRepository.existsByEmail(request.email().trim())) {
      throw new IllegalArgumentException("Cet email est déjà utilisé.");
    }
    Utilisateur utilisateur = new Utilisateur(
        request.nom().trim(),
        request.email().trim().toLowerCase(),
        passwordEncoder.encode(request.password()),
        resolvePrimaryCoursId(request.coursId(), request.coursIds()),
      normalizeRole(request.role())
    );
    utilisateur.prenom = normalizeNullable(request.prenom());
    utilisateur.coursIds = normalizeCoursIds(request.coursId(), request.coursIds());
    utilisateurRepository.save(utilisateur);
    userSessionEventService.notifySessionUpdated(utilisateur.id);
    return toResponse(utilisateur);
  }

  public UtilisateurReponse update(UUID id, UtilisateurRequete request) {
    Utilisateur utilisateur = findEntity(id);
    String newEmail = request.email().trim().toLowerCase();
    if (!newEmail.equals(utilisateur.email) && utilisateurRepository.existsByEmail(newEmail)) {
      throw new IllegalArgumentException("Cet email est déjà utilisé.");
    }
    utilisateur.nom = request.nom().trim();
    utilisateur.prenom = normalizeNullable(request.prenom());
    utilisateur.email = newEmail;
    if (request.password() != null && !request.password().isBlank()) {
      utilisateur.password = passwordEncoder.encode(request.password());
    }
    utilisateur.coursId = resolvePrimaryCoursId(request.coursId(), request.coursIds());
    utilisateur.coursIds = normalizeCoursIds(request.coursId(), request.coursIds());
    if (request.role() != null && !request.role().isBlank()) {
      utilisateur.role = normalizeRole(request.role());
    }
    utilisateurRepository.save(utilisateur);
    userSessionEventService.notifySessionUpdated(utilisateur.id);
    return toResponse(utilisateur);
  }

  public void delete(UUID id) {
    Utilisateur utilisateur = findEntity(id);
    utilisateurRepository.deleteById(Objects.requireNonNull(id, "id"));
    userSessionEventService.notifySessionUpdated(utilisateur.id);
  }

  public UtilisateurReponse toggleActif(UUID id) {
    Utilisateur utilisateur = findEntity(id);
    utilisateur.actif = !utilisateur.actif;
    utilisateurRepository.save(utilisateur);
    userSessionEventService.notifySessionUpdated(utilisateur.id);
    return toResponse(utilisateur);
  }

  public Utilisateur login(ConnexionRequete request) {
    Utilisateur utilisateur = utilisateurRepository.findByEmail(request.email().trim().toLowerCase())
        .filter(u -> passwordEncoder.matches(request.password(), u.password) || u.password.equals(request.password()))
        .orElseThrow(() -> new RuntimeException("Identifiants invalides"));
    if (!utilisateur.actif) {
      throw new RuntimeException("Ce compte a été désactivé. Contactez un administrateur.");
    }
    return utilisateur;
  }

  public UtilisateurReponse toResponse(Utilisateur utilisateur) {
    return new UtilisateurReponse(
        utilisateur.id,
        utilisateur.nom,
        utilisateur.prenom,
        utilisateur.email,
        utilisateur.coursId,
        parseCoursIds(utilisateur.coursIds),
        utilisateur.photoUrl,
        normalizeRole(utilisateur.role),
        utilisateur.actif
    );
  }

  private Long resolvePrimaryCoursId(Long coursId, List<Long> coursIds) {
    if (coursIds != null) {
      return coursIds.stream().filter(Objects::nonNull).findFirst().orElse(coursId);
    }

    return coursId;
  }

  private String normalizeCoursIds(Long coursId, List<Long> coursIds) {
    List<Long> normalizedIds = coursIds == null || coursIds.isEmpty()
      ? (coursId == null ? List.of() : List.of(coursId))
      : coursIds.stream().filter(Objects::nonNull).distinct().toList();

    return normalizedIds.isEmpty()
      ? null
      : normalizedIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
  }

  private List<Long> parseCoursIds(String rawCoursIds) {
    if (rawCoursIds == null || rawCoursIds.isBlank()) {
      return List.of();
    }

    return Arrays.stream(rawCoursIds.split(","))
      .map(value -> value == null ? "" : value.trim())
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

  private String normalizeRole(String role) {
    if (role == null || role.isBlank()) {
      return "teacher";
    }

    String normalized = role.trim().toLowerCase(Locale.ROOT);
    return normalized.equals("user") ? "teacher" : normalized;
  }
}
