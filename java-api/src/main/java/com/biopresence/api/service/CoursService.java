package com.biopresence.api.service;

import com.biopresence.api.dto.CoursRequete;
import com.biopresence.api.dto.CoursReponse;
import com.biopresence.api.entity.Cours;
import com.biopresence.api.exception.ExceptionIntrouvable;
import com.biopresence.api.repository.CoursRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CoursService {

  private final CoursRepository coursRepository;

  public CoursService(CoursRepository coursRepository) {
    this.coursRepository = coursRepository;
  }

  public List<CoursReponse> listAll() {
    return coursRepository.findAll().stream().map(this::toResponse).toList();
  }

  public CoursReponse getById(Long id) {
    return toResponse(findEntity(id));
  }

  public Cours findEntity(Long id) {
    return coursRepository.findById(id)
        .orElseThrow(() -> new ExceptionIntrouvable("Cours introuvable."));
  }

  public CoursReponse create(CoursRequete request) {
    Cours cours = new Cours(
        request.nom().trim(),
        request.nbJours(),
        request.nbHeures(),
        request.seuilEligibilite(),
        request.heureDebut(),
        request.heureFin()
    );
    coursRepository.save(cours);
    return toResponse(cours);
  }

  public CoursReponse update(Long id, CoursRequete request) {
    Cours cours = findEntity(id);
    cours.nom = request.nom().trim();
    cours.nbJours = request.nbJours();
    cours.nbHeures = request.nbHeures();
    cours.seuilEligibilite = request.seuilEligibilite();
    cours.heureDebut = request.heureDebut();
    cours.heureFin = request.heureFin();
    coursRepository.save(cours);
    return toResponse(cours);
  }

  public void delete(Long id) {
    findEntity(id);
    coursRepository.deleteById(id);
  }

  public CoursReponse toResponse(Cours cours) {
    return new CoursReponse(
        cours.id,
        cours.nom,
        cours.nbJours,
        cours.nbHeures,
        cours.seuilEligibilite,
        cours.heureDebut,
        cours.heureFin
    );
  }
}
