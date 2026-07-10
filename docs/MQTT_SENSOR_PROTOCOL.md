# Protocole MQTT du capteur BioPresence

Ce document définit le contrat MQTT utilisé entre:
- le frontend BioPresence
- la passerelle ou firmware du capteur biométrique
- tout backend ou service intermédiaire qui souhaiterait observer ou relayer les événements

La source de vérité du contrat côté frontend est [Frontend/client/src/lib/mqttSensorProtocol.ts](Frontend/client/src/lib/mqttSensorProtocol.ts).

## Version

Version actuelle du protocole: `1.0`

Chaque message JSON publié sur les topics `command`, `events` et `status` doit contenir:
- `version`: `"1.0"`

## Broker WebSocket

Par défaut, le frontend tente de se connecter à:
- `ws://<host-courant>:9001/mqtt`
- ou `wss://<host-courant>:9001/mqtt` si l'application est servie en HTTPS

Variables d'environnement acceptées côté frontend:
- `VITE_MQTT_BROKER_URL`
- `VITE_MQTT_USERNAME`
- `VITE_MQTT_PASSWORD`
- `VITE_MQTT_CLIENT_ID_PREFIX`
- `VITE_MQTT_BASE_TOPIC`
- `VITE_MQTT_COMMAND_TOPIC`
- `VITE_MQTT_EVENTS_TOPIC`
- `VITE_MQTT_STATUS_TOPIC`

## Topics par défaut

Base topic par défaut:
- `biopresence/sensor`

Topics dérivés:
- `biopresence/sensor/command`
- `biopresence/sensor/events`
- `biopresence/sensor/status`

## Règles générales

- Les messages doivent être du JSON UTF-8 valide.
- Les dates doivent être au format ISO 8601.
- Les publications de commande devraient être en QoS 1.
- Les événements terminaux doivent réutiliser le `requestId` de la commande initiale.
- Un scan ne doit être considéré terminé qu'après un événement terminal:
  - `MATCH`
  - `NO_MATCH`
  - `ENROLLED`
  - `CANCELLED`
  - `ERROR`
- Le topic `status` devrait idéalement être publié en retained message par la passerelle du capteur.

## Topic `command`

Le frontend publie les commandes vers le capteur sur le topic `command`.

### Schéma

```json
{
  "version": "1.0",
  "command": "SCAN",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "issuedAt": "2026-07-02T16:40:21.881Z",
  "source": "web-client",
  "mode": "attendance"
}
```

### Champs

- `command`: `SCAN` | `ENROLL` | `CANCEL` | `PING`
- `requestId`: identifiant unique de corrélation
- `issuedAt`: date d'émission
- `source`: toujours `web-client` côté frontend actuel
- `mode`: `attendance` ou `enrollment` quand pertinent

### Sémantique

- `SCAN`: lancer une lecture d'empreinte pour présence
- `ENROLL`: lancer une lecture d'empreinte pour enrôlement
- `CANCEL`: annuler l'opération en cours
- `PING`: vérifier la disponibilité logique de la passerelle

## Topic `events`

La passerelle ou le firmware publie sur `events` les événements liés aux scans.

### Événements possibles

- `READY`
- `ACK`
- `FINGER_PLACED`
- `MATCH`
- `NO_MATCH`
- `ENROLLED`
- `CANCELLED`
- `ERROR`

### Schéma général

```json
{
  "version": "1.0",
  "event": "MATCH",
  "occurredAt": "2026-07-02T16:40:24.104Z",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "fingerprintId": "FP-ETU-00042",
  "sensorId": "esp32-lab-a",
  "message": "Empreinte reconnue"
}
```

### Champs

- `event`: type d'événement
- `occurredAt`: date de production de l'événement
- `requestId`: obligatoire pour tout événement corrélé à une commande en cours
- `fingerprintId`: obligatoire pour `MATCH` et `ENROLLED`
- `sensorId`: identifiant matériel ou logique du capteur
- `message`: message d'information ou d'erreur

### Événements terminaux attendus par le frontend

#### `MATCH`

```json
{
  "version": "1.0",
  "event": "MATCH",
  "occurredAt": "2026-07-02T16:40:24.104Z",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "fingerprintId": "FP-ETU-00042",
  "sensorId": "esp32-lab-a"
}
```

Effet côté frontend:
- la promesse de scan est résolue avec `fingerprintId`

#### `ENROLLED`

```json
{
  "version": "1.0",
  "event": "ENROLLED",
  "occurredAt": "2026-07-02T16:41:13.004Z",
  "requestId": "e8b4b132-7a5f-44cf-9df4-6f0d8363e666",
  "fingerprintId": "FP-ETU-00042",
  "sensorId": "esp32-lab-a"
}
```

Effet côté frontend:
- la promesse d'enrôlement est résolue avec `fingerprintId`

#### `NO_MATCH`

```json
{
  "version": "1.0",
  "event": "NO_MATCH",
  "occurredAt": "2026-07-02T16:40:24.104Z",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "sensorId": "esp32-lab-a",
  "message": "Aucune empreinte correspondante"
}
```

Effet côté frontend:
- rejet du scan avec le message `Empreinte non reconnue.`

#### `CANCELLED`

```json
{
  "version": "1.0",
  "event": "CANCELLED",
  "occurredAt": "2026-07-02T16:40:24.104Z",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "sensorId": "esp32-lab-a",
  "message": "Opération annulée"
}
```

Effet côté frontend:
- rejet du scan avec le message fourni

#### `ERROR`

```json
{
  "version": "1.0",
  "event": "ERROR",
  "occurredAt": "2026-07-02T16:40:24.104Z",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "sensorId": "esp32-lab-a",
  "message": "Capteur indisponible"
}
```

Effet côté frontend:
- rejet du scan avec le message fourni

### Événements intermédiaires recommandés

#### `ACK`

Indique que la commande a été reçue et acceptée.

```json
{
  "version": "1.0",
  "event": "ACK",
  "occurredAt": "2026-07-02T16:40:22.012Z",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "sensorId": "esp32-lab-a",
  "message": "Commande SCAN acceptée"
}
```

#### `READY`

Indique que le capteur est prêt à recevoir une empreinte.

```json
{
  "version": "1.0",
  "event": "READY",
  "occurredAt": "2026-07-02T16:40:22.500Z",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "sensorId": "esp32-lab-a",
  "message": "Placez votre doigt"
}
```

#### `FINGER_PLACED`

Indique qu'une empreinte a été détectée physiquement.

```json
{
  "version": "1.0",
  "event": "FINGER_PLACED",
  "occurredAt": "2026-07-02T16:40:23.100Z",
  "requestId": "c5d5d10a-87f0-4973-9855-5a4fe7f57bb8",
  "sensorId": "esp32-lab-a"
}
```

## Topic `status`

La passerelle publie l'état courant du capteur sur `status`.

### Schéma

```json
{
  "version": "1.0",
  "state": "IDLE",
  "updatedAt": "2026-07-02T16:39:59.000Z",
  "sensorId": "esp32-lab-a",
  "message": "Capteur prêt",
  "capabilities": ["scan", "enroll"]
}
```

### États possibles

- `ONLINE`
- `OFFLINE`
- `IDLE`
- `BUSY`
- `ERROR`

## Flux attendu

### Scan de présence

1. Le frontend publie `SCAN` avec `requestId`.
2. La passerelle peut publier `ACK`.
3. La passerelle peut publier `READY` puis `FINGER_PLACED`.
4. La passerelle publie un événement terminal `MATCH`, `NO_MATCH`, `CANCELLED` ou `ERROR`.
5. Le frontend résout ou rejette l'opération selon l'événement terminal reçu.

### Enrôlement

1. Le frontend publie `ENROLL` avec `requestId`.
2. La passerelle peut publier `ACK`.
3. La passerelle peut publier `READY` puis `FINGER_PLACED`.
4. La passerelle publie `ENROLLED`, `CANCELLED` ou `ERROR`.
5. Le frontend récupère `fingerprintId` depuis `ENROLLED`.

## Règles pour la passerelle du capteur

- Réutiliser strictement le `requestId` reçu.
- Publier `fingerprintId` pour `MATCH` et `ENROLLED`.
- Publier un `ERROR` explicite plutôt que de rester silencieux en cas d'échec matériel.
- Publier régulièrement `status` pour permettre au système d'observer l'état réel du capteur.
- Ne pas mélanger deux opérations simultanées avec le même `requestId`.

## Règles côté frontend actuel

Le frontend actuel:
- s'abonne à `events` et `status`
- ignore les messages dont la `version` n'est pas `1.0`
- ignore un événement si son `requestId` ne correspond pas au scan en attente
- attend au maximum 30 secondes avant timeout

## Références de code

- Contrat typé: [client/src/lib/mqttSensorProtocol.ts](client/src/lib/mqttSensorProtocol.ts)
- Consommateur MQTT frontend: [client/src/lib/serialSensor.ts](client/src/lib/serialSensor.ts)
- Point d'entrée biométrique: [client/src/lib/biometricSensor.ts](client/src/lib/biometricSensor.ts)
