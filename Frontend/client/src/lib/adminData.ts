export interface Student {
  id: string;
  name: string;
  postNom?: string;
  prenom?: string;
  matricule: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  adresse?: string;
  telephone?: string;
  department: string;
  level: string;
  coursId?: number | null;
  promotionId?: number | null;
  coursIds?: number[];
  creditCoursIds?: number[];
  photoUrl?: string;
  fingerprintRegistered: boolean;
  fingerprintTemplateIds?: string[];
  fingerprintTemplateId?: string;
  fingerprintCount?: number;
  lastFingerprintScan?: string;
  academicStatus?: 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU';
  status: 'ready' | 'pending';
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  seanceId?: number | null;
  studentName: string;
  matricule: string;
  department: string;
  dateHeure?: string;
  heureArrivee?: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  academicStatus?: 'PRESENT' | 'ABSENT' | 'RETARD' | 'EXCUSE';
  estJustifiee?: boolean;
  motifJustificatif?: string;
  modeSaisie?: 'EMPREINTE' | 'MANUELLE';
  justificatifId?: number | null;
  status: 'Ouvert' | 'Clôturé';
}

export interface CourseSettings {
  courseName: string;
  courseDays: number;
  courseHours: number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface Cours {
  id: number;
  nom: string;
  code?: string;
  intitule?: string;
  credits?: number;
  volumeHoraire?: number;
  salle?: string;
  horaire?: string;
  jourSemaine?: string;
  enseignantId?: number | null;
  departementId?: number | null;
  programmeId?: number | null;
  semestreId?: number | null;
  nbJours: number;
  nbHeures: number;
  seuilEligibilite: number;
  heureDebut?: string;
  heureFin?: string;
}

export interface Departement {
  id: number;
  nom: string;
  code: string;
}

export interface Programme {
  id: number;
  nom: string;
  code: string;
  cycle: 'LICENCE' | 'MASTER' | 'DOCTORAT';
  dureeSemestres?: number;
  totalCredits?: number;
}

export interface Promotion {
  id: number;
  nom: string;
  niveau: string;
  description?: string;
  departement: string;
  programme: string;
  coursIds: number[];
}

export interface Utilisateur {
  id: string;
  nom: string;
  email: string;
  coursId?: number | null;
  coursIds?: number[];
  photoUrl?: string;
  role: 'admin' | 'teacher';
  actif: boolean;
}

export type DepartureReason = 'maladie' | 'urgence-familiale' | 'urgence-travail';
export type DepartureStatus = 'justified' | 'absent';

export interface DepartureException {
  attendanceId: string;
  studentId: string;
  studentName: string;
  reason: DepartureReason | null; // null = aucune raison = absent
  status: DepartureStatus;
  recordedAt: string; // ISO
}

const STUDENTS_KEY = 'biopresence_students';
const ATTENDANCE_KEY = 'biopresence_attendance_records';
const EXPORTS_COUNT_KEY = 'biopresence_exports_count';
const COURSE_SETTINGS_KEY = 'biopresence_course_settings';
const DEPARTURE_EXCEPTIONS_KEY = 'biopresence_departure_exceptions';

const DEFAULT_STUDENTS: Student[] = [];
const DEFAULT_ATTENDANCE_RECORDS: AttendanceRecord[] = [];
const DEFAULT_EXPORTS_COUNT = 0;
const DEFAULT_COURSE_SETTINGS: CourseSettings = {
  courseName: '',
  courseDays: 0,
  courseHours: 0,
  startTime: '',
  endTime: '',
};

function parseJSON<T>(raw: string | null, fallback: T): T {
  // Toute lecture locale passe ici pour éviter qu'un JSON corrompu casse l'application.
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadStudents(): Student[] {
  // En SSR ou hors navigateur, je renvoie la valeur par défaut sans toucher au localStorage.
  if (typeof window === 'undefined') {
    return DEFAULT_STUDENTS;
  }

  return parseJSON<Student[]>(window.localStorage.getItem(STUDENTS_KEY), DEFAULT_STUDENTS);
}

export function saveStudents(students: Student[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
}

export function loadAttendanceRecords(): AttendanceRecord[] {
  if (typeof window === 'undefined') {
    return DEFAULT_ATTENDANCE_RECORDS;
  }

  return parseJSON<AttendanceRecord[]>(window.localStorage.getItem(ATTENDANCE_KEY), DEFAULT_ATTENDANCE_RECORDS);
}

export function saveAttendanceRecords(records: AttendanceRecord[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
}

export function loadExportsCount(): number {
  // Le compteur d'exports est normalisé pour éviter les valeurs négatives ou invalides.
  if (typeof window === 'undefined') {
    return DEFAULT_EXPORTS_COUNT;
  }

  const raw = window.localStorage.getItem(EXPORTS_COUNT_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_EXPORTS_COUNT;
}

export function saveExportsCount(count: number) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(EXPORTS_COUNT_KEY, String(Math.max(0, count)));
}

export function loadCourseSettings(): CourseSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_COURSE_SETTINGS;
  }

  return parseJSON<CourseSettings>(
    window.localStorage.getItem(COURSE_SETTINGS_KEY),
    DEFAULT_COURSE_SETTINGS
  );
}

export function saveCourseSettings(settings: CourseSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(COURSE_SETTINGS_KEY, JSON.stringify(settings));
}

export function loadDepartureExceptions(): DepartureException[] {
  if (typeof window === 'undefined') {
    return [];
  }

  return parseJSON<DepartureException[]>(window.localStorage.getItem(DEPARTURE_EXCEPTIONS_KEY), []);
}

export function saveDepartureException(exc: DepartureException): void {
  // Une exception remplace toujours la précédente pour le même pointage afin d'éviter les doublons.
  if (typeof window === 'undefined') {
    return;
  }

  const existing = loadDepartureExceptions().filter((e) => e.attendanceId !== exc.attendanceId);
  window.localStorage.setItem(DEPARTURE_EXCEPTIONS_KEY, JSON.stringify([...existing, exc]));
}
