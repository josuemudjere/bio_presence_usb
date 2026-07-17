package com.biopresence.api.service;

import com.biopresence.api.dto.CoursRequete;
import com.biopresence.api.Repositories.CoursRepository;
import com.biopresence.api.dto.CoursReponse;
import com.biopresence.api.entity.Cours;
import com.biopresence.api.exception.ExceptionIntrouvable;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CoursService {

  private final CoursRepository coursRepository;
  private final AcademicCatalogService academicCatalogService;
  private final InscriptionService inscriptionService;

  public CoursService(CoursRepository coursRepository, AcademicCatalogService academicCatalogService, InscriptionService inscriptionService) {
    this.coursRepository = coursRepository;
    this.academicCatalogService = academicCatalogService;
    this.inscriptionService = inscriptionService;
  }

  public List<CoursReponse> listAll() {
    // Le frontend consomme toujours des DTO de réponse, jamais les entités directement.
    return coursRepository.findAll().stream().map(this::toResponse).toList();
  }

  public List<Cours> listEntities() {
    // Cette variante reste utile pour d'autres services internes qui ont besoin des entités complètes.
    return coursRepository.findAll();
  }

  public CoursReponse getById(Long id) {
    return toResponse(findEntity(id));
  }

  public Cours findEntity(Long id) {
    // La recherche centralisée garantit le même message métier pour tous les appels.
    return coursRepository.findById(id)
        .orElseThrow(() -> new ExceptionIntrouvable("Cours introuvable."));
  }

  public CoursReponse create(CoursRequete request) {
    // Je dérive d'abord les valeurs par défaut avant d'instancier le cours métier.
    int nbJours = resolveNbJours(request);
    int nbHeures = resolveNbHeures(request);
    int seuilEligibilite = resolveSeuilEligibilite(request);
    Cours cours = new Cours(
        request.nom().trim(),
        nbJours,
        nbHeures,
        seuilEligibilite,
        null,
        null
    );
      applyAcademicFields(cours, request);
    coursRepository.save(cours);
    return toResponse(cours);
  }

  public CoursReponse update(Long id, CoursRequete request) {
    // La mise à jour repart toujours de l'entité persistée pour préserver son identité JPA.
    Cours cours = findEntity(id);
    cours.nom = request.nom().trim();
    cours.nbJours = resolveNbJours(request);
    cours.nbHeures = resolveNbHeures(request);
    cours.seuilEligibilite = resolveSeuilEligibilite(request);
    cours.heureDebut = normalizeNullable(request.heureDebut());
    cours.heureFin = normalizeNullable(request.heureFin());
    applyAcademicFields(cours, request);
    coursRepository.save(cours);
    return toResponse(cours);
  }

  private void applyAcademicFields(Cours cours, CoursRequete request) {
    // Tous les champs secondaires sont regroupés ici pour partager la même logique entre create et update.
    cours.code = normalizeNullable(request.code());
    cours.intitule = normalizeNullable(request.intitule());
    cours.credits = request.credits();
    int nbHeures = resolveNbHeures(request);
    Integer volumeHoraire = request.volumeHoraire();
    cours.volumeHoraire = volumeHoraire != null && volumeHoraire > 0 ? volumeHoraire : nbHeures;
    cours.salle = normalizeNullable(request.salle());
    cours.horaire = normalizeNullable(request.horaire());
    cours.jourSemaine = normalizeNullable(request.jourSemaine());
    cours.departement = request.departementId() == null ? null : academicCatalogService.findDepartement(request.departementId());
    cours.programme = request.programmeId() == null ? null : academicCatalogService.findProgramme(request.programmeId());
  }

  private int resolveNbJours(CoursRequete request) {
    // Un cours sans précision reste planifié sur un seul jour.
    return request.nbJours() != null && request.nbJours() > 0 ? request.nbJours() : 1;
  }

  private int resolveNbHeures(CoursRequete request) {
    // Je réutilise le volume horaire si nbHeures n'est pas renseigné explicitement.
    if (request.nbHeures() != null && request.nbHeures() > 0) {
      return request.nbHeures();
    }

    if (request.volumeHoraire() != null && request.volumeHoraire() > 0) {
      return request.volumeHoraire();
    }

    return 1;
  }

  private int resolveSeuilEligibilite(CoursRequete request) {
    // Le seuil standard reste fixé à 75 % tant qu'aucune valeur n'est fournie.
    return request.seuilEligibilite() != null && request.seuilEligibilite() > 0 ? request.seuilEligibilite() : 75;
  }

  public void delete(Long id) {
    findEntity(id);
    coursRepository.deleteById(id);
  }

  public CoursReponse toResponse(Cours cours) {
    // Je reconstruis un DTO plat pour découpler la réponse HTTP de la structure interne JPA.
    return new CoursReponse(
        cours.id,
        cours.nom,
        cours.code,
        cours.intitule,
        cours.credits,
        cours.volumeHoraire,
        cours.salle,
        cours.horaire,
        cours.jourSemaine,
        cours.enseignant == null ? null : cours.enseignant.idEnseignant,
        cours.departement == null ? null : cours.departement.idDepartement,
        cours.programme == null ? null : cours.programme.idProgramme,
        cours.semestre == null ? null : cours.semestre.idSemestre,
        cours.nbJours,
        cours.nbHeures,
        cours.seuilEligibilite,
        inscriptionService.countStudentsForCourse(cours.id),
        cours.heureDebut,
        cours.heureFin
    );
  }

  private String normalizeNullable(String value) {
    // Une chaîne vide n'apporte pas d'information métier, je la convertis donc en null.
    if (value == null) {
      return null;
    }

    String normalized = value.trim();
    return normalized.isEmpty() ? null : normalized;
  }
}
