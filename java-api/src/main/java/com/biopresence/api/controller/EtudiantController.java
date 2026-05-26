package com.biopresence.api.controller;

import com.biopresence.api.dto.EtudiantRequete;
import com.biopresence.api.dto.EtudiantReponse;
import com.biopresence.api.service.EtudiantService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/students")
public class EtudiantController {
  private final EtudiantService studentService;

  public EtudiantController(EtudiantService studentService) {
    this.studentService = studentService;
  }

  @GetMapping
  public List<EtudiantReponse> list() {
    return studentService.listAll();
  }

  @GetMapping("/{id}")
  public EtudiantReponse getById(@PathVariable UUID id) {
    return studentService.getById(id);
  }

  @PostMapping
  public EtudiantReponse create(@Valid @RequestBody EtudiantRequete request) {
    return studentService.create(request);
  }

  @PutMapping("/{id}")
  public EtudiantReponse update(@PathVariable UUID id, @Valid @RequestBody EtudiantRequete request) {
    return studentService.update(id, request);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    studentService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
