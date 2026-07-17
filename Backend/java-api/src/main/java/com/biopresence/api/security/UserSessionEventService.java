package com.biopresence.api.security;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class UserSessionEventService {

  private static final long SSE_TIMEOUT_MS = 0L;

  private final ConcurrentHashMap<UUID, CopyOnWriteArrayList<SseEmitter>> emittersByUserId = new ConcurrentHashMap<>();

  public SseEmitter subscribe(UUID userId) {
    SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
    emittersByUserId.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>()).add(emitter);

    emitter.onCompletion(() -> removeEmitter(userId, emitter));
    emitter.onTimeout(() -> removeEmitter(userId, emitter));
    emitter.onError(error -> removeEmitter(userId, emitter));

    sendEvent(userId, emitter, "connected", "listening");
    return emitter;
  }

  public void notifySessionUpdated(UUID userId) {
    List<SseEmitter> emitters = emittersByUserId.get(userId);
    if (emitters == null || emitters.isEmpty()) {
      return;
    }

    for (SseEmitter emitter : emitters) {
      sendEvent(userId, emitter, "session-updated", "refresh-profile");
    }
  }

  private void sendEvent(UUID userId, SseEmitter emitter, String eventName, String data) {
    try {
      emitter.send(SseEmitter.event().name(eventName).data(data));
    } catch (IOException | IllegalStateException exception) {
      removeEmitter(userId, emitter);
    }
  }

  private void removeEmitter(UUID userId, SseEmitter emitter) {
    List<SseEmitter> emitters = emittersByUserId.get(userId);
    if (emitters == null) {
      return;
    }

    emitters.remove(emitter);
    if (emitters.isEmpty()) {
      emittersByUserId.remove(userId);
    }
  }
}