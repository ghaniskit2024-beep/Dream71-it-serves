import { INITIAL_INSTITUTE_STATE } from '../data/seedData';
import { FeePayment, InstituteState, Student } from '../types/institute';

const STORAGE_KEY = 'dream71_nangalkot_it_v2';

export function loadInstituteState(): InstituteState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_INSTITUTE_STATE));
      return INITIAL_INSTITUTE_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<InstituteState>;
    return {
      courses: Array.isArray(parsed.courses) ? parsed.courses : INITIAL_INSTITUTE_STATE.courses,
      instructors: Array.isArray(parsed.instructors)
        ? parsed.instructors
        : INITIAL_INSTITUTE_STATE.instructors,
      batches: Array.isArray(parsed.batches) ? parsed.batches : INITIAL_INSTITUTE_STATE.batches,
      students: Array.isArray(parsed.students) ? parsed.students : INITIAL_INSTITUTE_STATE.students,
      payments: Array.isArray(parsed.payments) ? parsed.payments : INITIAL_INSTITUTE_STATE.payments,
      attendance: Array.isArray(parsed.attendance)
        ? parsed.attendance
        : INITIAL_INSTITUTE_STATE.attendance,
      exams: Array.isArray(parsed.exams) ? parsed.exams : INITIAL_INSTITUTE_STATE.exams,
      smsLogs: Array.isArray(parsed.smsLogs) ? parsed.smsLogs : INITIAL_INSTITUTE_STATE.smsLogs,
      inquiries: Array.isArray(parsed.inquiries)
        ? parsed.inquiries
        : INITIAL_INSTITUTE_STATE.inquiries,
      certificates: Array.isArray(parsed.certificates)
        ? parsed.certificates
        : INITIAL_INSTITUTE_STATE.certificates,
    };
  } catch {
    return INITIAL_INSTITUTE_STATE;
  }
}

export function saveInstituteState(state: InstituteState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function resetInstituteState(): InstituteState {
  saveInstituteState(INITIAL_INSTITUTE_STATE);
  return INITIAL_INSTITUTE_STATE;
}

export function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString('en-IN')}`;
}

export function getNetFee(student: Pick<Student, 'totalFee' | 'discount'>): number {
  return Math.max(0, student.totalFee - student.discount);
}

export function getStudentDue(student: Pick<Student, 'totalFee' | 'discount' | 'paidAmount'>): number {
  return Math.max(0, getNetFee(student) - student.paidAmount);
}

export function getPaymentStatusLabel(
  student: Pick<Student, 'totalFee' | 'discount' | 'paidAmount'>
): 'ফ্রি কোর্স' | 'পরিশোধিত' | 'আংশিক' | 'বকেয়া' {
  const net = getNetFee(student);
  if (net === 0) return 'ফ্রি কোর্স';
  const due = getStudentDue(student);
  if (due <= 0) return 'পরিশোধিত';
  if (student.paidAmount > 0) return 'আংশিক';
  return 'বকেয়া';
}

export function getExamGrade(score: number, totalMarks: number): string {
  if (totalMarks <= 0) return 'N/A';
  const pct = (score / totalMarks) * 100;
  if (pct >= 80) return 'A+';
  if (pct >= 70) return 'A';
  if (pct >= 60) return 'A-';
  if (pct >= 50) return 'B';
  if (pct >= 40) return 'C';
  return 'F';
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateStudentCode(students: Student[]): string {
  const maxNum = students.reduce((acc, s) => {
    const match = s.studentCode.match(/(\d+)$/);
    const num = match ? parseInt(match[0], 10) : 2600;
    return Math.max(acc, num);
  }, 2600);
  return `D71-${maxNum + 1}`;
}

export function generateReceiptNo(payments: FeePayment[]): string {
  const maxNum = payments.reduce((acc, p) => {
    const match = p.receiptNo.match(/\d+/);
    const num = match ? parseInt(match[0], 10) : 261130;
    return Math.max(acc, num);
  }, 261130);
  return `INV-${maxNum + 1}`;
}

export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
