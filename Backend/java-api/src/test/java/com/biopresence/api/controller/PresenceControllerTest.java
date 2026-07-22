package com.biopresence.api.controller;

import com.biopresence.api.dto.PresenceReponse;
import com.biopresence.api.dto.ScanReponse;
import com.biopresence.api.mqtt.MqttBridgeService;
import com.biopresence.api.service.PresenceService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PresenceControllerTest {

  @Test
  void scanRequestReturnsThePersistedAttendanceFromTheBackendBridge() {
    PresenceService attendanceService = mock(PresenceService.class);
    MqttBridgeService mqttBridgeService = mock(MqttBridgeService.class);
    PresenceController controller = new PresenceController(attendanceService, mqttBridgeService);

    UUID attendanceId = UUID.randomUUID();
    UUID studentId = UUID.randomUUID();
    PresenceReponse attendance = new PresenceReponse(
      attendanceId,
      studentId,
      7L,
      null,
      "Doe John",
      null,
      "20240001",
      "Informatique",
      "Génie Logiciel",
      null,
      null,
      LocalDate.now(),
      LocalTime.now(),
      null,
      "PRESENT",
      false,
      null,
      "EMPREINTE",
      null,
      null
    );
    ScanReponse expected = new ScanReponse("Scan exécuté via backend", attendance);
    when(mqttBridgeService.requestScan(7L, 30_000L)).thenReturn(expected);

    ScanReponse response = controller.scanRequest(new PresenceController.ScanRequestRequete(7L));

    assertSame(expected, response);
  }
}
