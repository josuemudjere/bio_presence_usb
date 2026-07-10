package com.biopresence.api.persistence;

import com.biopresence.api.entity.Presence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PresenceRepository extends JpaRepository<Presence, UUID> {
  List<Presence> findByRecordDateOrderByCheckInAsc(LocalDate recordDate);

  List<Presence> findByRecordDateBetweenOrderByRecordDateAscCheckInAsc(LocalDate startDate, LocalDate endDate);

  List<Presence> findByStudentIdAndRecordDateOrderByCheckInAsc(UUID studentId, LocalDate recordDate);

  Optional<Presence> findFirstByStudentIdAndRecordDateAndCheckOutIsNullOrderByCheckInAsc(UUID studentId, LocalDate recordDate);
}
