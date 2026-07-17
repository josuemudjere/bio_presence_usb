package com.biopresence.api.security;

import com.biopresence.api.Repositories.AdministrateurRepository;
import com.biopresence.api.Repositories.UtilisateurRepository;
import com.biopresence.api.entity.Administrateur;
import com.biopresence.api.entity.Utilisateur;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class BioPresenceUserDetailsService implements UserDetailsService {

  private final AdministrateurRepository administrateurRepository;
  private final UtilisateurRepository utilisateurRepository;

  public BioPresenceUserDetailsService(
    AdministrateurRepository administrateurRepository,
    UtilisateurRepository utilisateurRepository
  ) {
    this.administrateurRepository = administrateurRepository;
    this.utilisateurRepository = utilisateurRepository;
  }

  @Override
  public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
    String email = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);

    Administrateur administrateur = administrateurRepository.findByEmail(email).orElse(null);
    if (administrateur != null) {
      return new AuthenticatedUser(administrateur.id, administrateur.email, administrateur.password, true, "admin");
    }

    Utilisateur utilisateur = utilisateurRepository.findByEmail(email)
      .orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable"));

    return new AuthenticatedUser(
      utilisateur.id,
      utilisateur.email,
      utilisateur.password,
      utilisateur.actif,
      normalizeRole(utilisateur.role)
    );
  }

  private String normalizeRole(String role) {
    if (role == null || role.isBlank()) {
      return "teacher";
    }

    String normalized = role.trim().toLowerCase(Locale.ROOT);
    return normalized.equals("user") ? "teacher" : normalized;
  }
}