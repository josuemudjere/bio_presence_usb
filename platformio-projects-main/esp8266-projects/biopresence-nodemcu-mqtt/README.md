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

## Limitation actuelle

Le capteur R307/Adafruit stocke un template par slot. Donc un doigt distinct correspond a un ID distinct.

Avec le modele de donnees actuel de BioPresence:

- l'enrolement d'un premier doigt est synchronise
- le multi-doigts pour un meme etudiant n'est pas encore correctement mappe dans l'application

Pour supporter proprement plusieurs doigts par etudiant, il faudra faire evoluer le backend et le frontend pour stocker plusieurs `fingerprintTemplateId` par etudiant.

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

- `57600`
