package com.biopresence.api.mqtt;

import com.biopresence.api.dto.PresenceScanRequete;
import com.biopresence.api.dto.ScanReponse;
import com.biopresence.api.service.PresenceService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class MqttBridgeService {
  private static final Logger logger = LoggerFactory.getLogger(MqttBridgeService.class);
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final PresenceService presenceService;

  private MqttClient client;
  private final Map<String, CompletableFuture<JsonNode>> pending = new ConcurrentHashMap<>();

  @Value("${app.mqtt.broker-url:tcp://localhost:1884}")
  private String brokerUrl;

  @Value("${app.mqtt.base-topic:biopresence/sensor}")
  private String baseTopic;

  public MqttBridgeService(PresenceService presenceService) {
    this.presenceService = presenceService;
  }

  @PostConstruct
  public void start() {
    try {
      client = new MqttClient(brokerUrl, MqttClient.generateClientId());
      MqttConnectOptions opts = new MqttConnectOptions();
      opts.setAutomaticReconnect(true);
      opts.setCleanSession(true);
      client.setCallback(new MqttCallback() {
        @Override
        public void connectionLost(Throwable cause) {
          logger.warn("MQTT connection lost", cause);
        }

        @Override
        public void messageArrived(String topic, MqttMessage message) {
          handleMessage(topic, new String(message.getPayload(), StandardCharsets.UTF_8));
        }

        @Override
        public void deliveryComplete(IMqttDeliveryToken token) {
        }
      });

      client.connect(opts);
      logger.info("Connected MQTT bridge to {}", brokerUrl);

      String eventsTopic = buildTopic("events");
      String statusTopic = buildTopic("status");
      client.subscribe(eventsTopic, 1);
      client.subscribe(statusTopic, 1);
      logger.info("Subscribed to {} and {}", eventsTopic, statusTopic);
    } catch (MqttException e) {
      logger.error("Unable to start MQTT bridge", e);
      client = null;
    }
  }

  @PreDestroy
  public void stop() {
    try {
      if (client != null && client.isConnected()) {
        client.disconnect();
      }
    } catch (MqttException e) {
      logger.warn("Error disconnecting MQTT client", e);
    }
  }

  private String buildTopic(String suffix) {
    return baseTopic.replaceAll("/+$", "") + "/" + suffix;
  }

  private void handleMessage(String topic, String payload) {
    try {
      JsonNode node = objectMapper.readTree(payload);
      String requestId = node.has("requestId") ? node.get("requestId").asText(null) : null;
      String event = node.has("event") ? node.get("event").asText(null) : null;
      logger.debug("MQTT event received {} -> {}", topic, event);
      if (requestId != null && pending.containsKey(requestId)) {
        pending.get(requestId).complete(node);
      }
    } catch (Exception e) {
      logger.warn("Invalid MQTT message payload", e);
    }
  }

  public ScanReponse requestScan(Long coursId, long timeoutMs) {
    if (client == null || !client.isConnected()) {
      throw new IllegalStateException("MQTT bridge not connected");
    }

    String requestId = java.util.UUID.randomUUID().toString();
    var payload = Map.<String, Object>of(
      "version", "1.0",
      "command", "SCAN",
      "requestId", requestId,
      "issuedAt", Instant.now().toString(),
      "source", "backend",
      "mode", "attendance"
    );

    CompletableFuture<JsonNode> future = new CompletableFuture<>();
    pending.put(requestId, future);

    try {
      String commandTopic = buildTopic("command");
      byte[] data = objectMapper.writeValueAsBytes(payload);
      MqttMessage msg = new MqttMessage(data);
      msg.setQos(1);
      client.publish(commandTopic, msg);
    } catch (Exception e) {
      pending.remove(requestId);
      throw new RuntimeException("Unable to publish scan command", e);
    }

    try {
      JsonNode response = future.get(timeoutMs, TimeUnit.MILLISECONDS);
      if (response.has("event") && ("MATCH".equals(response.get("event").asText()) || "ENROLLED".equals(response.get("event").asText()))) {
        String fingerprintId = response.has("fingerprintId") ? response.get("fingerprintId").asText(null) : null;
        if (fingerprintId == null) {
          throw new IllegalStateException("MQTT response missing fingerprintId");
        }

        var req = new PresenceScanRequete(fingerprintId, coursId == null ? null : coursId);
        return presenceService.scan(req);
      }

      throw new IllegalStateException("Unexpected MQTT response event: " + response.toString());
    } catch (Exception e) {
      pending.remove(requestId);
      throw new RuntimeException("Timeout or error waiting for sensor response", e);
    } finally {
      pending.remove(requestId);
    }
  }
}
