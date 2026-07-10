package com.biopresence.api.security;

import com.biopresence.api.entity.Administrateur;
import com.biopresence.api.entity.Utilisateur;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.persistence.AdministrateurRepository;
import com.biopresence.api.persistence.UtilisateurRepository;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
public class AuthService {

  private final AdministrateurRepository administrateurRepository;
  private final UtilisateurRepository utilisateurRepository;

  public AuthService(
    AdministrateurRepository administrateurRepository,
    UtilisateurRepository utilisateurRepository
  ) {
    this.administrateurRepository = administrateurRepository;
    this.utilisateurRepository = utilisateurRepository;
  }

  public AuthSessionReponse login(ConnexionRequete request) {
    String email = normalizeEmail(request.email());
    String password = request.password();

    Administrateur administrateur = administrateurRepository.findByEmail(email).orElse(null);
    if (administrateur != null) {
      if (!administrateur.password.equals(password)) {
        throw new RuntimeException("Identifiants invalides");
      }
      return toResponse(administrateur);
    }

    Utilisateur utilisateur = utilisateurRepository.findByEmail(email)
      .orElseThrow(() -> new RuntimeException("Identifiants invalides"));

    if (!utilisateur.password.equals(password)) {
      throw new RuntimeException("Identifiants invalides");
    }

    if (!utilisateur.actif) {
      throw new RuntimeException("Ce compte a été désactivé. Contactez un administrateur.");
    }

    return toResponse(utilisateur);
  }

  public AuthSessionReponse getProfile(UUID id) {
    UUID userId = Objects.requireNonNull(id, "id");
    Administrateur administrateur = administrateurRepository.findById(userId).orElse(null);
    if (administrateur != null) {
      return toResponse(administrateur);
    }

    Utilisateur utilisateur = utilisateurRepository.findById(userId)
      .orElseThrow(() -> new ExceptionIntrouvable("Utilisateur introuvable"));
    return toResponse(utilisateur);
  }

  public AuthSessionReponse updateProfile(UUID id, MajProfilRequete request) {
    UUID userId = Objects.requireNonNull(id, "id");
    Administrateur administrateur = administrateurRepository.findById(userId).orElse(null);
    if (administrateur != null) {
      if (request.name() != null && !request.name().isBlank()) {
        administrateur.name = request.name().trim();
      }
      if (request.photoUrl() != null) {
        administrateur.photoUrl = request.photoUrl();
      }
      if (request.email() != null && !request.email().isBlank()) {
        String email = normalizeEmail(request.email());
        boolean emailTaken = administrateurRepository.findByEmail(email)
          .filter(other -> !other.id.equals(userId))
          .isPresent();
        if (emailTaken || utilisateurRepository.existsByEmail(email)) {
          throw new RuntimeException("Cet email est déjà utilisé");
        }
        administrateur.email = email;
      }
      administrateurRepository.save(administrateur);
      return toResponse(administrateur);
    }

    Utilisateur utilisateur = utilisateurRepository.findById(userId)
      .orElseThrow(() -> new ExceptionIntrouvable("Utilisateur introuvable"));

    if (request.name() != null && !request.name().isBlank()) {
      utilisateur.nom = request.name().trim();
    }
    if (request.photoUrl() != null) {
      utilisateur.photoUrl = request.photoUrl();
    }
    if (request.email() != null && !request.email().isBlank()) {
      String email = normalizeEmail(request.email());
      boolean emailTaken = utilisateurRepository.findByEmail(email)
        .filter(other -> !other.id.equals(userId))
        .isPresent();
      if (emailTaken || administrateurRepository.findByEmail(email).isPresent()) {
        throw new RuntimeException("Cet email est déjà utilisé");
      }
      utilisateur.email = email;
    }

    utilisateurRepository.save(Objects.requireNonNull(utilisateur, "utilisateur"));
    return toResponse(utilisateur);
  }

  public void updatePassword(UUID id, String currentPassword, String newPassword) {
    UUID userId = Objects.requireNonNull(id, "id");
    Administrateur administrateur = administrateurRepository.findById(userId).orElse(null);
    if (administrateur != null) {
      if (!administrateur.password.equals(currentPassword)) {
        throw new RuntimeException("Mot de passe actuel incorrect");
      }
      validateNewPassword(newPassword);
      administrateur.password = newPassword;
      administrateurRepository.save(administrateur);
      return;
    }

    Utilisateur utilisateur = utilisateurRepository.findById(userId)
      .orElseThrow(() -> new ExceptionIntrouvable("Utilisateur introuvable"));
    if (!utilisateur.password.equals(currentPassword)) {
      throw new RuntimeException("Mot de passe actuel incorrect");
    }
    validateNewPassword(newPassword);
    utilisateur.password = newPassword;
    utilisateurRepository.save(utilisateur);
  }

  private void validateNewPassword(String newPassword) {
    if (newPassword == null || newPassword.length() < 6) {
      throw new RuntimeException("Le nouveau mot de passe doit contenir au moins 6 caractères");
    }
  }

  private String normalizeEmail(String email) {
    if (email == null || email.isBlank()) {
      throw new RuntimeException("L'email est obligatoire");
    }
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private String normalizeRole(String role) {
    if (role == null || role.isBlank()) {
      return "teacher";
    }

    String normalized = role.trim().toLowerCase(Locale.ROOT);
    return normalized.equals("user") ? "teacher" : normalized;
  }

  private AuthSessionReponse toResponse(Administrateur administrateur) {
    return new AuthSessionReponse(
      administrateur.id,
      administrateur.name,
      administrateur.email,
      administrateur.photoUrl,
      "admin",
      null,
      List.of()
    );
  }

  private AuthSessionReponse toResponse(Utilisateur utilisateur) {
    return new AuthSessionReponse(
      utilisateur.id,
      utilisateur.nom,
      utilisateur.email,
      utilisateur.photoUrl,
      normalizeRole(utilisateur.role),
      utilisateur.coursId,
      parseCoursIds(utilisateur.coursIds, utilisateur.coursId)
    );
  }

  private List<Long> parseCoursIds(String rawCoursIds, Long fallbackCoursId) {
    if (rawCoursIds == null || rawCoursIds.isBlank()) {
      return fallbackCoursId == null ? List.of() : List.of(fallbackCoursId);
    }

    return Arrays.stream(rawCoursIds.split(","))
      .map(value -> value == null ? "" : value.trim())
      .filter(value -> !value.isEmpty())
      .map(Long::valueOf)
      .collect(java.util.stream.Collectors.collectingAndThen(java.util.stream.Collectors.toCollection(LinkedHashSet::new), List::copyOf));
  }
}