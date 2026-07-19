package com.biopresence.api.service;

import com.biopresence.api.Repositories.AdministrateurRepository;
import com.biopresence.api.dto.AdministrateurReponse;
import com.biopresence.api.entity.Administrateur;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.security.ConnexionRequete;
import com.biopresence.api.security.MajProfilRequete;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.UUID;

@Service
public class AdministrateurService {

  public static final String DEFAULT_ADMIN_EMAIL = "admin@usb.org";
  public static final String DEFAULT_ADMIN_PASSWORD = "Josue2026";
  public static final String LEGACY_ADMIN_EMAIL = "admin@university.edu";

  private final AdministrateurRepository adminRepository;
  private final PasswordEncoder passwordEncoder;

  public AdministrateurService(AdministrateurRepository adminRepository, PasswordEncoder passwordEncoder) {
    this.adminRepository = adminRepository;
    this.passwordEncoder = passwordEncoder;
  }

  public AdministrateurReponse login(ConnexionRequete request) {
    // Ce flux simple vérifie les identifiants de l'administrateur historique du système.
    Administrateur admin = adminRepository.findByEmail(request.email())
        .orElseThrow(() -> new RuntimeException("Identifiants invalides"));

    if (!(passwordEncoder.matches(request.password(), admin.password) || admin.password.equals(request.password()))) {
      throw new RuntimeException("Identifiants invalides");
    }

    return toResponse(admin);
  }

  public AdministrateurReponse getById(UUID id) {
    // Retourne le profil administrateur demandé ou échoue avec un message métier clair.
    Administrateur admin = adminRepository.findById(Objects.requireNonNull(id, "id"))
        .orElseThrow(() -> new ExceptionIntrouvable("Administrateur introuvable"));
    return toResponse(admin);
  }

  public AdministrateurReponse updateProfile(UUID id, MajProfilRequete request) {
    Administrateur admin = adminRepository.findById(Objects.requireNonNull(id, "id"))
        .orElseThrow(() -> new ExceptionIntrouvable("Administrateur introuvable"));

    if (request.name() != null && !request.name().isBlank()) {
      admin.name = request.name();
    }
    if (request.photoUrl() != null) {
      admin.photoUrl = request.photoUrl();
    }
    if (request.email() != null && !request.email().isBlank()) {
      boolean emailTaken = adminRepository.findByEmail(request.email())
          .filter(other -> !other.id.equals(id))
          .isPresent();
      if (emailTaken) throw new RuntimeException("Cet email est déjà utilisé");
      admin.email = request.email();
    }

    adminRepository.save(Objects.requireNonNull(admin, "admin"));
    return toResponse(admin);
  }

  public AdministrateurReponse updatePassword(UUID id, String currentPassword, String newPassword) {
    Administrateur admin = adminRepository.findById(Objects.requireNonNull(id, "id"))
        .orElseThrow(() -> new ExceptionIntrouvable("Administrateur introuvable"));

    if (!(passwordEncoder.matches(currentPassword, admin.password) || admin.password.equals(currentPassword))) {
      throw new RuntimeException("Mot de passe actuel incorrect");
    }
    if (newPassword == null || newPassword.length() < 6) {
      throw new RuntimeException("Le nouveau mot de passe doit contenir au moins 6 caractères");
    }

    admin.password = passwordEncoder.encode(newPassword);
    adminRepository.save(admin);
    return toResponse(admin);
  }

  public boolean existsAny() {
    return adminRepository.count() > 0;
  }

  public void seedDefault() {
    // Migration : renommer l'ancien email admin par défaut sans écraser son mot de passe existant.
    adminRepository.findByEmail(LEGACY_ADMIN_EMAIL).ifPresent(old -> {
      old.email = DEFAULT_ADMIN_EMAIL;
      if (old.password == null || old.password.isBlank()) {
        old.password = passwordEncoder.encode(DEFAULT_ADMIN_PASSWORD);
      }
      adminRepository.save(old);
    });
    // Migration : ne convertir en hash que le mot de passe par défaut stocké en clair.
    adminRepository.findByEmail(DEFAULT_ADMIN_EMAIL).ifPresent(existing -> {
      if (DEFAULT_ADMIN_PASSWORD.equals(existing.password)) {
        existing.password = passwordEncoder.encode(DEFAULT_ADMIN_PASSWORD);
        adminRepository.save(existing);
      }
    });
    // Seed si aucun admin n'existe
    if (!existsAny()) {
      adminRepository.save(new Administrateur("Administrateur", DEFAULT_ADMIN_EMAIL, passwordEncoder.encode(DEFAULT_ADMIN_PASSWORD)));
    }
  }

  private AdministrateurReponse toResponse(Administrateur admin) {
    return new AdministrateurReponse(admin.id, admin.name, admin.email, admin.photoUrl, "admin");
  }
}
