export const MQTT_SENSOR_PROTOCOL_VERSION = '1.0';
export const DEFAULT_SENSOR_MQTT_BASE_TOPIC = 'biopresence/sensor';

export type SensorScanMode = 'attendance' | 'enrollment';
export type SensorCommandName = 'SCAN' | 'ENROLL' | 'CANCEL' | 'PING' | 'REJECT';
export type SensorEventName =
  | 'READY'
  | 'ACK'
  | 'FINGER_PLACED'
  | 'MATCH'
  | 'NO_MATCH'
  | 'ENROLLED'
  | 'CANCELLED'
  | 'ERROR';
export type SensorStatusState = 'ONLINE' | 'OFFLINE' | 'IDLE' | 'BUSY' | 'ERROR';

export interface SensorCommandMessage {
  version: typeof MQTT_SENSOR_PROTOCOL_VERSION;
  command: SensorCommandName;
  requestId: string;
  issuedAt: string;
  source: 'web-client';
  mode?: SensorScanMode;
  message?: string;
}

export interface SensorEventMessage {
  version: typeof MQTT_SENSOR_PROTOCOL_VERSION;
  event: SensorEventName;
  occurredAt: string;
  requestId?: string;
  fingerprintId?: string;
  sensorId?: string;
  message?: string;
}

export interface SensorStatusMessage {
  version: typeof MQTT_SENSOR_PROTOCOL_VERSION;
  state: SensorStatusState;
  updatedAt: string;
  sensorId?: string;
  message?: string;
  capabilities?: string[];
}

export function normalizeMqttBaseTopic(value: string | undefined, fallback = DEFAULT_SENSOR_MQTT_BASE_TOPIC): string {
  const normalized = value?.trim().replace(/\/+$/, '');
  return normalized && normalized.length > 0 ? normalized : fallback;
}

export function buildSensorTopics(baseTopic: string) {
  return {
    commandTopic: `${baseTopic}/command`,
    eventsTopic: `${baseTopic}/events`,
    statusTopic: `${baseTopic}/status`,
  };
}

export function buildSensorCommandMessage(
  command: SensorCommandName,
  requestId: string,
  mode?: SensorScanMode,
  message?: string
): SensorCommandMessage {
  return {
    version: MQTT_SENSOR_PROTOCOL_VERSION,
    command,
    requestId,
    issuedAt: new Date().toISOString(),
    source: 'web-client',
    mode,
    message,
  };
}

export function isSensorEventMessage(value: unknown): value is SensorEventMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SensorEventMessage>;
  return typeof candidate.event === 'string' && typeof candidate.occurredAt === 'string';
}

export function isSensorStatusMessage(value: unknown): value is SensorStatusMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SensorStatusMessage>;
  return typeof candidate.state === 'string' && typeof candidate.updatedAt === 'string';
}