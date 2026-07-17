package com.biopresence.api.security;

import com.biopresence.api.config.ConfigCors;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  private final JwtAuthenticationFilter jwtAuthenticationFilter;
  private final BioPresenceUserDetailsService userDetailsService;
  private final ConfigCors configCors;

  public SecurityConfig(
    JwtAuthenticationFilter jwtAuthenticationFilter,
    BioPresenceUserDetailsService userDetailsService,
    ConfigCors configCors
  ) {
    this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    this.userDetailsService = userDetailsService;
    this.configCors = configCors;
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
      .csrf(AbstractHttpConfigurer::disable)
      .cors(cors -> cors.configurationSource(configCors.corsConfigurationSource()))
      .httpBasic(AbstractHttpConfigurer::disable)
      .formLogin(AbstractHttpConfigurer::disable)
      .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/", "/api/health", "/api/auth/login", "/api/auth/events").permitAll()
        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
        .requestMatchers("/api/auth/profile/**").authenticated()
        .requestMatchers("/api/users/**", "/api/promotions/**").hasRole("ADMIN")
        .requestMatchers(HttpMethod.POST, "/api/courses/**", "/api/students/**", "/api/attendance/**").hasAnyRole("ADMIN", "TEACHER")
        .requestMatchers(HttpMethod.PUT, "/api/courses/**", "/api/students/**", "/api/course-settings/**").hasAnyRole("ADMIN", "TEACHER")
        .requestMatchers(HttpMethod.DELETE, "/api/courses/**", "/api/students/**", "/api/attendance/**").hasAnyRole("ADMIN", "TEACHER")
        .requestMatchers("/api/**").authenticated()
        .anyRequest().permitAll()
      )
      .authenticationProvider(authenticationProvider())
      .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

    return http.build();
  }

  @Bean
  public AuthenticationProvider authenticationProvider() {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(userDetailsService);
    provider.setPasswordEncoder(passwordEncoder());
    return provider;
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
    return configuration.getAuthenticationManager();
  }
}