import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';

import {
  buildSensorCommandMessage,
  buildSensorTopics,
  DEFAULT_SENSOR_MQTT_BASE_TOPIC,
  isSensorEventMessage,
  isSensorStatusMessage,
  MQTT_SENSOR_PROTOCOL_VERSION,
  normalizeMqttBaseTopic,
  type SensorCommandName,
  type SensorEventMessage,
  type SensorScanMode,
  type SensorStatusMessage,
} from './mqttSensorProtocol';
import { createUuid } from './utils';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
type ConnectionListener = (state: ConnectionState) => void;
export type SensorProgressEvent = Pick<SensorEventMessage, 'event' | 'message' | 'requestId' | 'fingerprintId' | 'sensorId'>;
type SensorProgressListener = (event: SensorProgressEvent) => void;

interface SensorMqttConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientIdPrefix: string;
  expectedSensorId: string;
  commandTopic: string;
  eventsTopic: string;
  statusTopic: string;
}

const SENSOR_AVAILABILITY_TIMEOUT_MS = 5_000;

function isMqttDebugEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem('biopresence:mqtt-debug') === '1';
  } catch {
    return false;
  }
}

function logMqttDebug(scope: string, payload: Record<string, unknown>): void {
  if (!isMqttDebugEnabled()) {
    return;
  }

  console.info(`[BioPresence MQTT] ${scope}`, payload);
}

function isOperationalStatus(state: SensorStatusMessage['state'] | undefined): boolean {
  return state === 'ONLINE' || state === 'IDLE' || state === 'BUSY';
}

function buildDefaultBrokerUrl(): string {
  // En local, le front se branche automatiquement sur le broker WebSocket attendu par la stack MQTT.
  if (typeof window === 'undefined') {
    return 'ws://localhost:9001/mqtt';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:9001/mqtt`;
}

function getMqttConfig(): SensorMqttConfig {
  // Toute la config MQTT reste pilotable par variables d'environnement avec des valeurs sûres par défaut.
  const baseTopic = normalizeMqttBaseTopic(
    import.meta.env.VITE_MQTT_BASE_TOPIC as string | undefined,
    DEFAULT_SENSOR_MQTT_BASE_TOPIC
  );
  const topics = buildSensorTopics(baseTopic);

  return {
    brokerUrl: (import.meta.env.VITE_MQTT_BROKER_URL as string | undefined)?.trim() || buildDefaultBrokerUrl(),
    username: (import.meta.env.VITE_MQTT_USERNAME as string | undefined)?.trim() || undefined,
    password: (import.meta.env.VITE_MQTT_PASSWORD as string | undefined)?.trim() || undefined,
    clientIdPrefix: (import.meta.env.VITE_MQTT_CLIENT_ID_PREFIX as string | undefined)?.trim() || 'biopresence-web',
    expectedSensorId: (import.meta.env.VITE_MQTT_SENSOR_ID as string | undefined)?.trim() || 'nodemcu-esp8266-v1',
    commandTopic: (import.meta.env.VITE_MQTT_COMMAND_TOPIC as string | undefined)?.trim() || topics.commandTopic,
    eventsTopic: (import.meta.env.VITE_MQTT_EVENTS_TOPIC as string | undefined)?.trim() || topics.eventsTopic,
    statusTopic: (import.meta.env.VITE_MQTT_STATUS_TOPIC as string | undefined)?.trim() || topics.statusTopic,
  };
}

class SerialSensorService {
  private client: MqttClient | null = null;
  private config = getMqttConfig();
  private _state: ConnectionState = 'disconnected';
  private listeners = new Set<ConnectionListener>();
  private progressListeners = new Set<SensorProgressListener>();
  private activeSensorId: string | null = null;
  private pendingResolve: ((id: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private pendingRequestId: string | null = null;
  private lastStatus: SensorStatusMessage | null = null;
  private availabilityResolve: (() => void) | null = null;
  private availabilityReject: ((err: Error) => void) | null = null;
  private availabilityRequestId: string | null = null;

  get state(): ConnectionState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === 'connected';
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onProgress(listener: SensorProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private setState(state: ConnectionState): void {
    // Chaque changement d'état est diffusé aux écrans qui affichent la santé du capteur.
    this._state = state;
    this.listeners.forEach((listener) => listener(state));
  }

  private emitProgress(event: SensorProgressEvent): void {
    this.progressListeners.forEach((listener) => listener(event));
  }

  getSupportError(): string | null {
    // Je remonte ici les causes connues qui empêchent la connexion avant même d'essayer MQTT.
    if (typeof window === 'undefined') {
      return 'Client MQTT indisponible dans cet environnement.';
    }

    if (!this.config.brokerUrl) {
      return 'URL du broker MQTT non configurée.';
    }

    return null;
  }

  getLastStatus(): SensorStatusMessage | null {
    return this.lastStatus;
  }

  getExpectedSensorId(): string {
    return this.config.expectedSensorId;
  }

  private isExpectedSensor(sensorId: string | undefined): boolean {
    // Le client n'accepte que le capteur attendu pour éviter un routage accidentel sur un autre appareil.
    if (!sensorId || sensorId.trim().length === 0) {
      return false;
    }

    if (sensorId !== this.config.expectedSensorId) {
      return false;
    }

    if (!this.activeSensorId) {
      return true;
    }

    return sensorId === this.activeSensorId;
  }

  private selectActiveSensor(sensorId: string | undefined): boolean {
    if (!this.isExpectedSensor(sensorId)) {
      return false;
    }

    this.activeSensorId = sensorId ?? null;

    return true;
  }

  async connect(): Promise<void> {
    // La connexion est volontairement explicite pour donner un feedback utilisateur clair.
    const supportError = this.getSupportError();
    if (supportError) {
      throw new Error(supportError);
    }

    if (this._state !== 'disconnected') {
      return;
    }

    this.config = getMqttConfig();
    this.activeSensorId = null;
    this.lastStatus = null;
    this.setState('connecting');

    await new Promise<void>((resolve, reject) => {
      const options: IClientOptions = {
        username: this.config.username,
        password: this.config.password,
        reconnectPeriod: 0,
        clientId: `${this.config.clientIdPrefix}-${Math.random().toString(16).slice(2, 10)}`,
      };

      const client = mqtt.connect(this.config.brokerUrl, options);
      this.client = client;
      logMqttDebug('connect:start', {
        brokerUrl: this.config.brokerUrl,
        expectedSensorId: this.config.expectedSensorId,
        commandTopic: this.config.commandTopic,
        eventsTopic: this.config.eventsTopic,
        statusTopic: this.config.statusTopic,
        clientId: options.clientId,
      });

      const cleanup = () => {
        client.off('connect', handleConnect);
        client.off('error', handleError);
      };

      const handleConnect = () => {
        cleanup();
        client.on('message', this.handleMessage);
        client.on('close', this.handleClose);
        client.subscribe([this.config.eventsTopic, this.config.statusTopic], async (err) => {
          if (err) {
            this.handleFatalError(new Error(`Abonnement MQTT impossible: ${err.message}`));
            reject(err);
            return;
          }

          try {
            // Une fois connecté au broker, je vérifie encore que le capteur ciblé répond vraiment.
            await this.ensureSensorAvailable(SENSOR_AVAILABILITY_TIMEOUT_MS, true);
            this.setState('connected');
            resolve();
          } catch (error) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            this.handleFatalError(normalizedError);
            reject(normalizedError);
          }
        });
      };

      const handleError = (error: Error) => {
        cleanup();
        this.handleFatalError(new Error(`Connexion MQTT impossible: ${error.message}`));
        reject(error);
      };

      client.once('connect', handleConnect);
      client.once('error', handleError);
    });
  }

  async disconnect(): Promise<void> {
    // La déconnexion force aussi l'annulation des scans et des vérifications en attente.
    this.cancelPending(new Error('Capteur MQTT déconnecté manuellement.'));
    this.cancelAvailabilityCheck(new Error('Vérification du capteur interrompue.'));
    const client = this.client;
    this.client = null;
    this.activeSensorId = null;
    this.lastStatus = null;

    if (!client) {
      this.setState('disconnected');
      return;
    }

    await new Promise<void>((resolve) => {
      client.removeListener('message', this.handleMessage);
      client.removeListener('close', this.handleClose);
      client.end(true, {}, () => resolve());
    });

    this.setState('disconnected');
  }

  private handleClose = () => {
    // Une fermeture réseau ramène systématiquement le service à un état propre et notifie l'UI.
    if (this._state === 'disconnected') {
      return;
    }

    this.client?.removeListener('message', this.handleMessage);
    this.client = null;
    this.activeSensorId = null;
    this.lastStatus = null;
    this.setState('disconnected');
    this.cancelPending(new Error('Connexion MQTT au capteur perdue.'));
    this.cancelAvailabilityCheck(new Error('Le capteur MQTT n\'est plus joignable.'));
  };

  private handleFatalError(error: Error): void {
    this.client?.removeListener('message', this.handleMessage);
    this.client?.removeListener('close', this.handleClose);
    this.client?.end(true);
    this.client = null;
    this.activeSensorId = null;
    this.lastStatus = null;
    this.setState('disconnected');
    this.cancelPending(error);
    this.cancelAvailabilityCheck(error);
  }

  private handleMessage = (topic: string, payload: Uint8Array) => {
    // Je sépare d'abord les messages de statut des événements de scan pour simplifier leur traitement.
    if (topic === this.config.statusTopic) {
      this.handleStatusMessage(payload);
      return;
    }

    if (topic !== this.config.eventsTopic) {
      return;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(new TextDecoder().decode(payload)) as unknown;
    } catch {
      return;
    }

    if (!isSensorEventMessage(decoded)) {
      return;
    }

    const event = decoded as SensorEventMessage;
    if (event.version !== MQTT_SENSOR_PROTOCOL_VERSION) {
      return;
    }

    logMqttDebug('event:received', {
      topic,
      event: event.event,
      requestId: event.requestId ?? null,
      pendingRequestId: this.pendingRequestId,
      availabilityRequestId: this.availabilityRequestId,
      fingerprintId: event.fingerprintId ?? null,
      sensorId: event.sensorId ?? null,
      message: event.message ?? null,
    });

    if (this.availabilityRequestId && event.requestId === this.availabilityRequestId) {
      if (event.event === 'ACK' || event.event === 'READY') {
        if (this.selectActiveSensor(event.sensorId)) {
          this.resolveAvailabilityCheck();
        }
      } else if (event.event === 'ERROR') {
        this.cancelAvailabilityCheck(new Error(event.message || 'Le capteur MQTT a refusé la vérification de disponibilité.'));
      }
    }

    if (!this.isExpectedSensor(event.sensorId)) {
      logMqttDebug('event:ignored-unexpected-sensor', {
        event: event.event,
        requestId: event.requestId ?? null,
        sensorId: event.sensorId ?? null,
        expectedSensorId: this.config.expectedSensorId,
        activeSensorId: this.activeSensorId,
      });
      return;
    }

    if (this.pendingRequestId && event.requestId && event.requestId !== this.pendingRequestId) {
      logMqttDebug('event:ignored-other-request', {
        event: event.event,
        requestId: event.requestId,
        pendingRequestId: this.pendingRequestId,
      });
      return;
    }

    if (this.pendingRequestId && event.requestId !== this.pendingRequestId) {
      logMqttDebug('event:ignored-missing-or-mismatched-request', {
        event: event.event,
        requestId: event.requestId ?? null,
        pendingRequestId: this.pendingRequestId,
      });
      return;
    }

    if (this.pendingRequestId && event.requestId === this.pendingRequestId) {
      // Les écrans reçoivent les étapes intermédiaires du scan pour afficher une progression lisible.
      this.emitProgress({
        event: event.event,
        message: event.message,
        requestId: event.requestId,
        fingerprintId: event.fingerprintId,
        sensorId: event.sensorId,
      });
    }

    switch (event.event) {
      case 'MATCH':
      case 'ENROLLED':
        // Un scan réussi résout la promesse avec l'identifiant d'empreinte renvoyé par le capteur.
        if (!event.fingerprintId) {
          this.pendingReject?.(new Error('Réponse MQTT invalide: fingerprintId manquant.'));
          this.clearPending();
          break;
        }

        this.pendingResolve?.(event.fingerprintId);
        this.clearPending();
        break;
      case 'NO_MATCH':
        this.pendingReject?.(new Error('Empreinte non reconnue.'));
        this.clearPending();
        break;
      case 'CANCELLED':
        this.pendingReject?.(new Error(event.message || 'Scan annulé par le capteur.'));
        this.clearPending();
        break;
      case 'ERROR':
        this.pendingReject?.(new Error(event.message || 'Erreur capteur MQTT.'));
        this.clearPending();
        break;
      default:
        break;
    }
  };

  private clearPending(): void {
    this.pendingResolve = null;
    this.pendingReject = null;
    this.pendingRequestId = null;
  }

  private clearAvailabilityCheck(): void {
    this.availabilityResolve = null;
    this.availabilityReject = null;
    this.availabilityRequestId = null;
  }

  private resolveAvailabilityCheck(): void {
    this.availabilityResolve?.();
    this.clearAvailabilityCheck();
  }

  private cancelAvailabilityCheck(error: Error): void {
    this.availabilityReject?.(error);
    this.clearAvailabilityCheck();
  }

  private cancelPending(error: Error): void {
    this.pendingReject?.(error);
    this.clearPending();
  }

  private handleStatusMessage(payload: Uint8Array): void {
    let decoded: unknown;
    try {
      decoded = JSON.parse(new TextDecoder().decode(payload)) as unknown;
    } catch {
      return;
    }

    if (!isSensorStatusMessage(decoded)) {
      return;
    }

    if (decoded.version !== MQTT_SENSOR_PROTOCOL_VERSION) {
      return;
    }

    logMqttDebug('status:received', {
      state: decoded.state,
      sensorId: decoded.sensorId ?? null,
      message: decoded.message ?? null,
      availabilityRequestId: this.availabilityRequestId,
      activeSensorId: this.activeSensorId,
    });

    if (this.activeSensorId && decoded.sensorId && decoded.sensorId !== this.activeSensorId) {
      return;
    }

    this.lastStatus = decoded;

    if (isOperationalStatus(decoded.state) && !this.availabilityRequestId) {
      if (this.selectActiveSensor(decoded.sensorId)) {
        this.resolveAvailabilityCheck();
      }
      return;
    }

    if ((decoded.state === 'OFFLINE' || decoded.state === 'ERROR') && this.availabilityReject) {
      this.cancelAvailabilityCheck(new Error(decoded.message || 'Le capteur biométrique est hors ligne ou en erreur.'));
    }
  }

  private async publishRawCommand(
    command: SensorCommandName,
    requestId: string,
    mode?: SensorScanMode
  ): Promise<void> {
    if (!this.client || (this._state !== 'connecting' && this._state !== 'connected')) {
      throw new Error('Capteur MQTT non connecté. Vérifiez le broker et l\'agent matériel.');
    }

    await new Promise<void>((resolve, reject) => {
      const payload = JSON.stringify(buildSensorCommandMessage(command, requestId, mode));
      logMqttDebug('command:publish', {
        command,
        requestId,
        mode: mode ?? null,
        topic: this.config.commandTopic,
        payload,
      });
      this.client?.publish(this.config.commandTopic, payload, { qos: 1 }, (error) => {
        if (error) {
          reject(new Error(`Publication MQTT impossible: ${error.message}`));
          return;
        }

        resolve();
      });
    });
  }

  private async ensureSensorAvailable(timeoutMs = SENSOR_AVAILABILITY_TIMEOUT_MS, forcePing = false): Promise<void> {
    if (!forcePing && isOperationalStatus(this.lastStatus?.state)) {
      return;
    }

    if (this.availabilityResolve) {
      throw new Error('Une vérification du capteur est déjà en cours.');
    }

    await new Promise<void>((resolve, reject) => {
      const requestId = createUuid();
      const timer = window.setTimeout(() => {
        this.cancelAvailabilityCheck(
          new Error(`Capteur introuvable. Vérifiez que le capteur est allumé et connecté au même réseau.`)
        );
      }, timeoutMs);

      this.availabilityRequestId = requestId;
      this.availabilityResolve = () => {
        window.clearTimeout(timer);
        resolve();
      };
      this.availabilityReject = (error) => {
        window.clearTimeout(timer);
        reject(error);
      };

      this.publishRawCommand('PING', requestId).catch((error: unknown) => {
        window.clearTimeout(timer);
        this.clearAvailabilityCheck();
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  private async publishCommand(
    command: SensorCommandName,
    requestId: string,
    mode?: SensorScanMode
  ): Promise<void> {
    if (!this.client || this._state !== 'connected') {
      throw new Error('Capteur MQTT non connecté. Vérifiez le broker et l\'agent matériel.');
    }

    await this.publishRawCommand(command, requestId, mode);
  }

  async scan(mode: SensorScanMode, timeoutMs = 30_000): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Capteur MQTT non connecté. Connectez le système au capteur d\'abord.');
    }

    if (this.pendingResolve) {
      throw new Error('Un scan est déjà en cours.');
    }

    await this.ensureSensorAvailable(SENSOR_AVAILABILITY_TIMEOUT_MS, true);

    return new Promise<string>((resolve, reject) => {
      const requestId = createUuid();
      const timer = window.setTimeout(() => {
        this.cancelPending(new Error('Temps d\'attente dépassé. Aucun évènement MQTT du capteur n\'a été reçu.'));
      }, timeoutMs);

      this.pendingRequestId = requestId;
      this.pendingResolve = (id) => {
        window.clearTimeout(timer);
        resolve(id);
      };

      this.pendingReject = (error) => {
        window.clearTimeout(timer);
        reject(error);
      };

      const command: SensorCommandName = mode === 'enrollment' ? 'ENROLL' : 'SCAN';
      this.publishCommand(command, requestId, mode).catch((error: unknown) => {
        window.clearTimeout(timer);
        this.clearPending();
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  async cancelScan(): Promise<void> {
    if (!this.client || this._state !== 'connected' || !this.pendingRequestId) {
      return;
    }

    await this.publishRawCommand('CANCEL', createUuid());
  }

  async reportRejectedScan(message?: string): Promise<void> {
    if (!this.client || this._state !== 'connected') {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const requestId = createUuid();
      const payload = JSON.stringify(buildSensorCommandMessage('REJECT', requestId, undefined, message));
      this.client?.publish(this.config.commandTopic, payload, { qos: 1 }, (error) => {
        if (error) {
          reject(new Error(`Publication MQTT impossible: ${error.message}`));
          return;
        }

        resolve();
      });
    });
  }
}

export const serialSensor = new SerialSensorService();
