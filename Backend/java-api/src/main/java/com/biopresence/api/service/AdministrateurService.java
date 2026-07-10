package com.biopresence.api.service;

import com.biopresence.api.dto.AdministrateurReponse;
import com.biopresence.api.entity.Administrateur;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.persistence.AdministrateurRepository;
import com.biopresence.api.security.ConnexionRequete;
import com.biopresence.api.security.MajProfilRequete;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AdministrateurService {

  private final AdministrateurRepository adminRepository;

  public AdministrateurService(AdministrateurRepository adminRepository) {
    this.adminRepository = adminRepository;
  }

  public AdministrateurReponse login(ConnexionRequete request) {
    Administrateur admin = adminRepository.findByEmail(request.email())
        .orElseThrow(() -> new RuntimeException("Identifiants invalides"));

    if (!admin.password.equals(request.password())) {
      throw new RuntimeException("Identifiants invalides");
    }

    return toResponse(admin);
  }

  public AdministrateurReponse getById(UUID id) {
    Administrateur admin = adminRepository.findById(id)
        .orElseThrow(() -> new ExceptionIntrouvable("Administrateur introuvable"));
    return toResponse(admin);
  }

  public AdministrateurReponse updateProfile(UUID id, MajProfilRequete request) {
    Administrateur admin = adminRepository.findById(id)
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

    adminRepository.save(admin);
    return toResponse(admin);
  }

  public AdministrateurReponse updatePassword(UUID id, String currentPassword, String newPassword) {
    Administrateur admin = adminRepository.findById(id)
        .orElseThrow(() -> new ExceptionIntrouvable("Administrateur introuvable"));

    if (!admin.password.equals(currentPassword)) {
      throw new RuntimeException("Mot de passe actuel incorrect");
    }
    if (newPassword == null || newPassword.length() < 6) {
      throw new RuntimeException("Le nouveau mot de passe doit contenir au moins 6 caractères");
    }

    admin.password = newPassword;
    adminRepository.save(admin);
    return toResponse(admin);
  }

  public boolean existsAny() {
    return adminRepository.count() > 0;
  }

  public void seedDefault() {
    // Migration : mettre à jour l'ancien admin par défaut si les credentials ont changé
    adminRepository.findByEmail("admin@university.edu").ifPresent(old -> {
      old.email = "admin@usb.org";
      old.password = "Josue2026";
      adminRepository.save(old);
    });
    // Migration : mettre à jour le mot de passe si l'admin existe déjà avec l'ancien mot de passe
    adminRepository.findByEmail("admin@usb.org").ifPresent(existing -> {
      if (!"Josue2026".equals(existing.password)) {
        existing.password = "Josue2026";
        adminRepository.save(existing);
      }
    });
    // Seed si aucun admin n'existe
    if (!existsAny()) {
      adminRepository.save(new Administrateur("Administrateur", "admin@usb.org", "Josue2026"));
    }
  }

  private AdministrateurReponse toResponse(Administrateur admin) {
    return new AdministrateurReponse(admin.id, admin.name, admin.email, admin.photoUrl, "admin");
  }
}
