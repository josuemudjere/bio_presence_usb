package com.biopresence.api.service;

import com.biopresence.api.entity.Cours;
import com.biopresence.api.entity.Etudiant;
import com.biopresence.api.entity.Inscription;
import com.biopresence.api.entity.StatutInscription;
import com.biopresence.api.persistence.InscriptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class InscriptionService {

  private final InscriptionRepository inscriptionRepository;

  public InscriptionService(InscriptionRepository inscriptionRepository) {
    this.inscriptionRepository = inscriptionRepository;
  }

  // Ce service centralise les inscriptions actives entre étudiants et cours.

  public void replaceStudentInscriptions(Etudiant etudiant, List<Cours> baseCourses, List<Cours> creditCourses) {
    inscriptionRepository.deleteByEtudiantId(etudiant.id);

    Set<Long> seenCourseIds = new LinkedHashSet<>();
    addInscriptions(etudiant, baseCourses, seenCourseIds, false);
    addInscriptions(etudiant, creditCourses, seenCourseIds, true);
  }

  public boolean isStudentEnrolledInCourse(UUID studentId, Long coursId) {
    return inscriptionRepository.existsByEtudiantIdAndCoursIdAndStatut(studentId, coursId, StatutInscription.VALIDEE);
  }

  public Set<UUID> getStudentIdsForCourse(Long coursId) {
    return inscriptionRepository.findByCoursIdAndStatut(coursId, StatutInscription.VALIDEE).stream()
      .map(inscription -> inscription.etudiant.id)
      .collect(java.util.stream.Collectors.toSet());
  }

  public List<Long> getCourseIdsForStudent(UUID studentId) {
    return inscriptionRepository.findByEtudiantIdOrderByDateInscriptionAsc(studentId).stream()
      .filter(inscription -> inscription.statut == StatutInscription.VALIDEE)
      .map(inscription -> inscription.cours.id)
      .distinct()
      .toList();
  }

  private void addInscriptions(Etudiant etudiant, List<Cours> courses, Set<Long> seenCourseIds, boolean credit) {
    if (courses == null) {
      return;
    }

    for (Cours cours : courses) {
      if (cours == null || cours.id == null || !seenCourseIds.add(cours.id)) {
        continue;
      }

      Inscription inscription = new Inscription();
      inscription.etudiant = etudiant;
      inscription.cours = cours;
      inscription.dateInscription = LocalDate.now();
      inscription.statut = StatutInscription.VALIDEE;
      inscription.notes = credit ? "Cours de crédit" : "Affectation via promotion";
      inscriptionRepository.save(inscription);
    }
  }
}