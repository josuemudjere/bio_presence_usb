# BioPresence NodeMCU MQTT

Ce projet remplace le firmware HTTP/PHP d'origine par un firmware NodeMCU ESP8266 compatible avec le protocole MQTT de BioPresence.

## Ce que fait ce firmware

- se connecte au Wi-Fi
- se connecte au broker MQTT de BioPresence en TCP sur le port 1883
- s'abonne au topic `biopresence/sensor/command`
- publie l'etat du capteur sur `biopresence/sensor/status`
- publie les evenements de scan sur `biopresence/sensor/events`

## Commandes supportees

- `SCAN`
- `ENROLL`
- `PING`
- `CANCEL`

## Configuration a modifier avant flash

Dans [src/main.cpp](src/main.cpp), remplace:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `MQTT_HOST`
- `MQTT_PORT` si necessaire
- `MQTT_USERNAME` et `MQTT_PASSWORD` si ton broker est protege
- `SENSOR_ID` si tu veux un identifiant materiel plus parlant

## Correspondance avec le frontend

Le frontend BioPresence attend deja ce contrat MQTT:

- topic commande: `biopresence/sensor/command`
- topic evenements: `biopresence/sensor/events`
- topic statut: `biopresence/sensor/status`

Quand la page Presence est connectee au broker:

1. le frontend envoie `SCAN`
2. la carte attend un doigt sur le lecteur
3. la carte publie `FINGER_PLACED`
4. la carte publie `MATCH` ou `NO_MATCH`
5. le frontend reagit automatiquement

## Support multi-doigts cote application

Le protocole MQTT du firmware ne change pas pour supporter plusieurs doigts sur un meme etudiant.

- chaque enrôlement `ENROLL` renvoie toujours un `fingerprintId` unique
- l'association de plusieurs `fingerprintId` a un meme etudiant est maintenant geree par l'application BioPresence
- le firmware continue donc simplement a publier des identifiants individuels sur les topics existants

En pratique, cela signifie qu'un meme etudiant peut maintenant etre lie a plusieurs doigts dans l'interface d'administration, sans modification supplementaire du firmware MQTT.


## Flash avec PlatformIO

Depuis ce dossier:

```bash
pio run
pio run --target upload
pio device monitor
```

## Capteur biometrque

Pins utilises:

- D5 -> RX du module empreinte
- D6 -> TX du module empreinte

Vitesse serie du lecteur:

- preferer `19200` sur ESP8266
- le firmware detecte aussi un module encore configure en `57600` puis tente de le migrer automatiquement vers `19200`
