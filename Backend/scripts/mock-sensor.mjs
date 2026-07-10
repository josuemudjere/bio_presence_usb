import mqtt from 'mqtt';

const protocolVersion = '1.0';
const baseTopic = process.env.MQTT_BASE_TOPIC?.trim().replace(/\/+$/, '') || 'biopresence/sensor';
const brokerUrl = process.env.MQTT_BROKER_URL?.trim() || 'mqtt://127.0.0.1:1884';
const sensorId = process.env.MQTT_SENSOR_ID?.trim() || 'nodemcu-esp8266-mock';
const commandTopic = `${baseTopic}/command`;
const eventsTopic = `${baseTopic}/events`;
const statusTopic = `${baseTopic}/status`;

function publishStatus(client, state, message, capabilities = ['SCAN', 'ENROLL']) {
  client.publish(
    statusTopic,
    JSON.stringify({
      version: protocolVersion,
      state,
      updatedAt: new Date().toISOString(),
      sensorId,
      message,
      capabilities,
    }),
    { qos: 1, retain: true }
  );
}

function publishEvent(client, payload) {
  client.publish(
    eventsTopic,
    JSON.stringify({
      version: protocolVersion,
      occurredAt: new Date().toISOString(),
      sensorId,
      ...payload,
    }),
    { qos: 1 }
  );
}

const client = mqtt.connect(brokerUrl, {
  clientId: `biopresence-mock-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log(`[mock-sensor] connected to ${brokerUrl}`);
  client.subscribe(commandTopic, { qos: 1 }, (error) => {
    if (error) {
      console.error('[mock-sensor] subscribe error:', error.message);
      return;
    }

    console.log(`[mock-sensor] listening on ${commandTopic}`);
    publishStatus(client, 'IDLE', 'Mock sensor ready');
  });
});

client.on('message', (topic, payload) => {
  if (topic !== commandTopic) {
    return;
  }

  let command;
  try {
    command = JSON.parse(payload.toString('utf8'));
  } catch (error) {
    console.error('[mock-sensor] invalid JSON command');
    return;
  }

  const requestId = command?.requestId;
  const action = command?.command;
  if (!requestId || !action) {
    console.error('[mock-sensor] missing requestId or command');
    return;
  }

  console.log(`[mock-sensor] ${action} request ${requestId}`);
  publishStatus(client, 'BUSY', `${action} in progress`);
  publishEvent(client, {
    event: 'ACK',
    requestId,
    message: `Commande ${action} acceptée`,
  });

  setTimeout(() => {
    publishEvent(client, {
      event: 'READY',
      requestId,
      message: 'Placez votre doigt',
    });
  }, 300);

  setTimeout(() => {
    publishEvent(client, {
      event: 'FINGER_PLACED',
      requestId,
    });
  }, 900);

  setTimeout(() => {
    if (action === 'ENROLL') {
      publishEvent(client, {
        event: 'ENROLLED',
        requestId,
        fingerprintId: `FP-${Date.now()}`,
      });
    } else if (action === 'PING') {
      publishEvent(client, {
        event: 'READY',
        requestId,
        message: 'Mock sensor alive',
      });
    } else if (action === 'CANCEL') {
      publishEvent(client, {
        event: 'CANCELLED',
        requestId,
        message: 'Opération annulée',
      });
    } else {
      publishEvent(client, {
        event: 'MATCH',
        requestId,
        fingerprintId: 'FP-ETU-00042',
      });
    }

    publishStatus(client, 'IDLE', 'Mock sensor ready');
  }, 1600);
});

client.on('reconnect', () => {
  console.log('[mock-sensor] reconnecting...');
});

client.on('error', (error) => {
  console.error('[mock-sensor] error:', error.message);
});

client.on('close', () => {
  console.log('[mock-sensor] disconnected');
});
