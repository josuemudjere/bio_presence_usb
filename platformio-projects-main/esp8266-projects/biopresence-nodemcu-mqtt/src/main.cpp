#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <SoftwareSerial.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Fingerprint.h>
#include <ArduinoJson.h>
#include <time.h>

namespace {

constexpr char WIFI_SSID[] = "Josué M.";
constexpr char WIFI_PASSWORD[] = "jomud@2026";

constexpr char MQTT_HOST[] = "172.20.10.3";
constexpr uint16_t MQTT_PORT = 1884;
constexpr char MQTT_USERNAME[] = "";
constexpr char MQTT_PASSWORD[] = "";

constexpr char SENSOR_ID[] = "nodemcu-esp8266-v1";
constexpr char MQTT_BASE_TOPIC[] = "biopresence/sensor";

constexpr uint8_t FINGER_RX_PIN = 14;  // D5
constexpr uint8_t FINGER_TX_PIN = 12;  // D6
constexpr uint8_t OLED_SDA_PIN = 4;    // D2
constexpr uint8_t OLED_SCL_PIN = 5;    // D1
constexpr uint8_t GREEN_LED_PIN = 16;  // D0
constexpr uint8_t RED_LED_PIN = 0;     // D3
constexpr uint8_t BUZZER_PIN = 13;     // D7
constexpr uint32_t DEFAULT_FINGER_SENSOR_BAUD = 19200;
constexpr uint32_t FALLBACK_FINGER_SENSOR_BAUD = 57600;
constexpr uint8_t SENSOR_INIT_VERIFY_RETRIES = 3;
constexpr uint16_t SENSOR_INIT_VERIFY_DELAY_MS = 120;
constexpr uint32_t WIFI_RETRY_DELAY_MS = 500;
constexpr uint32_t MQTT_RETRY_DELAY_MS = 2000;
constexpr uint32_t STATUS_PUBLISH_INTERVAL_MS = 15000;
constexpr uint32_t FINGER_WAIT_TIMEOUT_MS = 30000;
constexpr uint32_t REMOVE_FINGER_TIMEOUT_MS = 10000;
constexpr uint32_t ENROLL_REMOVE_TIMEOUT_MS = 16000;
constexpr uint8_t ENROLL_CONVERT_RETRIES = 3;
constexpr uint8_t ENROLL_VERIFY_RETRIES = 3;
constexpr uint8_t CAPTURE_RECOVERY_RETRIES = 5;
constexpr uint16_t CAPTURE_RECOVERY_DELAY_MS = 120;
constexpr uint8_t SENSOR_PACKET_RETRY_COUNT = 3;
constexpr uint16_t SENSOR_PACKET_RETRY_DELAY_MS = 90;
constexpr uint16_t NO_FINGER_POLL_DELAY_MS = 180;
constexpr uint8_t FINGER_PRESENCE_CONFIRMATION_COUNT = 5;
constexpr uint8_t FINGER_REMOVAL_CONFIRMATION_COUNT = 3;
constexpr uint8_t ENROLL_FINGER_PRESENCE_CONFIRMATION_COUNT = 3;
constexpr uint16_t FINGER_PRESENCE_CONFIRMATION_DELAY_MS = 80;
constexpr uint16_t FINGER_PRESENCE_CONFIRMATION_WINDOW_MS = 320;
constexpr uint16_t ENROLL_FINGER_PRESENCE_CONFIRMATION_WINDOW_MS = 160;
constexpr uint8_t SCAN_MATCH_RETRIES = 3;
constexpr uint16_t SCAN_RETRY_DELAY_MS = 180;
constexpr uint32_t SCAN_RETRY_REMOVE_TIMEOUT_MS = 5000;
constexpr uint16_t SUCCESS_TONE_HZ = 2400;
constexpr uint16_t ERROR_TONE_HZ = 900;
constexpr uint16_t SUCCESS_TONE_DURATION_MS = 140;
constexpr uint16_t ERROR_TONE_DURATION_MS = 320;
constexpr uint16_t SIGNAL_PAUSE_MS = 60;
constexpr uint16_t SUCCESS_LED_HOLD_MS = 700;
constexpr uint16_t ERROR_LED_HOLD_MS = 1200;
constexpr uint16_t CAPTURE_BLINK_INTERVAL_MS = 180;
constexpr uint16_t ACTIVITY_LED_HOLD_MS = 1500;
constexpr size_t MQTT_EVENT_BUFFER_SIZE = 1536;
constexpr size_t FINGERPRINT_TEMPLATE_SIZE = 512;
constexpr size_t FINGERPRINT_TEMPLATE_PACKET_SIZE = 534;
constexpr uint16_t MAX_FINGERPRINT_SLOTS = 127;
constexpr int SENSOR_CANCELLED = -100;
constexpr int SENSOR_TIMEOUT = -101;
constexpr uint8_t SCREEN_WIDTH = 128;
constexpr uint8_t SCREEN_HEIGHT = 64;
constexpr int8_t OLED_RESET = -1;
constexpr uint8_t OLED_ADDRESS = 0x3C;

SoftwareSerial fingerprintSerial(FINGER_RX_PIN, FINGER_TX_PIN);
Adafruit_Fingerprint finger(&fingerprintSerial);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

char commandTopic[64];
char eventsTopic[64];
char statusTopic[64];

struct PendingCommand {
  bool queued = false;
  String command;
  String requestId;
  String mode;
  String message;
};

PendingCommand pendingCommand;
String activeRequestId;
String activeCommandName;
bool cancelRequested = false;
bool scannerBusy = false;
bool displayReady = false;
bool successSignalArmed = true;
uint32_t activeFingerSensorBaud = DEFAULT_FINGER_SENSOR_BAUD;
unsigned long lastStatusPublishAt = 0;
unsigned long lastIdlePromptAt = 0;
unsigned long successLedUntil = 0;
unsigned long errorLedUntil = 0;
unsigned long activityLedUntil = 0;

enum class DisplayIcon {
  Fingerprint,
  Success,
  Error,
  Info,
};

void processSensorCriticalLoop(uint16_t delayMs);
void flushFingerprintSerialBuffer();
bool resyncFingerprintSensor(const char *stepLabel);
bool beginFingerprintSensor();
bool tryBeginFingerprintSensorAtBaud(uint32_t baudRate);
bool checkCancellation(bool allowMqttProcessing = true);
String encodeBase64(const uint8_t *data, size_t length);
bool exportFingerprintTemplateBase64(uint16_t slotId, String &templateBase64);

void setGreenLed(bool enabled) {
  digitalWrite(GREEN_LED_PIN, enabled ? HIGH : LOW);
}

void setRedLed(bool enabled) {
  digitalWrite(RED_LED_PIN, enabled ? HIGH : LOW);
}

void clearSignals() {
  successLedUntil = 0;
  errorLedUntil = 0;
  activityLedUntil = 0;
  setGreenLed(false);
  setRedLed(false);
  noTone(BUZZER_PIN);
}

void holdActivitySignal(uint16_t durationMs = ACTIVITY_LED_HOLD_MS) {
  unsigned long nextUntil = millis() + durationMs;
  if (nextUntil > activityLedUntil) {
    activityLedUntil = nextUntil;
  }
}

void updateSignalOutputs() {
  unsigned long now = millis();

  if (successLedUntil != 0 && now >= successLedUntil) {
    successLedUntil = 0;
    setGreenLed(false);
  }

  if (errorLedUntil != 0 && now >= errorLedUntil) {
    errorLedUntil = 0;
    setRedLed(false);
  }

  if (successLedUntil != 0) {
    setGreenLed(now < successLedUntil);
    setRedLed(false);
    return;
  }

  if (errorLedUntil != 0) {
    setGreenLed(false);
    setRedLed(now < errorLedUntil);
    return;
  }

  if (activityLedUntil != 0) {
    if (now >= activityLedUntil) {
      activityLedUntil = 0;
    } else {
      bool blinkOn = ((now / CAPTURE_BLINK_INTERVAL_MS) % 2) == 0;
      setGreenLed(blinkOn);
      setRedLed(false);
      return;
    }
  }

  setGreenLed(false);
  setRedLed(false);
}

void playSuccessSignal() {
  successLedUntil = millis() + SUCCESS_LED_HOLD_MS;
  errorLedUntil = 0;
  setRedLed(false);
  setGreenLed(true);
  tone(BUZZER_PIN, SUCCESS_TONE_HZ, SUCCESS_TONE_DURATION_MS);
}

void playErrorSignal() {
  errorLedUntil = millis() + ERROR_LED_HOLD_MS;
  successLedUntil = 0;
  setGreenLed(false);
  setRedLed(true);
  tone(BUZZER_PIN, ERROR_TONE_HZ, ERROR_TONE_DURATION_MS);
}

void playSuccessMelody() {
  playSuccessSignal();
  delay(SUCCESS_TONE_DURATION_MS + SIGNAL_PAUSE_MS);
  tone(BUZZER_PIN, SUCCESS_TONE_HZ + 500, SUCCESS_TONE_DURATION_MS);
}

void playErrorMelody() {
  playErrorSignal();
  delay(ERROR_TONE_DURATION_MS + SIGNAL_PAUSE_MS);
  tone(BUZZER_PIN, ERROR_TONE_HZ - 200, ERROR_TONE_DURATION_MS);
}

void setupSignals() {
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  clearSignals();
}

void drawFingerprintIcon(int16_t x, int16_t y) {
  const int16_t cx = x + 16;
  const int16_t cy = y + 18;

  // Outer fingerprint loop
  display.drawCircle(cx, cy, 12, SSD1306_WHITE);
  display.drawCircleHelper(cx, cy, 10, 3, SSD1306_WHITE);
  display.drawCircleHelper(cx, cy + 2, 8, 3, SSD1306_WHITE);
  display.drawCircleHelper(cx, cy + 4, 6, 3, SSD1306_WHITE);
  display.drawCircleHelper(cx, cy + 6, 4, 3, SSD1306_WHITE);

  // Inner ridge details
  display.drawLine(cx - 5, cy - 2, cx - 7, cy + 8, SSD1306_WHITE);
  display.drawLine(cx - 2, cy - 6, cx - 2, cy + 10, SSD1306_WHITE);
  display.drawLine(cx + 2, cy - 8, cx + 2, cy + 10, SSD1306_WHITE);
  display.drawLine(cx + 5, cy - 4, cx + 5, cy + 8, SSD1306_WHITE);

  // Fingerprint core flicks
  display.drawPixel(cx - 1, cy - 12, SSD1306_WHITE);
  display.drawPixel(cx + 1, cy - 12, SSD1306_WHITE);
  display.drawPixel(cx, cy - 10, SSD1306_WHITE);
}

void drawSuccessIcon(int16_t x, int16_t y) {
  display.drawCircle(x + 14, y + 14, 13, SSD1306_WHITE);
  display.drawLine(x + 7, y + 14, x + 12, y + 19, SSD1306_WHITE);
  display.drawLine(x + 12, y + 19, x + 21, y + 9, SSD1306_WHITE);
}

void drawErrorIcon(int16_t x, int16_t y) {
  display.drawCircle(x + 14, y + 14, 13, SSD1306_WHITE);
  display.drawLine(x + 8, y + 8, x + 20, y + 20, SSD1306_WHITE);
  display.drawLine(x + 20, y + 8, x + 8, y + 20, SSD1306_WHITE);
}

void drawInfoIcon(int16_t x, int16_t y) {
  display.drawCircle(x + 14, y + 14, 13, SSD1306_WHITE);
  display.fillCircle(x + 14, y + 8, 2, SSD1306_WHITE);
  display.drawLine(x + 14, y + 12, x + 14, y + 20, SSD1306_WHITE);
}

void renderDisplay(DisplayIcon icon, const char *title, const char *line1 = nullptr, const char *line2 = nullptr) {
  if (!displayReady) {
    return;
  }

  display.clearDisplay();

  switch (icon) {
    case DisplayIcon::Fingerprint:
      drawFingerprintIcon(8, 16);
      break;
    case DisplayIcon::Success:
      drawSuccessIcon(8, 16);
      break;
    case DisplayIcon::Error:
      drawErrorIcon(8, 16);
      break;
    case DisplayIcon::Info:
      drawInfoIcon(8, 16);
      break;
  }

  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(false);
  display.setTextSize(1);
  display.setCursor(44, 8);
  display.println(title);

  if (line1 && line1[0] != '\0') {
    display.setCursor(44, 28);
    display.println(line1);
  }

  if (line2 && line2[0] != '\0') {
    display.setCursor(44, 42);
    display.println(line2);
  }

  display.display();
}

void showIdlePrompt() {
  renderDisplay(DisplayIcon::Fingerprint, "Capteur pret", "Placez votre doigt", "sur le capteur");
  lastIdlePromptAt = millis();
}

void showScanningPrompt() {
  holdActivitySignal();
  renderDisplay(DisplayIcon::Fingerprint, "Scannage...", "Lecture en cours", "Ne bougez pas");
}

void showCaptureSuccess(const char *line1, const char *line2 = nullptr) {
  if (successSignalArmed) {
    playSuccessMelody();
    successSignalArmed = false;
  }
  renderDisplay(DisplayIcon::Success, "Empreinte", line1, line2);
}

void showDisplayError(const char *line1, const char *line2 = nullptr) {
  playErrorMelody();
  successSignalArmed = false;
  renderDisplay(DisplayIcon::Error, "Erreur capteur", line1, line2);
}

void setupDisplay() {
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  displayReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  if (!displayReady) {
    Serial.println("OLED SSD1306 not detected");
    return;
  }

  display.clearDisplay();
  display.display();
  renderDisplay(DisplayIcon::Info, "BioPresence", "Initialisation", "du capteur...");
}

String isoTimestamp() {
  time_t now = time(nullptr);
  if (now <= 100000) {
    return String("1970-01-01T00:00:00Z");
  }

  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

String formatFingerprintId(uint16_t fingerprintId) {
  char buffer[8];
  snprintf(buffer, sizeof(buffer), "%04u", fingerprintId);
  return String(buffer);
}

void logSensorStep(const char *step, const String &details = String()) {
  Serial.print("[BioPresence Sensor] ");
  Serial.print(step);
  if (details.length() > 0) {
    Serial.print(" :: ");
    Serial.print(details);
  }
  Serial.println();
}

void publishStatus(const char *state, const char *message) {
  StaticJsonDocument<256> doc;
  doc["version"] = "1.0";
  doc["state"] = state;
  doc["updatedAt"] = isoTimestamp();
  doc["sensorId"] = SENSOR_ID;
  if (message && message[0] != '\0') {
    doc["message"] = message;
  }
  JsonArray capabilities = doc.createNestedArray("capabilities");
  capabilities.add("SCAN");
  capabilities.add("ENROLL");
  capabilities.add("PING");
  capabilities.add("CANCEL");
  capabilities.add("REJECT");

  char payload[256];
  size_t written = serializeJson(doc, payload, sizeof(payload));
  logSensorStep("publishStatus", String(state) + " | " + (message ? String(message) : String()));
  mqttClient.publish(statusTopic, reinterpret_cast<const uint8_t *>(payload), written, true);
  lastStatusPublishAt = millis();
}

size_t buildStatusPayload(char *buffer, size_t bufferSize, const char *state, const char *message) {
  StaticJsonDocument<256> doc;
  doc["version"] = "1.0";
  doc["state"] = state;
  doc["updatedAt"] = isoTimestamp();
  doc["sensorId"] = SENSOR_ID;
  if (message && message[0] != '\0') {
    doc["message"] = message;
  }
  JsonArray capabilities = doc.createNestedArray("capabilities");
  capabilities.add("SCAN");
  capabilities.add("ENROLL");
  capabilities.add("PING");
  capabilities.add("CANCEL");
  capabilities.add("REJECT");

  return serializeJson(doc, buffer, bufferSize);
}

void publishEvent(const char *eventName, const String &requestId, const String &fingerprintId, const char *message, const String &fingerprintTemplateBase64 = String()) {
  DynamicJsonDocument doc(MQTT_EVENT_BUFFER_SIZE);
  doc["version"] = "1.0";
  doc["event"] = eventName;
  doc["occurredAt"] = isoTimestamp();
  doc["sensorId"] = SENSOR_ID;
  if (requestId.length() > 0) {
    doc["requestId"] = requestId;
  }
  if (fingerprintId.length() > 0) {
    doc["fingerprintId"] = fingerprintId;
  }
  if (fingerprintTemplateBase64.length() > 0) {
    doc["fingerprintTemplateBase64"] = fingerprintTemplateBase64;
  }
  if (message && message[0] != '\0') {
    doc["message"] = message;
  }

  String payload;
  payload.reserve(MQTT_EVENT_BUFFER_SIZE);
  size_t written = serializeJson(doc, payload);
  logSensorStep(
    "publishEvent",
    String(eventName) + " | req=" + requestId + " | finger=" + fingerprintId + " | template=" + String(fingerprintTemplateBase64.length()) + " bytes64 | msg=" + (message ? String(message) : String())
  );
  mqttClient.publish(eventsTopic, reinterpret_cast<const uint8_t *>(payload.c_str()), written, false);
}

String encodeBase64(const uint8_t *data, size_t length) {
  static const char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String encoded;
  encoded.reserve(((length + 2) / 3) * 4);

  for (size_t index = 0; index < length; index += 3) {
    uint32_t chunk = static_cast<uint32_t>(data[index]) << 16;
    bool hasSecondByte = index + 1 < length;
    bool hasThirdByte = index + 2 < length;

    if (hasSecondByte) {
      chunk |= static_cast<uint32_t>(data[index + 1]) << 8;
    }
    if (hasThirdByte) {
      chunk |= static_cast<uint32_t>(data[index + 2]);
    }

    encoded += alphabet[(chunk >> 18) & 0x3F];
    encoded += alphabet[(chunk >> 12) & 0x3F];
    encoded += hasSecondByte ? alphabet[(chunk >> 6) & 0x3F] : '=';
    encoded += hasThirdByte ? alphabet[chunk & 0x3F] : '=';
  }

  return encoded;
}

bool exportFingerprintTemplateBase64(uint16_t slotId, String &templateBase64) {
  fingerprintSerial.listen();
  holdActivitySignal();
  uint8_t loadResult = finger.loadModel(slotId);
  if (loadResult != FINGERPRINT_OK) {
    logSensorStep("enroll:load-model", String("failed slot=") + slotId + " | code=" + loadResult);
    return false;
  }

  fingerprintSerial.listen();
  holdActivitySignal();
  uint8_t getModelResult = finger.getModel();
  if (getModelResult != FINGERPRINT_OK) {
    logSensorStep("enroll:get-model", String("failed slot=") + slotId + " | code=" + getModelResult);
    return false;
  }

  uint8_t bytesReceived[FINGERPRINT_TEMPLATE_PACKET_SIZE];
  memset(bytesReceived, 0xFF, sizeof(bytesReceived));

  size_t bytesRead = 0;
  unsigned long startedAt = millis();
  while (bytesRead < sizeof(bytesReceived) && (millis() - startedAt) < 20000) {
    if (checkCancellation(false)) {
      return false;
    }

    fingerprintSerial.listen();
    while (fingerprintSerial.available() > 0 && bytesRead < sizeof(bytesReceived)) {
      bytesReceived[bytesRead++] = static_cast<uint8_t>(fingerprintSerial.read());
      startedAt = millis();
    }

    if (bytesRead < sizeof(bytesReceived)) {
      processSensorCriticalLoop(2);
    }
  }

  if (bytesRead < sizeof(bytesReceived)) {
    logSensorStep("enroll:get-model-bytes", String("timeout bytes=") + bytesRead);
    return false;
  }

  uint8_t fingerprintTemplate[FINGERPRINT_TEMPLATE_SIZE];
  memset(fingerprintTemplate, 0xFF, sizeof(fingerprintTemplate));
  size_t sourceIndex = 9;
  size_t targetIndex = 0;

  memcpy(fingerprintTemplate + targetIndex, bytesReceived + sourceIndex, 256);
  sourceIndex += 256;
  sourceIndex += 2;
  sourceIndex += 9;
  targetIndex += 256;
  memcpy(fingerprintTemplate + targetIndex, bytesReceived + sourceIndex, 256);

  templateBase64 = encodeBase64(fingerprintTemplate, sizeof(fingerprintTemplate));
  return templateBase64.length() > 0;
}

void processNetwork() {
  updateSignalOutputs();
  mqttClient.loop();
  yield();
  delay(10);
}

void processSensorCriticalLoop(uint16_t delayMs = 2) {
  updateSignalOutputs();
  yield();
  if (delayMs > 0) {
    delay(delayMs);
  }
}

void connectToWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  successSignalArmed = false;
  renderDisplay(DisplayIcon::Info, "Connexion WiFi", WIFI_SSID, "Patientez...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to WiFi SSID '%s'", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(WIFI_RETRY_DELAY_MS);
    Serial.print('.');
  }
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
  playSuccessSignal();
  renderDisplay(DisplayIcon::Success, "WiFi connecte", WIFI_SSID, WiFi.localIP().toString().c_str());
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

bool connectToMqtt() {
  if (mqttClient.connected()) {
    return true;
  }

  String clientId = String("biopresence-") + SENSOR_ID + String("-") + String(ESP.getChipId(), HEX);
  char willPayload[256];
  buildStatusPayload(willPayload, sizeof(willPayload), "OFFLINE", "Capteur deconnecte inopinement");
  Serial.printf("Connecting to MQTT broker %s:%u\n", MQTT_HOST, MQTT_PORT);
  logSensorStep("connectToMqtt", String("clientId=") + clientId);
  successSignalArmed = false;
  bool connected;
  if (strlen(MQTT_USERNAME) > 0) {
    connected = mqttClient.connect(
      clientId.c_str(),
      MQTT_USERNAME,
      MQTT_PASSWORD,
      statusTopic,
      1,
      true,
      willPayload
    );
  } else {
    connected = mqttClient.connect(
      clientId.c_str(),
      nullptr,
      nullptr,
      statusTopic,
      1,
      true,
      willPayload
    );
  }

  if (!connected) {
    Serial.print("MQTT connection failed, rc=");
    Serial.println(mqttClient.state());
    renderDisplay(DisplayIcon::Error, "Connexion impossible" "Nouvel essai...");
    playErrorSignal();
    delay(MQTT_RETRY_DELAY_MS);
    return false;
  }

  if (!mqttClient.subscribe(commandTopic, 1)) {
    Serial.println("Failed to subscribe to command topic");
  }
  playSuccessSignal();
  publishStatus("ONLINE", "Connexion etablie");
  publishStatus("IDLE", "Capteur pret");
  showIdlePrompt();
  return true;
}

bool checkCancellation(bool allowMqttProcessing) {
  if (allowMqttProcessing) {
    processNetwork();
  } else {
    processSensorCriticalLoop();
  }
  if (!cancelRequested) {
    return false;
  }

  publishEvent("CANCELLED", activeRequestId, String(), "Operation annulee");
  publishStatus("IDLE", "Capteur pret");
  showDisplayError("Operation annulee", "par le systeme");
  cancelRequested = false;
  activeRequestId = "";
  activeCommandName = "";
  scannerBusy = false;
  return true;
}

int waitForFingerImage(
  uint32_t timeoutMs,
  bool publishFingerPlaced,
  uint8_t requiredConfirmationCount = FINGER_PRESENCE_CONFIRMATION_COUNT,
  uint16_t requiredConfirmationWindowMs = FINGER_PRESENCE_CONFIRMATION_WINDOW_MS
) {
  unsigned long startAt = millis();
  uint8_t recoverableErrorCount = 0;
  uint8_t confirmedFingerReads = 0;
  unsigned long firstConfirmedFingerAt = 0;

  while (millis() - startAt < timeoutMs) {
    if (checkCancellation(false)) {
      return SENSOR_CANCELLED;
    }

    fingerprintSerial.listen();
    uint8_t result = finger.getImage();
    if (result == FINGERPRINT_OK) {
      if (confirmedFingerReads == 0) {
        firstConfirmedFingerAt = millis();
      }

      confirmedFingerReads += 1;
      unsigned long confirmedPresenceDuration = millis() - firstConfirmedFingerAt;
      if (
        confirmedFingerReads < requiredConfirmationCount ||
        confirmedPresenceDuration < requiredConfirmationWindowMs
      ) {
        processSensorCriticalLoop(FINGER_PRESENCE_CONFIRMATION_DELAY_MS);
        continue;
      }

      recoverableErrorCount = 0;
      showScanningPrompt();
      if (publishFingerPlaced) {
        publishEvent("FINGER_PLACED", activeRequestId, String(), "Doigt detecte");
      }
      return FINGERPRINT_OK;
    }

    if (result == FINGERPRINT_NOFINGER) {
      confirmedFingerReads = 0;
      firstConfirmedFingerAt = 0;
      recoverableErrorCount = 0;
      if (millis() - lastIdlePromptAt >= 1200) {
        showIdlePrompt();
      }
      processNetwork();
      delay(NO_FINGER_POLL_DELAY_MS);
      continue;
    }

    if (result == FINGERPRINT_PACKETRECIEVEERR || result == FINGERPRINT_IMAGEFAIL) {
      confirmedFingerReads = 0;
      firstConfirmedFingerAt = 0;
      recoverableErrorCount += 1;
      if (recoverableErrorCount < CAPTURE_RECOVERY_RETRIES) {
        renderDisplay(DisplayIcon::Info, "Lecture capteur", "Nouvel essai...", "Gardez le doigt fixe");
        if (result == FINGERPRINT_PACKETRECIEVEERR) {
          resyncFingerprintSensor("capture:get-image");
        }
        processSensorCriticalLoop(CAPTURE_RECOVERY_DELAY_MS);
        continue;
      }
    }

    confirmedFingerReads = 0;
    firstConfirmedFingerAt = 0;
    return result;
  }

  return SENSOR_TIMEOUT;
}

int waitForFingerRemoval(uint32_t timeoutMs, uint8_t requiredConfirmationCount = FINGER_REMOVAL_CONFIRMATION_COUNT) {
  unsigned long startAt = millis();
  uint8_t confirmedNoFingerReads = 0;

  while (millis() - startAt < timeoutMs) {
    if (checkCancellation(false)) {
      return SENSOR_CANCELLED;
    }

    fingerprintSerial.listen();
    uint8_t result = finger.getImage();
    if (result == FINGERPRINT_NOFINGER) {
      confirmedNoFingerReads += 1;
      if (confirmedNoFingerReads >= requiredConfirmationCount) {
        return FINGERPRINT_OK;
      }
    } else if (result == FINGERPRINT_OK) {
      confirmedNoFingerReads = 0;
    }

    processSensorCriticalLoop(NO_FINGER_POLL_DELAY_MS);
  }

  return SENSOR_TIMEOUT;
}

uint16_t nextEnrollmentSlot() {
  finger.getTemplateCount();
  if (finger.templateCount >= MAX_FINGERPRINT_SLOTS) {
    return 0;
  }

  return static_cast<uint16_t>(finger.templateCount + 1);
}

void publishSensorError(const char *message) {
  publishEvent("ERROR", activeRequestId, String(), message);
  publishStatus("ERROR", message);
  showDisplayError(message, nullptr);
}

void publishSensorError(const String &message) {
  publishSensorError(message.c_str());
}

void flushFingerprintSerialBuffer() {
  fingerprintSerial.listen();
  while (fingerprintSerial.available() > 0) {
    fingerprintSerial.read();
  }
}

bool beginFingerprintSensor() {
  if (tryBeginFingerprintSensorAtBaud(DEFAULT_FINGER_SENSOR_BAUD)) {
    return true;
  }

  if (DEFAULT_FINGER_SENSOR_BAUD != FALLBACK_FINGER_SENSOR_BAUD &&
      tryBeginFingerprintSensorAtBaud(FALLBACK_FINGER_SENSOR_BAUD)) {
    logSensorStep("fingerprint:legacy-baud", String("baud=") + FALLBACK_FINGER_SENSOR_BAUD);
    return true;
  }

  return false;
}

bool tryBeginFingerprintSensorAtBaud(uint32_t baudRate) {
  fingerprintSerial.begin(baudRate);
  fingerprintSerial.listen();
  finger.begin(baudRate);
  flushFingerprintSerialBuffer();
  processSensorCriticalLoop(SENSOR_INIT_VERIFY_DELAY_MS);

  for (uint8_t attempt = 1; attempt <= SENSOR_INIT_VERIFY_RETRIES; ++attempt) {
    fingerprintSerial.listen();
    if (finger.verifyPassword()) {
      activeFingerSensorBaud = baudRate;
      logSensorStep("fingerprint:init-ok", String("baud=") + baudRate + " | attempt=" + attempt);
      return true;
    }

    logSensorStep("fingerprint:init-retry", String("baud=") + baudRate + " | attempt=" + attempt);
    flushFingerprintSerialBuffer();
    processSensorCriticalLoop(SENSOR_INIT_VERIFY_DELAY_MS);
  }

  logSensorStep("fingerprint:init-failed", String("baud=") + baudRate);
  return false;
}

bool resyncFingerprintSensor(const char *stepLabel) {
  (void)stepLabel;
  fingerprintSerial.begin(activeFingerSensorBaud);
  fingerprintSerial.listen();
  finger.begin(activeFingerSensorBaud);
  flushFingerprintSerialBuffer();
  processSensorCriticalLoop(8);
  return true;
}

template <typename Operation>
uint8_t retryFingerprintPacketOperation(Operation operation, const char *stepLabel) {
  uint8_t lastResult = FINGERPRINT_PACKETRECIEVEERR;

  for (uint8_t attempt = 1; attempt <= SENSOR_PACKET_RETRY_COUNT; ++attempt) {
    fingerprintSerial.listen();
    lastResult = operation();
    if (lastResult != FINGERPRINT_PACKETRECIEVEERR) {
      return lastResult;
    }

    logSensorStep(stepLabel, String("packet-retry=") + attempt);
    if (!resyncFingerprintSensor(stepLabel)) {
      return lastResult;
    }
    processSensorCriticalLoop(SENSOR_PACKET_RETRY_DELAY_MS);
  }

  return lastResult;
}

String describeCaptureError(int code) {
  switch (code) {
    case FINGERPRINT_PACKETRECIEVEERR:
      return String("Erreur de communication avec le capteur");
    case FINGERPRINT_IMAGEFAIL:
      return String("Lecture optique de l'empreinte impossible");
    case FINGERPRINT_NOFINGER:
      return String("Aucun doigt detecte sur le capteur");
    default:
      return String("Capture de l'empreinte impossible (code ") + code + ")";
  }
}

String describeConversionError(uint8_t code) {
  switch (code) {
    case FINGERPRINT_IMAGEMESS:
      return String("Image d'empreinte trop floue ou trop sale");
    case FINGERPRINT_FEATUREFAIL:
      return String("Points caracteristiques de l'empreinte introuvables");
    case FINGERPRINT_INVALIDIMAGE:
      return String("Image d'empreinte invalide");
    case FINGERPRINT_PACKETRECIEVEERR:
      return String("Erreur de communication avec le capteur");
    case FINGERPRINT_IMAGEFAIL:
      return String("Lecture optique de l'empreinte impossible");
    default:
      return String("Conversion de l'empreinte impossible (code ") + code + ")";
  }
}

void finishCommand() {
  activeRequestId = "";
  activeCommandName = "";
  cancelRequested = false;
  scannerBusy = false;
  successSignalArmed = true;
  publishStatus("IDLE", "Capteur pret");
  showIdlePrompt();
}

void handleScanCommand() {
  publishEvent("ACK", activeRequestId, String(), "Commande de lecture acceptee");
  for (uint8_t attempt = 1; attempt <= SCAN_MATCH_RETRIES; ++attempt) {
    if (attempt > 1) {
      renderDisplay(DisplayIcon::Info, "Verification", "Retirez le doigt", "un instant");
      int removalResult = waitForFingerRemoval(SCAN_RETRY_REMOVE_TIMEOUT_MS);
      if (removalResult == SENSOR_CANCELLED) {
        return;
      }
      if (removalResult != FINGERPRINT_OK) {
        publishSensorError("Finger removal timeout before scan retry");
        finishCommand();
        return;
      }
      delay(SCAN_RETRY_DELAY_MS);
    }

    if (attempt == 1) {
      showIdlePrompt();
    } else {
      renderDisplay(DisplayIcon::Info, "Verification", "Repositionnez le doigt", "et reessayez");
    }

    int imageResult = waitForFingerImage(FINGER_WAIT_TIMEOUT_MS, true);
    if (imageResult == SENSOR_CANCELLED) {
      return;
    }
    if (imageResult == SENSOR_TIMEOUT) {
      publishSensorError("Temps d'attente depasse pendant la lecture de l'empreinte");
      finishCommand();
      return;
    }
    if (imageResult != FINGERPRINT_OK) {
      if (attempt == SCAN_MATCH_RETRIES) {
        publishSensorError(String("Impossible de capturer l'image de l'empreinte: ") + describeCaptureError(imageResult));
        finishCommand();
        return;
      }
      continue;
    }

    fingerprintSerial.listen();
    holdActivitySignal();
    uint8_t convertResult = finger.image2Tz();
    if (convertResult != FINGERPRINT_OK) {
      if (attempt == SCAN_MATCH_RETRIES) {
        publishSensorError(String("Impossible d'extraire l'empreinte: ") + describeConversionError(convertResult));
        finishCommand();
        return;
      }
      renderDisplay(DisplayIcon::Error, "Lecture faible", "Replacez le doigt", "sans bouger");
      continue;
    }
    showCaptureSuccess("Image capturee", "Verification...");

    fingerprintSerial.listen();
    holdActivitySignal();
    uint8_t searchResult = finger.fingerFastSearch();
    if (searchResult == FINGERPRINT_OK) {
      publishEvent("MATCH", activeRequestId, formatFingerprintId(finger.fingerID), "Empreinte reconnue");
      successSignalArmed = true;
      showCaptureSuccess("Empreinte lue", "Confirmation OK");
      finishCommand();
      return;
    }

    if (searchResult == FINGERPRINT_NOTFOUND) {
      if (attempt == SCAN_MATCH_RETRIES) {
        publishEvent("NO_MATCH", activeRequestId, String(), "Aucune empreinte correspondante trouvee");
        showDisplayError("Empreinte inconnue", "Reessayez");
        finishCommand();
        return;
      }

      renderDisplay(DisplayIcon::Info, "Verification", "Ajustez le doigt", "et reessayez");
      continue;
    }

    if (attempt == SCAN_MATCH_RETRIES) {
      publishSensorError("La recherche de l'empreinte a echoue");
      finishCommand();
      return;
    }

    renderDisplay(DisplayIcon::Error, "Recherche echouee", "Retirez puis replacez", "le doigt");
  }
}

void handleEnrollCommand() {
  logSensorStep("handleEnrollCommand:start", String("requestId=") + activeRequestId);
  clearSignals();
  publishEvent("ACK", activeRequestId, String(), "Placez votre doigt pour scanner");

  uint16_t slotId = nextEnrollmentSlot();
  logSensorStep("handleEnrollCommand:slot", String("slotId=") + slotId);
  if (slotId == 0) {
    publishSensorError("La memoire du capteur est pleine");
    finishCommand();
    return;
  }

  bool firstTemplateReady = false;
  for (uint8_t attempt = 1; attempt <= ENROLL_CONVERT_RETRIES; ++attempt) {
    logSensorStep("enroll:single-capture:prompt", String("attempt=") + attempt);
    if (attempt == 1) {
      renderDisplay(DisplayIcon::Fingerprint, "Enrolement", "Placez votre doigt", "sans bouger");
    } else {
      renderDisplay(DisplayIcon::Info, "Enrolement", "Placez votre doigt", "bien au centre");
    }

    int capturedImage = waitForFingerImage(
      FINGER_WAIT_TIMEOUT_MS,
      true,
      ENROLL_FINGER_PRESENCE_CONFIRMATION_COUNT,
      ENROLL_FINGER_PRESENCE_CONFIRMATION_WINDOW_MS
    );
    logSensorStep("enroll:single-capture:image-result", String(capturedImage));
    if (capturedImage == SENSOR_CANCELLED) {
      return;
    }
    if (capturedImage == SENSOR_TIMEOUT) {
      publishSensorError("Temps d'attente depasse pour la capture de l'empreinte");
      finishCommand();
      return;
    }
    if (capturedImage != FINGERPRINT_OK) {
      publishSensorError(String("Impossible de capturer l'image de l'empreinte: ") + describeCaptureError(capturedImage));
      finishCommand();
      return;
    }

    fingerprintSerial.listen();
  holdActivitySignal();
    uint8_t firstConvertResult = finger.image2Tz(1);
    logSensorStep("enroll:single-capture:convert-buffer-1", String(firstConvertResult));
    if (firstConvertResult != FINGERPRINT_OK) {
      if (attempt == ENROLL_CONVERT_RETRIES) {
        publishSensorError(String("Impossible d'extraire l'empreinte: ") + describeConversionError(firstConvertResult));
        finishCommand();
        return;
      }

      renderDisplay(DisplayIcon::Error, "Image refusee", "Ajustez legerement", "puis recommencez");
      continue;
    }

    firstTemplateReady = true;
    publishEvent("IMAGE_CAPTURED", activeRequestId, String(), "Image d'empreinte capturee avec succes");
    break;
  }

  if (!firstTemplateReady) {
    publishSensorError("L'empreinte n'a pas pu etre preparee");
    finishCommand();
    return;
  }

  bool fingerRemoved = false;
  for (uint8_t attempt = 1; attempt <= ENROLL_VERIFY_RETRIES; ++attempt) {
    if (attempt == 1) {
      renderDisplay(DisplayIcon::Info, "Enrolement", "Retirez le doigt", "puis replacez-le");
    } else {
      renderDisplay(DisplayIcon::Info, "Enrolement", "Retirez completement", "le doigt maintenant");
    }

    int removalResult = waitForFingerRemoval(ENROLL_REMOVE_TIMEOUT_MS, 1);
    if (removalResult == SENSOR_CANCELLED) {
      return;
    }
    if (removalResult == FINGERPRINT_OK) {
      fingerRemoved = true;
      break;
    }
  }

  if (!fingerRemoved) {
    publishSensorError("Retrait du doigt non detecte pour l'enrolement");
    finishCommand();
    return;
  }

  renderDisplay(DisplayIcon::Fingerprint, "Enrolement", "Replacez le doigt", "comme avant");
  int secondCaptureResult = waitForFingerImage(
    FINGER_WAIT_TIMEOUT_MS,
    false,
    ENROLL_FINGER_PRESENCE_CONFIRMATION_COUNT,
    ENROLL_FINGER_PRESENCE_CONFIRMATION_WINDOW_MS
  );
  logSensorStep("enroll:second-capture:image-result", String(secondCaptureResult));
  if (secondCaptureResult == SENSOR_CANCELLED) {
    return;
  }
  if (secondCaptureResult == SENSOR_TIMEOUT) {
    publishSensorError("Temps d'attente depasse pour la seconde capture de l'empreinte");
    finishCommand();
    return;
  }
  if (secondCaptureResult != FINGERPRINT_OK) {
    publishSensorError(String("Impossible de capturer la seconde image de l'empreinte: ") + describeCaptureError(secondCaptureResult));
    finishCommand();
    return;
  }

  fingerprintSerial.listen();
  holdActivitySignal();
  uint8_t secondConvertResult = finger.image2Tz(2);
  logSensorStep("enroll:second-capture:convert-buffer-2", String(secondConvertResult));
  if (secondConvertResult != FINGERPRINT_OK) {
    publishSensorError(String("Impossible de preparer la seconde empreinte: ") + describeConversionError(secondConvertResult));
    finishCommand();
    return;
  }

  showCaptureSuccess("Captures valides", "Creation du modele");

  fingerprintSerial.listen();
  holdActivitySignal();
  if (finger.createModel() != FINGERPRINT_OK) {
    logSensorStep("enroll:create-model", "failed");
    publishSensorError("La preparation du modele d'empreinte a echoue. Recommencez l'enrolement");
    finishCommand();
    return;
  }
  logSensorStep("enroll:create-model", "ok");

  fingerprintSerial.listen();
  holdActivitySignal();
  if (finger.storeModel(slotId) != FINGERPRINT_OK) {
    logSensorStep("enroll:store-model", String("failed slot=") + slotId);
    publishSensorError("Impossible d'enregistrer le modele d'empreinte dans le capteur");
    finishCommand();
    return;
  }
  logSensorStep("enroll:store-model", String("ok slot=") + slotId);

  String templateBase64;
  if (!exportFingerprintTemplateBase64(slotId, templateBase64)) {
    publishSensorError("Le template biométrique n'a pas pu être exporté depuis le capteur");
    finishCommand();
    return;
  }

  publishEvent("ENROLLED", activeRequestId, formatFingerprintId(slotId), "Template biométrique enregistré avec succès", templateBase64);
  successSignalArmed = true;
  showCaptureSuccess("Empreinte validee", "Enregistrement OK");
  finishCommand();
}

void handlePingCommand() {
  publishEvent("ACK", activeRequestId, String(), "Verification du capteur acceptee");
  publishEvent("READY", activeRequestId, String(), "Capteur operationnel");
  finishCommand();
}

void handleRejectCommand() {
  publishEvent("ACK", activeRequestId, String(), "Refus de pointage pris en compte");
  const char *message = pendingCommand.message.length() > 0 ? pendingCommand.message.c_str() : "Pointage refuse";
  showDisplayError("Acces refuse", message);
  finishCommand();
}

void processPendingCommand() {
  if (!pendingCommand.queued || scannerBusy) {
    return;
  }

  scannerBusy = true;
  successSignalArmed = false;
  activeRequestId = pendingCommand.requestId;
  activeCommandName = pendingCommand.command;
  pendingCommand.queued = false;
  cancelRequested = false;

  if (activeCommandName == "SCAN") {
    handleScanCommand();
    return;
  }

  if (activeCommandName == "ENROLL") {
    handleEnrollCommand();
    return;
  }

  if (activeCommandName == "PING") {
    handlePingCommand();
    return;
  }

  if (activeCommandName == "REJECT") {
    handleRejectCommand();
    return;
  }

  publishSensorError("Commande non prise en charge");
  finishCommand();
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  if (strcmp(topic, commandTopic) != 0) {
    return;
  }

  String rawPayload;
  rawPayload.reserve(length);
  for (unsigned int index = 0; index < length; index += 1) {
    rawPayload += static_cast<char>(payload[index]);
  }
  logSensorStep("mqttCallback", String(topic) + " | payload=" + rawPayload);

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    publishEvent("ERROR", String(), String(), "Commande JSON invalide");
    return;
  }

  const char *version = doc["version"] | "";
  const char *command = doc["command"] | "";
  const char *requestId = doc["requestId"] | "";
  const char *mode = doc["mode"] | "";
  const char *message = doc["message"] | "";

  if (strcmp(version, "1.0") != 0 || strlen(command) == 0 || strlen(requestId) == 0) {
    publishEvent("ERROR", String(requestId), String(), "Charge utile de commande invalide");
    return;
  }

  if (strcmp(command, "CANCEL") == 0) {
    if (scannerBusy) {
      cancelRequested = true;
      return;
    }

    publishEvent("CANCELLED", String(requestId), String(), "Aucune commande active a annuler");
    return;
  }

  if (scannerBusy || pendingCommand.queued) {
    publishEvent("ERROR", String(requestId), String(), "Le capteur est deja occupe");
    return;
  }

  pendingCommand.queued = true;
  pendingCommand.command = String(command);
  pendingCommand.requestId = String(requestId);
  pendingCommand.mode = String(mode);
  pendingCommand.message = String(message);
}

void setupTopics() {
  snprintf(commandTopic, sizeof(commandTopic), "%s/command", MQTT_BASE_TOPIC);
  snprintf(eventsTopic, sizeof(eventsTopic), "%s/events", MQTT_BASE_TOPIC);
  snprintf(statusTopic, sizeof(statusTopic), "%s/status", MQTT_BASE_TOPIC);
}

void setupFingerprintSensor() {
  if (!beginFingerprintSensor()) {
    Serial.println("Fingerprint sensor init failed");
    showDisplayError("Capteur indisponible", "Verifiez RX/TX et baud");
    while (true) {
      delay(1000);
    }
  }

  finger.getTemplateCount();
  Serial.print("Capteur d'empreinte pret, gabarits: ");
  Serial.println(finger.templateCount);
  showCaptureSuccess("Capteur detecte", "Empreintes chargees");
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(100);
  setupSignals();
  setupDisplay();
  setupTopics();
  connectToWifi();
  setupFingerprintSensor();

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(MQTT_EVENT_BUFFER_SIZE);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  updateSignalOutputs();
  connectToWifi();
  if (!connectToMqtt()) {
    return;
  }

  mqttClient.loop();
  processPendingCommand();

  if (!scannerBusy && millis() - lastStatusPublishAt >= STATUS_PUBLISH_INTERVAL_MS) {
    publishStatus("IDLE", "Capteur pret");
    showIdlePrompt();
  }
}