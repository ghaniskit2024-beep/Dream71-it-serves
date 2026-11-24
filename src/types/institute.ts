export type CourseCategory = 'tech' | 'creative' | 'career' | 'paid';

export type BatchStatus = 'চলমান' | 'ভর্তি চলছে' | 'সম্পন্ন';

export type StudentStatus = 'সক্রিয়' | 'সম্পন্ন' | 'বিরতি';

export type PaymentMethod = 'বিকাশ' | 'নগদ' | 'ব্যাংক ট্রান্সফার' | 'নগদ ক্যাশ';

export type AttendanceStatus = 'উপস্থিত' | 'অনুপস্থিত' | 'বিলম্বিত';

export type InquiryStatus = 'অপেক্ষমাণ' | 'যোগাযোগ করা হয়েছে' | 'ভর্তি সম্পন্ন' | 'বাতিল';

export type SmsCategory = 'হাজিরা' | 'বেতন ও বকেয়া' | 'পরীক্ষা ও রেজাল্ট' | 'সাধারণ নোটিশ';

export type SmsChannel = 'ডিভাইস SMS' | 'গেটওয়ে প্রস্তুত / লগ';

export type PortalTab =
  | 'overview'
  | 'students'
  | 'courses'
  | 'batches'
  | 'attendance'
  | 'fees'
  | 'exams'
  | 'autoSms'
  | 'sms'
  | 'instructors'
  | 'admissions';

export interface Course {
  id: string;
  code: string;
  title: string;
  category: CourseCategory;
  categoryLabel: string;
  durationWeeks: number;
  totalClasses: number;
  fee: number;
  summary: string;
  syllabus: string[];
  imageUrl: string;
  active: boolean;
}

export interface Instructor {
  id: string;
  name: string;
  designation: string;
  specialty: string;
  experienceYears: number;
  phone: string;
  email: string;
  active: boolean;
}

export interface Batch {
  id: string;
  code: string;
  courseId: string;
  instructorId: string;
  schedule: string;
  room: string;
  startDate: string;
  capacity: number;
  enrolledCount?: number;
  status: BatchStatus;
}

export interface Student {
  id: string;
  studentCode: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  guardianName?: string;
  guardianPhone?: string;
  courseId: string;
  batchId: string;
  enrolledDate: string;
  totalFee: number;
  discount: number;
  paidAmount: number;
  status: StudentStatus;
}

export interface FeePayment {
  id: string;
  receiptNo: string;
  studentId: string;
  studentEmail?: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  date: string;
  note: string;
  billingMonth?: string;
}

export interface AttendanceRecord {
  id: string;
  batchId: string;
  date: string; // YYYY-MM-DD
  entries: Record<string, AttendanceStatus>;
  studentEmails?: string[];
}

export interface ExamRecord {
  id: string;
  title: string;
  batchId: string;
  courseId: string;
  examDate: string;
  totalMarks: number;
  passMarks: number;
  scores: Record<string, number>;
  createdAt: string;
  studentEmails?: string[];
}

export interface SmsNotification {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  guardianPhone: string;
  category: SmsCategory;
  message: string;
  sentAt: string;
  channel: SmsChannel;
}

export interface AdmissionInquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  courseId: string;
  preferredSlot: string;
  message: string;
  submittedAt: string;
  status: InquiryStatus;
}

export interface CertificateRecord {
  id: string;
  certificateId: string;
  studentName: string;
  studentCode: string;
  courseTitle: string;
  batchCode: string;
  grade: string;
  issueDate: string;
}

export interface InstituteState {
  courses: Course[];
  instructors: Instructor[];
  batches: Batch[];
  students: Student[];
  payments: FeePayment[];
  attendance: AttendanceRecord[];
  exams: ExamRecord[];
  smsLogs: SmsNotification[];
  inquiries: AdmissionInquiry[];
  certificates: CertificateRecord[];
}
