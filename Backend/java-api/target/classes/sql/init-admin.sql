-- Initialise le compte administrateur par defaut si aucun compte avec cet email n'existe.
-- Email: admin@usb.org
-- Mot de passe en clair a fournir a l'ecran de connexion: Josue2026

UPDATE administrateurs
SET email = 'admin@usb.org',
    password = '$2a$10$iq6q5GcbgdiPZeHFBwH0feU0Ne6HlnETiDUuBkBnO.CPHAvSXBV7i',
    niveau_acces = 'GLOBAL',
    permissions = 'GERER_UTILISATEURS,GERER_EMPREINTES,CONSULTER_LOGS'
WHERE email = 'admin@university.edu';

UPDATE administrateurs
SET password = '$2a$10$iq6q5GcbgdiPZeHFBwH0feU0Ne6HlnETiDUuBkBnO.CPHAvSXBV7i',
    niveau_acces = COALESCE(niveau_acces, 'GLOBAL'),
    permissions = COALESCE(permissions, 'GERER_UTILISATEURS,GERER_EMPREINTES,CONSULTER_LOGS')
WHERE email = 'admin@usb.org'
  AND (password = 'Josue2026' OR password IS NULL OR password = '');

INSERT INTO administrateurs (
  id,
  name,
  prenom,
  email,
  password,
  photo_url,
  niveau_acces,
  permissions,
  date_creation,
  derniere_connexion
)
SELECT
  UUID(),
  'Administrateur',
  NULL,
  'admin@usb.org',
  '$2a$10$iq6q5GcbgdiPZeHFBwH0feU0Ne6HlnETiDUuBkBnO.CPHAvSXBV7i',
  NULL,
  'GLOBAL',
  'GERER_UTILISATEURS,GERER_EMPREINTES,CONSULTER_LOGS',
  NOW(),
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM administrateurs
  WHERE email = 'admin@usb.org'
);