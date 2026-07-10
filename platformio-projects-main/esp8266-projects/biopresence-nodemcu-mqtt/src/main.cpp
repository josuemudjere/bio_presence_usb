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
constexpr char WIFI_PASSWORD[] = "jomu@2026";

constexpr char MQTT_HOST[] = "172.20.10.2";
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
constexpr uint32_t FINGER_SENSOR_BAUD = 57600;
constexpr uint32_t WIFI_RETRY_DELAY_MS = 500;
constexpr uint32_t MQTT_RETRY_DELAY_MS = 2000;
constexpr uint32_t STATUS_PUBLISH_INTERVAL_MS = 15000;
constexpr uint32_t FINGER_WAIT_TIMEOUT_MS = 30000;
constexpr uint32_t REMOVE_FINGER_TIMEOUT_MS = 10000;
constexpr uint8_t ENROLL_CONVERT_RETRIES = 3;
constexpr uint8_t CAPTURE_RECOVERY_RETRIES = 5;
constexpr uint16_t CAPTURE_RECOVERY_DELAY_MS = 120;
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
unsigned long lastStatusPublishAt = 0;
unsigned long lastIdlePromptAt = 0;
unsigned long successLedUntil = 0;
unsigned long errorLedUntil = 0;

enum class DisplayIcon {
  Fingerprint,
  Success,
  Error,
  Info,
};

void setGreenLed(bool enabled) {
  digitalWrite(GREEN_LED_PIN, enabled ? HIGH : LOW);
}

void setRedLed(bool enabled) {
  digitalWrite(RED_LED_PIN, enabled ? HIGH : LOW);
}

void clearSignals() {
  successLedUntil = 0;
  errorLedUntil = 0;
  setGreenLed(false);
  setRedLed(false);
  noTone(BUZZER_PIN);
}

void updateSignalOutputs() {
  unsigned long now = millis();
  setGreenLed(successLedUntil != 0 && now < successLedUntil);
  setRedLed(errorLedUntil != 0 && now < errorLedUntil);

  if (successLedUntil != 0 && now >= successLedUntil) {
    successLedUntil = 0;
    setGreenLed(false);
  }

  if (errorLedUntil != 0 && now >= errorLedUntil) {
    errorLedUntil = 0;
    setRedLed(false);
  }
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
  display.drawRoundRect(x, y, 28, 36, 10, SSD1306_WHITE);
  display.drawRoundRect(x + 4, y + 4, 20, 28, 8, SSD1306_WHITE);
  display.drawRoundRect(x + 8, y + 8, 12, 20, 6, SSD1306_WHITE);
  display.drawLine(x + 14, y + 6, x + 14, y + 30, SSD1306_WHITE);
  display.drawLine(x + 10, y + 12, x + 18, y + 12, SSD1306_WHITE);
  display.drawLine(x + 10, y + 18, x + 18, y + 18, SSD1306_WHITE);
  display.drawLine(x + 10, y + 24, x + 18, y + 24, SSD1306_WHITE);
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
      drawFingerprintIcon(8, 14);
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
  mqttClient.publish(statusTopic, reinterpret_cast<const uint8_t *>(payload), written, true);
  lastStatusPublishAt = millis();
}

void publishEvent(const char *eventName, const String &requestId, const String &fingerprintId, const char *message) {
  StaticJsonDocument<256> doc;
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
  if (message && message[0] != '\0') {
    doc["message"] = message;
  }

  char payload[256];
  size_t written = serializeJson(doc, payload, sizeof(payload));
  mqttClient.publish(eventsTopic, reinterpret_cast<const uint8_t *>(payload), written, false);
}

void processNetwork() {
  updateSignalOutputs();
  mqttClient.loop();
  yield();
  delay(10);
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
  Serial.printf("Connecting to MQTT broker %s:%u\n", MQTT_HOST, MQTT_PORT);
  successSignalArmed = false;
  bool connected;
  if (strlen(MQTT_USERNAME) > 0) {
    connected = mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD);
  } else {
    connected = mqttClient.connect(clientId.c_str());
  }

  if (!connected) {
    Serial.print("MQTT connection failed, rc=");
    Serial.println(mqttClient.state());
    renderDisplay(DisplayIcon::Error, "Broker MQTT", "Connexion impossible", "Nouvel essai...");
    playErrorSignal();
    delay(MQTT_RETRY_DELAY_MS);
    return false;
  }

  if (!mqttClient.subscribe(commandTopic, 1)) {
    Serial.println("Failed to subscribe to command topic");
  }
  playSuccessSignal();
  publishStatus("ONLINE", "MQTT connected");
  publishStatus("IDLE", "Sensor ready");
  showIdlePrompt();
  return true;
}

bool checkCancellation() {
  processNetwork();
  if (!cancelRequested) {
    return false;
  }

  publishEvent("CANCELLED", activeRequestId, String(), "Operation cancelled");
  publishStatus("IDLE", "Sensor ready");
  showDisplayError("Operation annulee", "par le systeme");
  cancelRequested = false;
  activeRequestId = "";
  activeCommandName = "";
  scannerBusy = false;
  return true;
}

int waitForFingerImage(uint32_t timeoutMs, bool publishFingerPlaced) {
  unsigned long startAt = millis();
  uint8_t recoverableErrorCount = 0;

  while (millis() - startAt < timeoutMs) {
    if (checkCancellation()) {
      return SENSOR_CANCELLED;
    }

    uint8_t result = finger.getImage();
    if (result == FINGERPRINT_OK) {
      recoverableErrorCount = 0;
      showScanningPrompt();
      if (publishFingerPlaced) {
        publishEvent("FINGER_PLACED", activeRequestId, String(), "Finger detected");
      }
      return FINGERPRINT_OK;
    }

    if (result == FINGERPRINT_NOFINGER) {
      recoverableErrorCount = 0;
      if (millis() - lastIdlePromptAt >= 1200) {
        showIdlePrompt();
      }
      processNetwork();
      continue;
    }

    if (result == FINGERPRINT_PACKETRECIEVEERR || result == FINGERPRINT_IMAGEFAIL) {
      recoverableErrorCount += 1;
      if (recoverableErrorCount < CAPTURE_RECOVERY_RETRIES) {
        renderDisplay(DisplayIcon::Info, "Lecture capteur", "Nouvel essai...", "Gardez le doigt fixe");
        delay(CAPTURE_RECOVERY_DELAY_MS);
        processNetwork();
        continue;
      }
    }

    return result;
  }

  return SENSOR_TIMEOUT;
}

int waitForFingerRemoval(uint32_t timeoutMs) {
  unsigned long startAt = millis();
  while (millis() - startAt < timeoutMs) {
    if (checkCancellation()) {
      return SENSOR_CANCELLED;
    }

    if (finger.getImage() == FINGERPRINT_NOFINGER) {
      return FINGERPRINT_OK;
    }
    processNetwork();
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

String describeCaptureError(int code) {
  switch (code) {
    case FINGERPRINT_PACKETRECIEVEERR:
      return String("Fingerprint communication error");
    case FINGERPRINT_IMAGEFAIL:
      return String("Fingerprint imaging error");
    case FINGERPRINT_NOFINGER:
      return String("No finger detected on sensor");
    default:
      return String("Fingerprint capture failed (code ") + code + ")";
  }
}

String describeConversionError(uint8_t code) {
  switch (code) {
    case FINGERPRINT_IMAGEMESS:
      return String("Fingerprint image too messy");
    case FINGERPRINT_FEATUREFAIL:
      return String("Fingerprint features not found");
    case FINGERPRINT_INVALIDIMAGE:
      return String("Fingerprint image invalid");
    case FINGERPRINT_PACKETRECIEVEERR:
      return String("Fingerprint communication error");
    case FINGERPRINT_IMAGEFAIL:
      return String("Fingerprint imaging error");
    default:
      return String("Fingerprint conversion failed (code ") + code + ")";
  }
}

void finishCommand() {
  activeRequestId = "";
  activeCommandName = "";
  cancelRequested = false;
  scannerBusy = false;
  successSignalArmed = true;
  publishStatus("IDLE", "Sensor ready");
  showIdlePrompt();
}

void handleScanCommand() {
  publishEvent("ACK", activeRequestId, String(), "SCAN accepted");
  for (uint8_t attempt = 1; attempt <= SCAN_MATCH_RETRIES; ++attempt) {
    if (attempt > 1) {
      publishEvent("READY", activeRequestId, String(), "Lift finger before recognition retry");
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

    publishEvent("READY", activeRequestId, String(), attempt == 1 ? "Place your finger" : "Place finger again for recognition retry");
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
      publishSensorError("Fingerprint scan timeout");
      finishCommand();
      return;
    }
    if (imageResult != FINGERPRINT_OK) {
      if (attempt == SCAN_MATCH_RETRIES) {
        publishSensorError(String("Unable to capture fingerprint image: ") + describeCaptureError(imageResult));
        finishCommand();
        return;
      }
      continue;
    }

    uint8_t convertResult = finger.image2Tz();
    if (convertResult != FINGERPRINT_OK) {
      if (attempt == SCAN_MATCH_RETRIES) {
        publishSensorError(String("Unable to convert fingerprint image: ") + describeConversionError(convertResult));
        finishCommand();
        return;
      }
      renderDisplay(DisplayIcon::Error, "Lecture faible", "Replacez le doigt", "sans bouger");
      continue;
    }
    showCaptureSuccess("Image capturee", "Verification...");

    uint8_t searchResult = finger.fingerFastSearch();
    if (searchResult == FINGERPRINT_OK) {
      publishEvent("MATCH", activeRequestId, formatFingerprintId(finger.fingerID), "Fingerprint recognized");
      successSignalArmed = true;
      showCaptureSuccess("Empreinte lue", "Confirmation OK");
      finishCommand();
      return;
    }

    if (searchResult == FINGERPRINT_NOTFOUND) {
      if (attempt == SCAN_MATCH_RETRIES) {
        publishEvent("NO_MATCH", activeRequestId, String(), "No matching fingerprint found");
        showDisplayError("Empreinte inconnue", "Reessayez");
        finishCommand();
        return;
      }

      renderDisplay(DisplayIcon::Info, "Verification", "Ajustez le doigt", "et reessayez");
      continue;
    }

    if (attempt == SCAN_MATCH_RETRIES) {
      publishSensorError("Fingerprint search failed");
      finishCommand();
      return;
    }

    renderDisplay(DisplayIcon::Error, "Recherche echouee", "Retirez puis replacez", "le doigt");
  }
}

void handleEnrollCommand() {
  publishEvent("ACK", activeRequestId, String(), "ENROLL accepted");

  uint16_t slotId = nextEnrollmentSlot();
  if (slotId == 0) {
    publishSensorError("Sensor memory is full");
    finishCommand();
    return;
  }

  bool firstTemplateReady = false;
  for (uint8_t attempt = 1; attempt <= ENROLL_CONVERT_RETRIES; ++attempt) {
    publishEvent("READY", activeRequestId, String(), attempt == 1 ? "Place finger for enrollment" : "Place finger again for a cleaner capture");
    if (attempt == 1) {
      showIdlePrompt();
    } else {
      renderDisplay(DisplayIcon::Info, "Enrolement", "Repositionnez le doigt", "et reessayez");
    }

    int firstImage = waitForFingerImage(FINGER_WAIT_TIMEOUT_MS, true);
    if (firstImage == SENSOR_CANCELLED) {
      return;
    }
    if (firstImage == SENSOR_TIMEOUT) {
      publishSensorError("First fingerprint capture timeout");
      finishCommand();
      return;
    }
    if (firstImage != FINGERPRINT_OK) {
      publishSensorError(String("Unable to capture first fingerprint image: ") + describeCaptureError(firstImage));
      finishCommand();
      return;
    }

    uint8_t firstConvertResult = finger.image2Tz(1);
    if (firstConvertResult == FINGERPRINT_OK) {
      firstTemplateReady = true;
      break;
    }

    if (attempt == ENROLL_CONVERT_RETRIES) {
      publishSensorError(String("Unable to convert first fingerprint image: ") + describeConversionError(firstConvertResult));
      finishCommand();
      return;
    }

    publishEvent("READY", activeRequestId, String(), "Lift finger and try again");
    renderDisplay(DisplayIcon::Error, "Image refusee", "Levez puis replacez", "le doigt");
    int removalRetry = waitForFingerRemoval(REMOVE_FINGER_TIMEOUT_MS);
    if (removalRetry == SENSOR_CANCELLED) {
      return;
    }
    if (removalRetry != FINGERPRINT_OK) {
      publishSensorError("Finger removal timeout before retry");
      finishCommand();
      return;
    }
  }

  if (!firstTemplateReady) {
    publishSensorError("First fingerprint template not ready");
    finishCommand();
    return;
  }
  showCaptureSuccess("Image 1 capturee", "Retirez le doigt");

  publishEvent("READY", activeRequestId, String(), "Remove finger");
  renderDisplay(DisplayIcon::Info, "Enrolement", "Retirez le doigt", "puis replacez-le");
  int removalResult = waitForFingerRemoval(REMOVE_FINGER_TIMEOUT_MS);
  if (removalResult == SENSOR_CANCELLED) {
    return;
  }
  if (removalResult != FINGERPRINT_OK) {
    publishSensorError("Finger removal timeout");
    finishCommand();
    return;
  }

  bool secondTemplateReady = false;
  for (uint8_t attempt = 1; attempt <= ENROLL_CONVERT_RETRIES; ++attempt) {
    publishEvent("READY", activeRequestId, String(), attempt == 1 ? "Place same finger again" : "Place same finger again for a cleaner capture");
    renderDisplay(DisplayIcon::Fingerprint, "Enrolement", "Replacez le doigt", attempt == 1 ? "une deuxieme fois" : "sans bouger");
    int secondImage = waitForFingerImage(FINGER_WAIT_TIMEOUT_MS, true);
    if (secondImage == SENSOR_CANCELLED) {
      return;
    }
    if (secondImage == SENSOR_TIMEOUT) {
      publishSensorError("Second fingerprint capture timeout");
      finishCommand();
      return;
    }
    if (secondImage != FINGERPRINT_OK) {
      publishSensorError(String("Unable to capture second fingerprint image: ") + describeCaptureError(secondImage));
      finishCommand();
      return;
    }

    uint8_t secondConvertResult = finger.image2Tz(2);
    if (secondConvertResult == FINGERPRINT_OK) {
      secondTemplateReady = true;
      break;
    }

    if (attempt == ENROLL_CONVERT_RETRIES) {
      publishSensorError(String("Unable to convert second fingerprint image: ") + describeConversionError(secondConvertResult));
      finishCommand();
      return;
    }

    publishEvent("READY", activeRequestId, String(), "Lift finger and place it again");
    renderDisplay(DisplayIcon::Error, "Image refusee", "Levez puis replacez", "le doigt");
    int removalRetry = waitForFingerRemoval(REMOVE_FINGER_TIMEOUT_MS);
    if (removalRetry == SENSOR_CANCELLED) {
      return;
    }
    if (removalRetry != FINGERPRINT_OK) {
      publishSensorError("Finger removal timeout before second retry");
      finishCommand();
      return;
    }
  }

  if (!secondTemplateReady) {
    publishSensorError("Second fingerprint template not ready");
    finishCommand();
    return;
  }
  showCaptureSuccess("Image 2 capturee", "Creation du modele");

  if (finger.createModel() != FINGERPRINT_OK) {
    publishSensorError("Fingerprint model creation failed");
    finishCommand();
    return;
  }

  if (finger.storeModel(slotId) != FINGERPRINT_OK) {
    publishSensorError("Unable to store fingerprint template");
    finishCommand();
    return;
  }

  publishEvent("ENROLLED", activeRequestId, formatFingerprintId(slotId), "Fingerprint enrolled");
  successSignalArmed = true;
  showCaptureSuccess("Empreinte enrolee", formatFingerprintId(slotId).c_str());
  finishCommand();
}

void handlePingCommand() {
  publishEvent("ACK", activeRequestId, String(), "PING accepted");
  publishEvent("READY", activeRequestId, String(), "Sensor alive");
  finishCommand();
}

void handleRejectCommand() {
  publishEvent("ACK", activeRequestId, String(), "REJECT accepted");
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
  publishStatus("BUSY", activeCommandName.c_str());

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

  publishSensorError("Unsupported command");
  finishCommand();
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  if (strcmp(topic, commandTopic) != 0) {
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    publishEvent("ERROR", String(), String(), "Invalid JSON command");
    return;
  }

  const char *version = doc["version"] | "";
  const char *command = doc["command"] | "";
  const char *requestId = doc["requestId"] | "";
  const char *mode = doc["mode"] | "";
  const char *message = doc["message"] | "";

  if (strcmp(version, "1.0") != 0 || strlen(command) == 0 || strlen(requestId) == 0) {
    publishEvent("ERROR", String(requestId), String(), "Invalid command payload");
    return;
  }

  if (strcmp(command, "CANCEL") == 0) {
    if (scannerBusy) {
      cancelRequested = true;
      return;
    }

    publishEvent("CANCELLED", String(requestId), String(), "No active command to cancel");
    return;
  }

  if (scannerBusy || pendingCommand.queued) {
    publishEvent("ERROR", String(requestId), String(), "Sensor is busy");
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
  fingerprintSerial.begin(FINGER_SENSOR_BAUD);
  finger.begin(FINGER_SENSOR_BAUD);

  if (!finger.verifyPassword()) {
    Serial.println("Fingerprint sensor not found");
    showDisplayError("Capteur absent", "Verifiez le cablage");
    while (true) {
      delay(1000);
    }
  }

  finger.getTemplateCount();
  Serial.print("Fingerprint sensor ready, templates: ");
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
  mqttClient.setBufferSize(512);
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
    publishStatus("IDLE", "Sensor ready");
    showIdlePrompt();
  }
}