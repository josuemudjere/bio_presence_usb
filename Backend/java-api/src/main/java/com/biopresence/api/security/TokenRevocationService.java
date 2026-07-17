package com.biopresence.api.security;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TokenRevocationService {

  private final Map<String, Instant> revokedTokens = new ConcurrentHashMap<>();

  public void revoke(String token, Instant expiresAt) {
    cleanupExpiredRevocations();
    revokedTokens.put(token, expiresAt);
  }

  public boolean isRevoked(String token) {
    cleanupExpiredRevocations();
    return revokedTokens.containsKey(token);
  }

  private void cleanupExpiredRevocations() {
    Instant now = Instant.now();
    revokedTokens.entrySet().removeIf(entry -> entry.getValue() == null || !entry.getValue().isAfter(now));
  }
}