import type { AttendanceRecord, Cours, CourseSettings, Departement, Programme, Promotion, Student, Utilisateur } from '@/lib/adminData';
import { getApiBaseUrl } from '@/lib/apiBase';
import { parseFingerprintIds } from '@/lib/utils';

const API_BASE_URL = getApiBaseUrl();

interface ApiStudent {
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
  status: 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU';
}

interface ApiAttendance {
  id: string;
  studentId: string;
  seanceId?: number | null;
  studentName: string;
  photoUrl?: string;
  matricule: string;
  department: string;
  dateHeure?: string;
  heureArrivee?: string;
  recordDate: string;
  checkIn: string;
  checkOut?: string;
  status: 'PRESENT' | 'ABSENT' | 'RETARD' | 'EXCUSE';
  estJustifiee?: boolean;
  motifJustificatif?: string;
  modeSaisie?: 'EMPREINTE' | 'MANUELLE';
  justificatifId?: number | null;
}

interface ApiCourseSettings {
  coursId?: number | null;
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

interface ApiResyncInscriptionsResponse {
  message: string;
  syncedStudents: number;
}

interface SaveDepartureJustificationInput {
  motifJustificatif: string | null;
  estJustifiee: boolean;
}

interface ApiCours {
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
  enrolledStudentCount?: number;
  heureDebut?: string;
  heureFin?: string;
}

interface ApiUtilisateur {
  id: string;
  nom: string;
  email: string;
  coursId?: number | null;
  coursIds?: number[];
  photoUrl?: string;
  role: string;
  actif: boolean;
}

interface ApiDepartement {
  id: number;
  nom: string;
  code: string;
}

interface ApiProgramme {
  id: number;
  nom: string;
  code: string;
  cycle: 'LICENCE' | 'MASTER' | 'DOCTORAT';
  dureeSemestres?: number;
  totalCredits?: number;
}

interface ApiPromotion {
  id: number;
  nom: string;
  niveau: string;
  description?: string;
  departement: string;
  programme: string;
  coursIds: number[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Tous les appels admin passent ici pour centraliser les en-têtes et le traitement d'erreur.
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
      // Je privilégie d'abord le message JSON métier renvoyé par le backend.
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Si la réponse n'est pas JSON, je tente au moins d'exposer le texte brut utile au diagnostic.
      const errorText = await response.text();
      if (errorText) {
        message = errorText;
      }
    }

    throw new Error(message);
  }

  // Certaines routes REST répondent sans corps, je normalise ce cas pour les appelants.
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function normalizeTime(value: string): string {
  // Je ramène les heures au format HH:mm attendu partout dans le front.
  if (!value) {
    return '';
  }

  return value.length >= 5 ? value.slice(0, 5) : value;
}

function toClientStudent(apiStudent: ApiStudent): Student {
  // Cette conversion isole le front des détails exacts du contrat backend.
  const academicStatus = apiStudent.status;
  const fingerprintTemplateIds = apiStudent.fingerprintTemplateIds ?? parseFingerprintIds(apiStudent.fingerprintTemplateId);
  return {
    id: apiStudent.id,
    name: apiStudent.name,
    postNom: apiStudent.postNom,
    prenom: apiStudent.prenom,
    matricule: apiStudent.matricule,
    dateNaissance: apiStudent.dateNaissance,
    lieuNaissance: apiStudent.lieuNaissance,
    adresse: apiStudent.adresse,
    telephone: apiStudent.telephone,
    department: apiStudent.department,
    level: apiStudent.level,
    coursId: apiStudent.coursId ?? null,
    promotionId: apiStudent.promotionId ?? null,
    coursIds: apiStudent.coursIds ?? [],
    creditCoursIds: apiStudent.creditCoursIds ?? [],
    photoUrl: apiStudent.photoUrl,
    fingerprintRegistered: apiStudent.fingerprintRegistered,
    fingerprintTemplateIds,
    fingerprintTemplateId: apiStudent.fingerprintTemplateId ?? fingerprintTemplateIds.join(','),
    fingerprintCount: apiStudent.fingerprintCount,
    lastFingerprintScan: apiStudent.lastFingerprintScan,
    academicStatus,
    status: academicStatus === 'ACTIF' ? 'ready' : 'pending',
  };
}

function toClientDepartement(apiDepartement: ApiDepartement): Departement {
  return {
    id: apiDepartement.id,
    nom: apiDepartement.nom,
    code: apiDepartement.code,
  };
}

function toClientProgramme(apiProgramme: ApiProgramme): Programme {
  return {
    id: apiProgramme.id,
    nom: apiProgramme.nom,
    code: apiProgramme.code,
    cycle: apiProgramme.cycle,
    dureeSemestres: apiProgramme.dureeSemestres,
    totalCredits: apiProgramme.totalCredits,
  };
}

function toClientPromotion(apiPromotion: ApiPromotion): Promotion {
  return {
    id: apiPromotion.id,
    nom: apiPromotion.nom,
    niveau: apiPromotion.niveau,
    description: apiPromotion.description,
    departement: apiPromotion.departement,
    programme: apiPromotion.programme,
    coursIds: apiPromotion.coursIds ?? [],
  };
}

function toClientCours(apiCours: ApiCours): Cours {
  return {
    id: apiCours.id,
    nom: apiCours.nom,
    code: apiCours.code,
    intitule: apiCours.intitule,
    credits: apiCours.credits,
    volumeHoraire: apiCours.volumeHoraire,
    salle: apiCours.salle,
    horaire: apiCours.horaire,
    jourSemaine: apiCours.jourSemaine,
    enseignantId: apiCours.enseignantId ?? null,
    departementId: apiCours.departementId ?? null,
    programmeId: apiCours.programmeId ?? null,
    semestreId: apiCours.semestreId ?? null,
    nbJours: apiCours.nbJours,
    nbHeures: apiCours.nbHeures,
    seuilEligibilite: apiCours.seuilEligibilite,
    enrolledStudentCount: apiCours.enrolledStudentCount ?? 0,
    heureDebut: apiCours.heureDebut,
    heureFin: apiCours.heureFin,
  };
}

function normalizeUserRole(role: string): 'admin' | 'teacher' {
  // Pour le moment, tout rôle non admin est traité comme enseignant dans l'interface.
  return role === 'admin' ? 'admin' : 'teacher';
}

function toClientUtilisateur(apiUtilisateur: ApiUtilisateur): Utilisateur {
  return {
    id: apiUtilisateur.id,
    nom: apiUtilisateur.nom,
    email: apiUtilisateur.email,
    coursId: apiUtilisateur.coursId ?? null,
    coursIds: apiUtilisateur.coursIds ?? [],
    photoUrl: apiUtilisateur.photoUrl,
    role: normalizeUserRole(apiUtilisateur.role),
    actif: apiUtilisateur.actif,
  };
}

function toClientAttendance(apiAttendance: ApiAttendance): AttendanceRecord {
  // J'enrichis les pointages avec des champs d'affichage directement exploitables dans les tableaux.
  return {
    id: apiAttendance.id,
    studentId: apiAttendance.studentId,
    seanceId: apiAttendance.seanceId ?? null,
    studentName: apiAttendance.studentName,
    photoUrl: apiAttendance.photoUrl,
    matricule: apiAttendance.matricule,
    department: apiAttendance.department,
    dateHeure: apiAttendance.dateHeure,
    heureArrivee: apiAttendance.heureArrivee ? normalizeTime(apiAttendance.heureArrivee) : undefined,
    date: apiAttendance.recordDate,
    checkIn: normalizeTime(apiAttendance.checkIn),
    checkOut: apiAttendance.checkOut ? normalizeTime(apiAttendance.checkOut) : undefined,
    academicStatus: apiAttendance.status,
    estJustifiee: apiAttendance.estJustifiee,
    motifJustificatif: apiAttendance.motifJustificatif,
    modeSaisie: apiAttendance.modeSaisie,
    justificatifId: apiAttendance.justificatifId ?? null,
    status: apiAttendance.checkOut ? 'Clôturé' : 'Ouvert',
  };
}

export async function fetchStudents(): Promise<Student[]> {
  const students = await request<ApiStudent[]>('/students');
  return students.map(toClientStudent);
}

export async function fetchStudentsForCours(coursId: number): Promise<Student[]> {
  const students = await request<ApiStudent[]>(`/students/course/${coursId}`);
  return students.map(toClientStudent);
}

export async function createStudent(input: {
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
  creditCoursIds?: number[];
  status?: 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU';
  photoUrl?: string;
  fingerprintTemplateIds?: string[];
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
    creditCoursIds?: number[];
    status?: 'ACTIF' | 'INACTIF' | 'SUSPENDU' | 'DIPLOME' | 'EXCLU';
    photoUrl?: string;
    fingerprintTemplateIds?: string[];
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
    coursId: settings.coursId ?? null,
    courseName: settings.courseName,
    courseDays: settings.courseDays,
    courseHours: settings.courseHours,
    eligibilityThreshold: settings.eligibilityThreshold,
    startTime: settings.startTime ?? '',
    endTime: settings.endTime ?? '',
  };
}

export async function saveCourseSettingsApi(input: {
  coursId?: number | null;
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
    coursId: settings.coursId ?? null,
    courseName: settings.courseName,
    courseDays: settings.courseDays,
    courseHours: settings.courseHours,
    eligibilityThreshold: settings.eligibilityThreshold,
    startTime: settings.startTime ?? '',
    endTime: settings.endTime ?? '',
  };
}

export async function fetchAttendanceToday(): Promise<AttendanceRecord[]> {
  const records = await request<ApiAttendance[]>('/attendance/today');
  return records.map(toClientAttendance);
}

export async function resetAttendanceRecordsApi(): Promise<void> {
  await request('/attendance', {
    method: 'DELETE',
  });
}

export async function scanAttendance(fingerprintTemplateId: string): Promise<{ message: string; attendance: AttendanceRecord }> {
  const response = await request<ApiScanResponse>('/attendance/scan', {
    method: 'POST',
    body: JSON.stringify({ fingerprintTemplateId, coursId: null }),
  });

  return {
    message: response.message,
    attendance: toClientAttendance(response.attendance),
  };
}

export async function saveDepartureJustification(
  attendanceId: string,
  input: SaveDepartureJustificationInput
): Promise<AttendanceRecord> {
  const attendance = await request<ApiAttendance>(`/attendance/${attendanceId}/departure-justification`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  return toClientAttendance(attendance);
}

export async function scanAttendanceForCours(fingerprintTemplateId: string, coursId: number): Promise<{ message: string; attendance: AttendanceRecord }> {
  const response = await request<ApiScanResponse>('/attendance/scan', {
    method: 'POST',
    body: JSON.stringify({ fingerprintTemplateId, coursId }),
  });

  return {
    message: response.message,
    attendance: toClientAttendance(response.attendance),
  };
}

export async function fetchAttendanceForCours(coursId: number, date: string): Promise<AttendanceRecord[]> {
  const records = await request<ApiAttendance[]>(`/attendance/course/${coursId}?date=${encodeURIComponent(date)}`);
  return records.map(toClientAttendance);
}

export async function fetchAttendanceWeekForCours(coursId: number, startDate: string, endDate: string): Promise<AttendanceRecord[]> {
  const records = await request<ApiAttendance[]>(`/attendance/course/${coursId}/week?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
  return records.map(toClientAttendance);
}

export async function createManualAttendance(input: {
  studentId: string;
  coursId?: number | null;
  date?: string;
  checkIn?: string;
  checkOut?: string;
}): Promise<AttendanceRecord> {
  const record = await request<ApiAttendance>('/attendance/manual', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toClientAttendance(record);
}

export async function fetchEligibilityForCours(coursId: number): Promise<Array<{
  studentId: string;
  matricule: string;
  studentName: string;
  attendedDays: number;
  courseDays: number;
  attendancePercentage: number;
  eligible: boolean;
}>> {
  return request(`/reports/eligibility?coursId=${coursId}`);
}

export async function fetchCours(): Promise<Cours[]> {
  const cours = await request<ApiCours[]>('/courses');
  return cours.map(toClientCours);
}

export async function createCours(input: Omit<Cours, 'id'>): Promise<Cours> {
  const cours = await request<ApiCours>('/courses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toClientCours(cours);
}

export async function updateCours(id: number, input: Omit<Cours, 'id'>): Promise<Cours> {
  const cours = await request<ApiCours>(`/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return toClientCours(cours);
}

export async function deleteCours(id: number): Promise<void> {
  await request<void>(`/courses/${id}`, { method: 'DELETE' });
}

export async function fetchDepartements(): Promise<Departement[]> {
  const departements = await request<ApiDepartement[]>('/academic/departements');
  return departements.map(toClientDepartement);
}

export async function fetchProgrammes(): Promise<Programme[]> {
  const programmes = await request<ApiProgramme[]>('/academic/programmes');
  return programmes.map(toClientProgramme);
}

export async function fetchPromotions(): Promise<Promotion[]> {
  const promotions = await request<ApiPromotion[]>('/promotions');
  return promotions.map(toClientPromotion);
}

export async function createPromotion(input: Omit<Promotion, 'id'>): Promise<Promotion> {
  const promotion = await request<ApiPromotion>('/promotions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toClientPromotion(promotion);
}

export async function updatePromotion(id: number, input: Omit<Promotion, 'id'>): Promise<Promotion> {
  const promotion = await request<ApiPromotion>(`/promotions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return toClientPromotion(promotion);
}

export async function deletePromotion(id: number): Promise<void> {
  await request<void>(`/promotions/${id}`, { method: 'DELETE' });
}

export async function resyncStudentInscriptions(): Promise<{ message: string; syncedStudents: number }> {
  const response = await request<ApiResyncInscriptionsResponse>('/students/resync-inscriptions', {
    method: 'POST',
  });

  return {
    message: response.message,
    syncedStudents: response.syncedStudents,
  };
}

export async function fetchUtilisateurs(): Promise<Utilisateur[]> {
  const utilisateurs = await request<ApiUtilisateur[]>('/users');
  return utilisateurs.map(toClientUtilisateur);
}

export async function createUtilisateur(input: {
  nom: string;
  email: string;
  password: string;
  coursId?: number | null;
  coursIds?: number[];
  role: string;
}): Promise<Utilisateur> {
  const utilisateur = await request<ApiUtilisateur>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return toClientUtilisateur(utilisateur);
}

export async function updateUtilisateur(id: string, input: {
  nom: string;
  email: string;
  password: string;
  coursId?: number | null;
  coursIds?: number[];
  role: string;
}): Promise<Utilisateur> {
  const utilisateur = await request<ApiUtilisateur>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return toClientUtilisateur(utilisateur);
}

export async function toggleActifUtilisateur(id: string): Promise<Utilisateur> {
  const utilisateur = await request<ApiUtilisateur>(`/users/${id}/toggle-actif`, {
    method: 'PUT',
  });
  return toClientUtilisateur(utilisateur);
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
