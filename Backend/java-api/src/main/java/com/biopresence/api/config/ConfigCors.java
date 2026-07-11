package com.biopresence.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class ConfigCors implements WebMvcConfigurer {

  // Je garde des patterns assez larges pour supporter les postes locaux et les appareils du réseau de test.
  private static final String[] ALLOWED_ORIGIN_PATTERNS = {
    "http://localhost:*",
    "http://127.0.0.1:*",
    "http://192.168.*:*",
    "http://10.*:*",
    "http://172.*:*",
    "http://*.local:*",
    "https://localhost:*",
    "https://127.0.0.1:*",
    "https://192.168.*:*",
    "https://10.*:*",
    "https://172.*:*",
    "https://*.local:*"
  };

  @Override
  public void addCorsMappings(@NonNull CorsRegistry registry) {
    // Cette configuration MVC couvre les appels classiques du frontend vers l'API.
    registry.addMapping("/**")
      .allowedOriginPatterns(
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://192.168.*:*",
        "http://10.*:*",
        "http://172.*:*",
        "http://*.local:*",
        "https://localhost:*",
        "https://127.0.0.1:*",
        "https://192.168.*:*",
        "https://10.*:*",
        "https://172.*:*",
        "https://*.local:*"
      )
      .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
      .allowedHeaders("*")
      .allowCredentials(true);
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    // Je fournis aussi un bean dédié pour les composants Spring Security ou filtres éventuels.
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOriginPatterns(List.of(ALLOWED_ORIGIN_PATTERNS));
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("*"));
    configuration.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }
}
