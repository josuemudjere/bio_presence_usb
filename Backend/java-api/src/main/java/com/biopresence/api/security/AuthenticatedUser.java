package com.biopresence.api.security;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class AuthenticatedUser implements UserDetails {

  private final UUID id;
  private final String email;
  private final String password;
  private final boolean enabled;
  private final String role;

  public AuthenticatedUser(UUID id, String email, String password, boolean enabled, String role) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.enabled = enabled;
    this.role = role;
  }

  public UUID getId() {
    return id;
  }

  public String getRole() {
    return role;
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
  }

  @Override
  public String getPassword() {
    return password;
  }

  @Override
  public String getUsername() {
    return email;
  }

  @Override
  public boolean isEnabled() {
    return enabled;
  }
}