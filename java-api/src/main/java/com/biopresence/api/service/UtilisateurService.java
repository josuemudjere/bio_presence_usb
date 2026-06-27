package com.biopresence.api.service;

import com.biopresence.api.dto.ConnexionRequete;
import com.biopresence.api.dto.UtilisateurRequete;
import com.biopresence.api.dto.UtilisateurReponse;
import com.biopresence.api.entity.Utilisateur;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.repository.UtilisateurRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class UtilisateurService {

  private final UtilisateurRepository utilisateurRepository;

  public UtilisateurService(UtilisateurRepository utilisateurRepository) {
    this.utilisateurRepository = utilisateurRepository;
  }

  public List<UtilisateurReponse> listAll() {
    return utilisateurRepository.findAll().stream().map(this::toResponse).toList();
  }

  public UtilisateurReponse getById(UUID id) {
    return toResponse(findEntity(id));
  }

  public Utilisateur findEntity(UUID id) {
    return utilisateurRepository.findById(id)
        .orElseThrow(() -> new ExceptionIntrouvable("Utilisateur introuvable."));
  }

  public UtilisateurReponse create(UtilisateurRequete request) {
    if (utilisateurRepository.existsByEmail(request.email().trim())) {
      throw new IllegalArgumentException("Cet email est déjà utilisé.");
    }
    Utilisateur utilisateur = new Utilisateur(
        request.nom().trim(),
        request.email().trim().toLowerCase(),
        request.password(),
        request.coursId(),
        request.role()
    );
    utilisateurRepository.save(utilisateur);
    return toResponse(utilisateur);
  }

  public UtilisateurReponse update(UUID id, UtilisateurRequete request) {
    Utilisateur utilisateur = findEntity(id);
    String newEmail = request.email().trim().toLowerCase();
    if (!newEmail.equals(utilisateur.email) && utilisateurRepository.existsByEmail(newEmail)) {
      throw new IllegalArgumentException("Cet email est déjà utilisé.");
    }
    utilisateur.nom = request.nom().trim();
    utilisateur.email = newEmail;
    if (request.password() != null && !request.password().isBlank()) {
      utilisateur.password = request.password();
    }
    utilisateur.coursId = request.coursId();
    if (request.role() != null && !request.role().isBlank()) {
      utilisateur.role = request.role();
    }
    utilisateurRepository.save(utilisateur);
    return toResponse(utilisateur);
  }

  public void delete(UUID id) {
    findEntity(id);
    utilisateurRepository.deleteById(id);
  }

  public UtilisateurReponse toggleActif(UUID id) {
    Utilisateur utilisateur = findEntity(id);
    utilisateur.actif = !utilisateur.actif;
    utilisateurRepository.save(utilisateur);
    return toResponse(utilisateur);
  }

  public Utilisateur login(ConnexionRequete request) {
    Utilisateur utilisateur = utilisateurRepository.findByEmail(request.email().trim().toLowerCase())
        .filter(u -> u.password.equals(request.password()))
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
        utilisateur.email,
        utilisateur.coursId,
        utilisateur.photoUrl,
        utilisateur.role,
        utilisateur.actif
    );
  }
}
