import type { AttendanceRecord, CourseSettings, Student } from '@/lib/adminData';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8080/api';

interface ApiStudent {
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
  status: 'READY' | 'PENDING';
}

interface ApiAttendance {
  id: string;
  studentId: string;
  studentName: string;
  matricule: string;
  department: string;
  recordDate: string;
  checkIn: string;
  checkOut?: string;
  status: 'OPEN' | 'CLOSED';
}

interface ApiCourseSettings {
  courseName: string;
  courseDays: number;
  courseHours: number;
  eligibilityThreshold: number;
  startTime?: string;
  endTime?: string;
}

interface ApiScanResponse {
  message: string;
  attendance: ApiAttendance;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Erreur API (${response.status})`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      const errorText = await response.text();
      if (errorText) {
        message = errorText;
      }
    }

    throw new Error(message);
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function normalizeTime(value: string): string {
  if (!value) {
    return '';
  }

  return value.length >= 5 ? value.slice(0, 5) : value;
}

function toClientStudent(apiStudent: ApiStudent): Student {
  return {
    id: apiStudent.id,
    name: apiStudent.name,
    matricule: apiStudent.matricule,
    department: apiStudent.department,
    level: apiStudent.level,
    photoUrl: apiStudent.photoUrl,
    fingerprintRegistered: apiStudent.fingerprintRegistered,
    fingerprintTemplateId: apiStudent.fingerprintTemplateId,
    fingerprintCount: apiStudent.fingerprintCount,
    lastFingerprintScan: apiStudent.lastFingerprintScan,
    status: apiStudent.status === 'READY' ? 'ready' : 'pending',
  };
}

function toClientAttendance(apiAttendance: ApiAttendance): AttendanceRecord {
  return {
    id: apiAttendance.id,
    studentId: apiAttendance.studentId,
    studentName: apiAttendance.studentName,
    matricule: apiAttendance.matricule,
    department: apiAttendance.department,
    date: apiAttendance.recordDate,
    checkIn: normalizeTime(apiAttendance.checkIn),
    checkOut: apiAttendance.checkOut ? normalizeTime(apiAttendance.checkOut) : undefined,
    status: apiAttendance.status === 'CLOSED' ? 'Clôturé' : 'Ouvert',
  };
}

export async function fetchStudents(): Promise<Student[]> {
  const students = await request<ApiStudent[]>('/students');
  return students.map(toClientStudent);
}

export async function createStudent(input: {
  name: string;
  matricule: string;
  department: string;
  level: string;
  photoUrl?: string;
  fingerprintTemplateId?: string;
  fingerprintCount?: number;
}): Promise<Student> {
  const student = await request<ApiStudent>('/students', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return toClientStudent(student);
}

export async function updateStudent(
  id: string,
  input: {
    name: string;
    matricule: string;
    department: string;
    level: string;
    photoUrl?: string;
    fingerprintTemplateId?: string;
    fingerprintCount?: number;
  }
): Promise<Student> {
  const student = await request<ApiStudent>(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  return toClientStudent(student);
}

export async function deleteStudent(id: string): Promise<void> {
  await request<void>(`/students/${id}`, { method: 'DELETE' });
}

export async function fetchCourseSettings(): Promise<CourseSettings> {
  const settings = await request<ApiCourseSettings>('/course-settings');
  return {
    courseName: settings.courseName,
    courseDays: settings.courseDays,
    courseHours: settings.courseHours,
    startTime: settings.startTime ?? '',
    endTime: settings.endTime ?? '',
  };
}

export async function saveCourseSettingsApi(input: {
  courseName: string;
  courseDays: number;
  courseHours: number;
  eligibilityThreshold?: number;
  startTime?: string;
  endTime?: string;
}): Promise<CourseSettings> {
  const settings = await request<ApiCourseSettings>('/course-settings', {
    method: 'PUT',
    body: JSON.stringify({
      ...input,
      eligibilityThreshold: input.eligibilityThreshold ?? 75,
    }),
  });

  return {
    courseName: settings.courseName,
    courseDays: settings.courseDays,
    courseHours: settings.courseHours,
    startTime: settings.startTime ?? '',
    endTime: settings.endTime ?? '',
  };
}

export async function fetchAttendanceToday(): Promise<AttendanceRecord[]> {
  const records = await request<ApiAttendance[]>('/attendance/today');
  return records.map(toClientAttendance);
}

export async function scanAttendance(fingerprintTemplateId: string): Promise<{ message: string; attendance: AttendanceRecord }> {
  const response = await request<ApiScanResponse>('/attendance/scan', {
    method: 'POST',
    body: JSON.stringify({ fingerprintTemplateId }),
  });

  return {
    message: response.message,
    attendance: toClientAttendance(response.attendance),
  };
}

export async function fetchEligibilityRows(): Promise<Array<{
  studentId: string;
  matricule: string;
  studentName: string;
  attendedDays: number;
  courseDays: number;
  attendancePercentage: number;
  eligible: boolean;
}>> {
  return request('/reports/eligibility');
}
