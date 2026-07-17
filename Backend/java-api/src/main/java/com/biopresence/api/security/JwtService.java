package com.biopresence.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {

  private final SecretKey signingKey;
  private final long expirationMs;

  public JwtService(
    @Value("${app.security.jwt.secret}") String secret,
    @Value("${app.security.jwt.expiration-ms:86400000}") long expirationMs
  ) {
    this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    this.expirationMs = expirationMs;
  }

  public String generateToken(UUID userId, String role, Map<String, Object> claims) {
    Instant now = Instant.now();
    return Jwts.builder()
      .subject(userId.toString())
      .claims(claims)
      .claim("role", role)
      .issuedAt(Date.from(now))
      .expiration(Date.from(now.plusMillis(expirationMs)))
      .signWith(signingKey)
      .compact();
  }

  public String extractSubject(String token) {
    return extractAllClaims(token).getSubject();
  }

  public String extractEmail(String token) {
    Object email = extractAllClaims(token).get("email");
    return email == null ? null : email.toString();
  }

  public boolean isTokenValid(String token, UUID expectedUserId) {
    Claims claims = extractAllClaims(token);
    return expectedUserId.toString().equals(claims.getSubject())
      && claims.getExpiration() != null
      && claims.getExpiration().after(new Date());
  }

  public Instant extractExpiration(String token) {
    Date expiration = extractAllClaims(token).getExpiration();
    return expiration == null ? Instant.now() : expiration.toInstant();
  }

  private Claims extractAllClaims(String token) {
    return Jwts.parser()
      .verifyWith(signingKey)
      .build()
      .parseSignedClaims(token)
      .getPayload();
  }
}