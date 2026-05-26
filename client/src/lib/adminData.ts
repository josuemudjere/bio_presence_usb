export interface Student {
  id: string;
  name: string;
  matricule: string;
  department: string;
  level: string;
  photoUrl?: string;
  fingerprintRegistered: boolean;
  fingerprintTemplateId?: string;
  fingerprintCount?: number;
  lastFingerprintScan?: string;
  status: 'ready' | 'pending';
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  matricule: string;
  department: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'Ouvert' | 'Clôturé';
}

export interface CourseSettings {
  courseName: string;
  courseDays: number;
  courseHours: number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
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
  if (typeof window === 'undefined') {
    return;
  }

  const existing = loadDepartureExceptions().filter((e) => e.attendanceId !== exc.attendanceId);
  window.localStorage.setItem(DEPARTURE_EXCEPTIONS_KEY, JSON.stringify([...existing, exc]));
}
