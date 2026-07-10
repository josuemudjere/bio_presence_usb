package com.biopresence.api.dto;

public record ScanReponse(
  String message,
  PresenceReponse attendance
) {
}
