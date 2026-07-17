package com.biopresence.api.security;

import com.biopresence.api.Repositories.AdministrateurRepository;
import com.biopresence.api.Repositories.UtilisateurRepository;
import com.biopresence.api.entity.Administrateur;
import com.biopresence.api.entity.Utilisateur;
import com.biopresence.api.exception.ExceptionIntrouvable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class AuthService {

  private final AdministrateurRepository administrateurRepository;
  private final UtilisateurRepository utilisateurRepository;
  private final JwtService jwtService;
  private final PasswordEncoder passwordEncoder;
  private final TokenRevocationService tokenRevocationService;

  public AuthService(
    AdministrateurRepository administrateurRepository,
    UtilisateurRepository utilisateurRepository,
    JwtService jwtService,
    PasswordEncoder passwordEncoder,
    TokenRevocationService tokenRevocationService
  ) {
    this.administrateurRepository = administrateurRepository;
    this.utilisateurRepository = utilisateurRepository;
    this.jwtService = jwtService;
    this.passwordEncoder = passwordEncoder;
    this.tokenRevocationService = tokenRevocationService;
  }

  public AuthSessionReponse login(ConnexionRequete request) {
    // Je tente d'abord le compte administrateur historique, puis les comptes utilisateurs classiques.
    String email = normalizeEmail(request.email());
    String password = request.password();

    Administrateur administrateur = administrateurRepository.findByEmail(email).orElse(null);
    if (administrateur != null) {
      if (!matchesPassword(password, administrateur.password)) {
        throw new RuntimeException("Identifiants invalides");
      }
      upgradePasswordIfNeeded(administrateur, password);
      return toResponse(administrateur);
    }

    Utilisateur utilisateur = utilisateurRepository.findByEmail(email)
      .orElseThrow(() -> new RuntimeException("Identifiants invalides"));

    // Un compte désactivé reste authentifiable en base mais doit être bloqué côté service métier.
    if (!matchesPassword(password, utilisateur.password)) {
      throw new RuntimeException("Identifiants invalides");
    }

    if (!utilisateur.actif) {
      throw new RuntimeException("Ce compte a été désactivé. Contactez un administrateur.");
    }

    upgradePasswordIfNeeded(utilisateur, password);

    return toResponse(utilisateur);
  }

  public AuthSessionReponse getProfile(UUID id) {
    // La récupération du profil supporte à la fois les administrateurs et les utilisateurs métier.
    UUID userId = Objects.requireNonNull(id, "id");
    assertSelfOrAdmin(userId);
    Administrateur administrateur = administrateurRepository.findById(userId).orElse(null);
    if (administrateur != null) {
      return toResponse(administrateur);
    }

    Utilisateur utilisateur = utilisateurRepository.findById(userId)
      .orElseThrow(() -> new ExceptionIntrouvable("Utilisateur introuvable"));
    return toResponse(utilisateur);
  }

  public AuthSessionReponse updateProfile(UUID id, MajProfilRequete request) {
    // La mise à jour mutualise les règles communes tout en respectant les deux sources de données existantes.
    UUID userId = Objects.requireNonNull(id, "id");
    assertSelfOrAdmin(userId);
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
    // Le changement de mot de passe impose toujours la vérification de l'ancien secret.
    UUID userId = Objects.requireNonNull(id, "id");
    assertSelfOrAdmin(userId);
    Administrateur administrateur = administrateurRepository.findById(userId).orElse(null);
    if (administrateur != null) {
      if (!matchesPassword(currentPassword, administrateur.password)) {
        throw new RuntimeException("Mot de passe actuel incorrect");
      }
      validateNewPassword(newPassword);
      administrateur.password = passwordEncoder.encode(newPassword);
      administrateurRepository.save(administrateur);
      return;
    }

    Utilisateur utilisateur = utilisateurRepository.findById(userId)
      .orElseThrow(() -> new ExceptionIntrouvable("Utilisateur introuvable"));
    if (!matchesPassword(currentPassword, utilisateur.password)) {
      throw new RuntimeException("Mot de passe actuel incorrect");
    }
    validateNewPassword(newPassword);
    utilisateur.password = passwordEncoder.encode(newPassword);
    utilisateurRepository.save(utilisateur);
  }

  public void logout(String token) {
    if (token == null || token.isBlank()) {
      return;
    }

    tokenRevocationService.revoke(token, jwtService.extractExpiration(token));
    SecurityContextHolder.clearContext();
  }

  private void validateNewPassword(String newPassword) {
    if (newPassword == null || newPassword.length() < 6) {
      throw new RuntimeException("Le nouveau mot de passe doit contenir au moins 6 caractères");
    }
  }

  private String normalizeEmail(String email) {
    // L'email est normalisé en minuscules pour garder des recherches et contraintes cohérentes.
    if (email == null || email.isBlank()) {
      throw new RuntimeException("L'email est obligatoire");
    }
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private String normalizeRole(String role) {
    // L'ancien rôle "user" est ramené vers "teacher" pour rester compatible avec le front actuel.
    if (role == null || role.isBlank()) {
      return "teacher";
    }

    String normalized = role.trim().toLowerCase(Locale.ROOT);
    return normalized.equals("user") ? "teacher" : normalized;
  }

  private AuthSessionReponse toResponse(Administrateur administrateur) {
    String token = jwtService.generateToken(
      administrateur.id,
      "admin",
      Map.of("email", administrateur.email, "name", administrateur.name)
    );
    return new AuthSessionReponse(
      administrateur.id,
      administrateur.name,
      administrateur.email,
      administrateur.photoUrl,
      "admin",
      null,
      List.of(),
      token
    );
  }

  private AuthSessionReponse toResponse(Utilisateur utilisateur) {
    String normalizedRole = normalizeRole(utilisateur.role);
    String token = jwtService.generateToken(
      utilisateur.id,
      normalizedRole,
      Map.of("email", utilisateur.email, "name", utilisateur.nom)
    );
    return new AuthSessionReponse(
      utilisateur.id,
      utilisateur.nom,
      utilisateur.email,
      utilisateur.photoUrl,
      normalizedRole,
      utilisateur.coursId,
      parseCoursIds(utilisateur.coursIds, utilisateur.coursId),
      token
    );
  }

  private boolean matchesPassword(String rawPassword, String storedPassword) {
    if (rawPassword == null || storedPassword == null) {
      return false;
    }

    if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
      return passwordEncoder.matches(rawPassword, storedPassword);
    }

    return storedPassword.equals(rawPassword);
  }

  private void upgradePasswordIfNeeded(Administrateur administrateur, String rawPassword) {
    if (administrateur.password != null && !administrateur.password.startsWith("$2")) {
      administrateur.password = passwordEncoder.encode(rawPassword);
      administrateurRepository.save(administrateur);
    }
  }

  private void upgradePasswordIfNeeded(Utilisateur utilisateur, String rawPassword) {
    if (utilisateur.password != null && !utilisateur.password.startsWith("$2")) {
      utilisateur.password = passwordEncoder.encode(rawPassword);
      utilisateurRepository.save(utilisateur);
    }
  }

  private void assertSelfOrAdmin(UUID userId) {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
      throw new AccessDeniedException("Accès refusé");
    }

    if ("admin".equals(principal.getRole()) || principal.getId().equals(userId)) {
      return;
    }

    throw new AccessDeniedException("Accès refusé");
  }

  private List<Long> parseCoursIds(String rawCoursIds, Long fallbackCoursId) {
    // Certains comptes stockent encore plusieurs cours dans une chaîne CSV historique.
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