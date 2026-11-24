import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  ExternalLink,
  FileBarChart2,
  GraduationCap,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  Printer,
  ShieldAlert,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AttendanceRecord,
  Batch,
  Course,
  ExamRecord,
  FeePayment,
  Instructor,
  SmsNotification,
  Student,
} from '../types/institute';
import { formatBDT, getNetFee, getStudentDue } from '../utils/storage';
import { QrCodeBadge } from './portal/QrCodeBadge';
import { ReceiptPrintModal } from './portal/ReceiptPrintModal';

interface StudentPortalProps {
  courses: Course[];
  batches: Batch[];
  instructors: Instructor[];
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  authError: string;
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSwitchToPublic: () => void;
  onOpenAdminPortal: () => void;
}

type StudentTab = 'overview' | 'attendance' | 'exams' | 'fees' | 'sms';

function getGradeLabel(pct: number): string {
  if (pct >= 80) return 'A+';
  if (pct >= 70) return 'A';
  if (pct >= 60) return 'A-';
  if (pct >= 50) return 'B';
  if (pct >= 40) return 'C';
  return 'F';
}

export function StudentPortal({
  courses,
  batches,
  instructors,
  user,
  authReady,
  isAdmin,
  authError,
  onSignInWithGoogle,
  onSignOut,
  onSwitchToPublic,
  onOpenAdminPortal,
}: StudentPortalProps) {
  const [activeTab, setActiveTab] = useState<StudentTab>('overview');
  const [matchedStudents, setMatchedStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsNotification[]>([]);
  const [receiptPayment, setReceiptPayment] = useState<FeePayment | null>(null);

  const normalizedEmail = (user?.email || '').trim().toLowerCase();

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !normalizedEmail) {
      setMatchedStudents([]);
      setPayments([]);
      setAttendance([]);
      setExams([]);
      setSmsLogs([]);
      setStudentsLoaded(false);
      return;
    }

    setStudentsLoaded(false);

    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('email', '==', normalizedEmail)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Student, 'id'>),
        }));
        list.sort((a, b) => b.enrolledDate.localeCompare(a.enrolledDate));
        setMatchedStudents(list);
        setStudentsLoaded(true);
      },
      (error) => {
        setStudentsLoaded(true);
        handleFirestoreError(error, OperationType.LIST, 'students');
      }
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'payments'), where('studentEmail', '==', normalizedEmail)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FeePayment, 'id'>),
        }));
        list.sort((a, b) => b.date.localeCompare(a.date));
        setPayments(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'payments')
    );

    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance'), where('studentEmails', 'array-contains', normalizedEmail)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AttendanceRecord, 'id'>),
        }));
        list.sort((a, b) => b.date.localeCompare(a.date));
        setAttendance(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'attendance')
    );

    const unsubExams = onSnapshot(
      query(collection(db, 'exams'), where('studentEmails', 'array-contains', normalizedEmail)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ExamRecord, 'id'>),
        }));
        list.sort((a, b) => b.examDate.localeCompare(a.examDate));
        setExams(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'exams')
    );

    const unsubSms = onSnapshot(
      query(collection(db, 'smsLogs'), where('studentEmail', '==', normalizedEmail)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SmsNotification, 'id'>),
        }));
        list.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
        setSmsLogs(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'smsLogs')
    );

    return () => {
      unsubStudents();
      unsubPayments();
      unsubAttendance();
      unsubExams();
      unsubSms();
    };
  }, [authReady, user, normalizedEmail]);

  const activeStudent = useMemo(() => {
    if (matchedStudents.length === 0) return null;
    return matchedStudents.find((s) => s.id === selectedStudentId) || matchedStudents[0];
  }, [matchedStudents, selectedStudentId]);

  const studentCourse = courses.find((c) => c.id === activeStudent?.courseId);
  const studentBatch = batches.find((b) => b.id === activeStudent?.batchId);
  const studentInstructor = instructors.find((i) => i.id === studentBatch?.instructorId);

  const studentAttendanceRows = useMemo(() => {
    if (!activeStudent) return [];
    return attendance
      .filter((a) => Object.prototype.hasOwnProperty.call(a.entries || {}, activeStudent.id))
      .map((a) => ({
        id: a.id,
        date: a.date,
        batchId: a.batchId,
        status: a.entries[activeStudent.id],
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, activeStudent]);

  const presentCount = studentAttendanceRows.filter((r) => r.status === 'উপস্থিত').length;
  const lateCount = studentAttendanceRows.filter((r) => r.status === 'বিলম্বিত').length;
  const absentCount = studentAttendanceRows.filter((r) => r.status === 'অনুপস্থিত').length;
  const attendancePct =
    studentAttendanceRows.length > 0
      ? Math.round(((presentCount + lateCount) / studentAttendanceRows.length) * 100)
      : 0;

  const studentExamRows = useMemo(() => {
    if (!activeStudent) return [];
    return exams
      .filter((ex) => Object.prototype.hasOwnProperty.call(ex.scores || {}, activeStudent.id))
      .map((ex) => {
        const obtained = Number(ex.scores[activeStudent.id] || 0);
        const pct = ex.totalMarks > 0 ? Math.round((obtained / ex.totalMarks) * 100) : 0;
        const passed = obtained >= ex.passMarks;
        return {
          exam: ex,
          obtained,
          pct,
          passed,
          grade: getGradeLabel(pct),
        };
      })
      .sort((a, b) => b.exam.examDate.localeCompare(a.exam.examDate));
  }, [exams, activeStudent]);

  const avgExamPct =
    studentExamRows.length > 0
      ? Math.round(studentExamRows.reduce((sum, r) => sum + r.pct, 0) / studentExamRows.length)
      : 0;

  const studentPayments = useMemo(() => {
    if (!activeStudent) return [];
    return payments.filter((p) => p.studentId === activeStudent.id);
  }, [payments, activeStudent]);

  const studentSmsLogs = useMemo(() => {
    if (!activeStudent) return [];
    return smsLogs.filter((s) => s.studentId === activeStudent.id);
  }, [smsLogs, activeStudent]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-sm w-full text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">স্টুডেন্ট সেশন যাচাই হচ্ছে...</p>
          <p className="text-xs text-slate-500">Firebase অথেনটিকেশন লোড হচ্ছে।</p>
        </div>
      </div>
    );
  }

  // Gate 1: Not signed in -> Student Google Sign-In Gate
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-8 space-y-6">
          <div className="space-y-3">
            <img
              src="/assets/aistudio/dream71_it_logo__2__e39bbd51.png"
              alt="Dream 71 IT Service Nangalkot লোগো"
              className="w-16 h-16 object-contain"
            />
            <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-700">
              <GraduationCap className="w-4 h-4" />
              স্টুডেন্ট পোর্টাল লগইন
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              ভর্তির সময় প্রদত্ত আপনার <strong className="text-slate-900">Gmail / Google অ্যাকাউন্ট</strong>{' '}
              দিয়ে লগইন করুন। লগইনের পর আপনার ডিজিটাল QR আইডি কার্ড, প্রতিদিনের হাজিরা,
              পরীক্ষার রেজাল্ট, বেতন ও বকেয়া রসিদ এবং নোটিফিকেশন দেখতে পারবেন।
            </p>
          </div>

          {authError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={onSignInWithGoogle}
              className="w-full py-2.5 px-4 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              Google দিয়ে স্টুডেন্ট লগইন করুন
            </button>
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="w-full py-2.5 px-4 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              মূল ওয়েবসাইট ভিজিট করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 2: Email not verified
  if (!user.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-8 space-y-5">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-base">
            <Lock className="w-5 h-5 shrink-0" />
            ভেরিফাইড ইমেইল প্রয়োজন
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            আপনার Google অ্যাকাউন্টের ইমেইল ভেরিফাইড নয়। অনুগ্রহ করে একটি ভেরিফাইড Gmail
            অ্যাকাউন্ট দিয়ে লগইন করুন।
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onSignOut}
              className="flex-1 py-2 px-4 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              অন্য অ্যাকাউন্ট ব্যবহার করুন
            </button>
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="flex-1 py-2 px-4 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              মূল ওয়েবসাইট ভিজিট করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 3: Loading student profile from Firestore
  if (!studentsLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-sm w-full text-center space-y-2">
          <p className="text-sm font-semibold text-slate-900">শিক্ষার্থীর তথ্য লোড হচ্ছে...</p>
          <p className="text-xs text-slate-500 font-mono-tabular">{user.email}</p>
        </div>
      </div>
    );
  }

  // Gate 4: Signed in, but email does not match any enrolled student
  if (!activeStudent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-8 space-y-5">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-base">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            এই ইমেইলে কোনো শিক্ষার্থী প্রোফাইল পাওয়া যায়নি
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            আপনি বর্তমানে{' '}
            <span className="font-mono-tabular font-semibold text-slate-900">{user.email}</span>{' '}
            দিয়ে লগইন করেছেন, কিন্তু ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোটের ডাটাবেসে এই ইমেইলের কোনো
            নিবন্ধিত শিক্ষার্থী রেকর্ড নেই।
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-900">কী করবেন?</p>
            <p>
              ১. অ্যাডমিন প্যানেল থেকে শিক্ষার্থীর তথ্যে আপনার এই Gmail ঠিকানা যুক্ত করান, অথবা
            </p>
            <p>২. ভর্তির সময় দেওয়া সঠিক Gmail অ্যাকাউন্ট দিয়ে আবার লগইন করুন।</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onSignOut}
              className="flex-1 py-2.5 px-4 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              অন্য অ্যাকাউন্টে লগইন
            </button>
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="flex-1 py-2.5 px-4 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              মূল ওয়েবসাইট ভিজিট করুন
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminPortal}
                className="flex-1 py-2.5 px-4 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
              >
                অ্যাডমিন প্যানেল
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const netFee = getNetFee(activeStudent);
  const dueAmount = getStudentDue(activeStudent);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky Student Portal Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/dream71_it_logo__2__e39bbd51.png"
              alt="Dream 71 IT Service Nangalkot লোগো"
              className="w-9 h-9 object-contain shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                ড্রিম-৭১ স্টুডেন্ট পোর্টাল
              </p>
              <p className="text-[11px] text-slate-500 font-mono-tabular truncate">
                {activeStudent.studentCode} · {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              মূল ওয়েবসাইট ভিজিট করুন
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminPortal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
              >
                অ্যাডমিন প্যানেল
              </button>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              লগআউট
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Multi-enrollment switcher (only shown if student has >1 enrollment on same Gmail) */}
        {matchedStudents.length > 1 && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-700">
              আপনার ইমেইলে একাধিক কোর্স/ব্যাচ এনরোলমেন্ট রয়েছে ({matchedStudents.length}টি):
            </p>
            <div className="flex flex-wrap gap-2">
              {matchedStudents.map((stu) => {
                const crs = courses.find((c) => c.id === stu.courseId);
                const selected = stu.id === activeStudent.id;
                return (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => setSelectedStudentId(stu.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selected
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {stu.studentCode} — {crs?.title || 'কোর্স'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Profile Banner + Downloadable QR Attendance ID */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4 flex-1 min-w-0">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono-tabular font-semibold text-blue-700">
                  আইডি: {activeStudent.studentCode}
                </span>
                <span className="text-slate-300">·</span>
                <span
                  className={`font-semibold ${
                    activeStudent.status === 'সক্রিয়'
                      ? 'text-emerald-700'
                      : activeStudent.status === 'সম্পন্ন'
                        ? 'text-blue-700'
                        : 'text-amber-700'
                  }`}
                >
                  অবস্থা: {activeStudent.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{activeStudent.name}</h1>
              <p className="text-sm text-slate-600">
                কোর্স:{' '}
                <span className="font-semibold text-slate-900">
                  {studentCourse?.title || 'নির্ধারিত কোর্স'}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block">ব্যাচ ও সময়সূচি</span>
                <span className="font-semibold text-slate-900 font-mono-tabular mt-0.5 block">
                  {studentBatch?.code || '—'}
                </span>
                <span className="text-slate-600 mt-0.5 block">
                  {studentBatch ? `${studentBatch.schedule} · ${studentBatch.room}` : 'ব্যাচ নির্ধারিত হয়নি'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">মেন্টর ও যোগাযোগ</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {studentInstructor?.name || 'প্রশিক্ষক প্যানেল'}
                </span>
                <span className="text-slate-600 font-mono-tabular mt-0.5 block">
                  মোবাইল: {activeStudent.phone}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">ভর্তি ও অভিভাবক</span>
                <span className="font-semibold text-slate-900 font-mono-tabular mt-0.5 block">
                  ভর্তি: {activeStudent.enrolledDate}
                </span>
                <span className="text-slate-600 mt-0.5 block">
                  {activeStudent.guardianName
                    ? `${activeStudent.guardianName} (${activeStudent.guardianPhone || '—'})`
                    : activeStudent.address}
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center lg:items-end gap-2">
            <QrCodeBadge
              value={activeStudent.studentCode}
              label={activeStudent.name}
              subLabel={`QR হাজিরা কোড: ${activeStudent.studentCode}`}
              size={136}
              allowDownload
            />
          </div>
        </section>

        {/* 4 Flat KPI Summary Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>উপস্থিতির হার</span>
              <ClipboardCheck className="w-4 h-4 text-blue-700" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono-tabular">{attendancePct}%</p>
            <p className="text-xs text-slate-500 font-mono-tabular">
              উপস্থিত {presentCount} · বিলম্ব {lateCount} · অনুপস্থিত {absentCount}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>পরীক্ষার গড় নম্বর</span>
              <Award className="w-4 h-4 text-emerald-700" />
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono-tabular">{avgExamPct}%</p>
            <p className="text-xs text-slate-500 font-mono-tabular">
              মোট {studentExamRows.length}টি পরীক্ষার মূল্যায়ন
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>পরিশোধিত ফি</span>
              <CreditCard className="w-4 h-4 text-emerald-700" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 font-mono-tabular">
              {netFee === 0 ? 'ফ্রি কোর্স' : formatBDT(activeStudent.paidAmount)}
            </p>
            <p className="text-xs text-slate-500 font-mono-tabular">
              {netFee === 0 ? 'ASSET / NSDA স্কলারশিপ' : `মোট নির্ধারিত: ${formatBDT(netFee)}`}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>বর্তমান বকেয়া</span>
              <MessageSquare className="w-4 h-4 text-amber-700" />
            </div>
            <p
              className={`text-2xl font-bold font-mono-tabular ${
                dueAmount > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {dueAmount > 0 ? formatBDT(dueAmount) : 'বকেয়া নেই'}
            </p>
            <p className="text-xs text-slate-500 font-mono-tabular">
              {studentSmsLogs.length}টি অভিভাবক নোটিফিকেশন
            </p>
          </div>
        </section>

        {/* Student Portal Section Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-full sm:w-fit overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'সারসংক্ষেপ ও সিলেবাস', icon: BookOpen },
              { id: 'attendance', label: 'হাজিরার ইতিহাস', icon: ClipboardCheck },
              { id: 'exams', label: 'পরীক্ষা ও রেজাল্ট', icon: FileBarChart2 },
              { id: 'fees', label: 'বেতন ও রসিদ', icon: CreditCard },
              { id: 'sms', label: 'নোটিশ ও SMS', icon: MessageSquare },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview & Syllabus */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-base font-semibold text-slate-900">
                  কোর্স কারিকুলাম ও মডিউলসমূহ
                </h2>
                <span className="text-xs font-mono-tabular text-slate-500">
                  {studentCourse ? `${studentCourse.durationWeeks} সপ্তাহ · ${studentCourse.totalClasses} ক্লাস` : ''}
                </span>
              </div>
              {studentCourse ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">{studentCourse.summary}</p>
                  <ul className="space-y-2 pt-2">
                    {studentCourse.syllabus.map((mod, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200/80 rounded-lg px-3.5 py-2.5"
                      >
                        <span className="font-mono-tabular text-xs font-semibold text-blue-700 mt-0.5">
                          ০{idx + 1}
                        </span>
                        <span>{mod}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-slate-500">কোর্সের বিবরণ পাওয়া যায়নি।</p>
              )}
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                  ক্লাস ও ব্যাচ নির্দেশিকা
                </h2>
                <dl className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      ব্যাচ কোড
                    </dt>
                    <dd className="font-mono-tabular font-semibold text-slate-900">
                      {studentBatch?.code || '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      ক্লাসের সময়
                    </dt>
                    <dd className="font-medium text-slate-900 text-right">
                      {studentBatch?.schedule || '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      ল্যাব ও মেন্টর
                    </dt>
                    <dd className="font-medium text-slate-900 text-right">
                      {studentBatch?.room || '—'} · {studentInstructor?.name || 'মেন্টর'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      নিবন্ধিত ইমেইল
                    </dt>
                    <dd className="font-mono-tabular text-slate-900">{activeStudent.email}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      হেল্পলাইন
                    </dt>
                    <dd className="font-mono-tabular font-semibold text-blue-700">
                      +৮৮০ ১৭১৫-৪০৮২১০
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-slate-900 text-white rounded-xl p-6 space-y-3">
                <p className="text-sm font-semibold">অফিশিয়াল ওয়েবসাইট ও নতুন কোর্স</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোটের অন্যান্য সরকারি ফ্রি ট্রেনিং, সার্টিফিকেট যাচাই
                  ও নতুন ব্যাচের সময়সূচি দেখতে মূল ওয়েবসাইট ভিজিট করুন।
                </p>
                <button
                  type="button"
                  onClick={onSwitchToPublic}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  মূল ওয়েবসাইটে যান
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Attendance History */}
        {activeTab === 'attendance' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">ডিজিটাল হাজিরার রেকর্ড</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  QR স্ক্যান বা ম্যানুয়াল হাজিরায় সংরক্ষিত প্রতিদিনের উপস্থিতির হিসাব
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-blue-700">
                উপস্থিতি: {attendancePct}% ({presentCount + lateCount}/{studentAttendanceRows.length})
              </span>
            </div>

            {studentAttendanceRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                এখনো আপনার কোনো দিনের হাজিরা এন্ট্রি করা হয়নি।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 whitespace-nowrap">তারিখ</th>
                      <th className="py-3 px-4 whitespace-nowrap">ব্যাচ</th>
                      <th className="py-3 px-4 whitespace-nowrap">অবস্থান</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {studentAttendanceRows.map((row) => {
                      const bCode = batches.find((b) => b.id === row.batchId)?.code || row.batchId;
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono-tabular text-xs font-medium text-slate-900">
                            {row.date}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                            {bCode}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold">
                            {row.status === 'উপস্থিত' && (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                উপস্থিত
                              </span>
                            )}
                            {row.status === 'বিলম্বিত' && (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <Clock className="w-3.5 h-3.5" />
                                বিলম্বিত
                              </span>
                            )}
                            {row.status === 'অনুপস্থিত' && (
                              <span className="inline-flex items-center gap-1 text-rose-700">
                                <XCircle className="w-3.5 h-3.5" />
                                অনুপস্থিত
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Exams & Results */}
        {activeTab === 'exams' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">পরীক্ষা ও রেজাল্ট শীট</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ক্লাস টেস্ট, প্র্যাকটিক্যাল ল্যাব মূল্যায়ন ও চূড়ান্ত পরীক্ষার নম্বর
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-semibold text-emerald-700">
                গড় স্কোর: {avgExamPct}%
              </span>
            </div>

            {studentExamRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                এখনো আপনার কোনো পরীক্ষার নম্বর প্রকাশিত হয়নি।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 whitespace-nowrap">পরীক্ষার নাম</th>
                      <th className="py-3 px-4 whitespace-nowrap">তারিখ</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">প্রাপ্ত নম্বর</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">শতকরা (%)</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">গ্রেড ও ফলাফল</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {studentExamRows.map(({ exam, obtained, pct, passed, grade }) => (
                      <tr key={exam.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-medium text-slate-900">{exam.title}</td>
                        <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                          {exam.examDate}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {obtained} / {exam.totalMarks}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-xs text-slate-700 whitespace-nowrap">
                          {pct}%
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-semibold whitespace-nowrap">
                          <span className={passed ? 'text-emerald-700' : 'text-rose-700'}>
                            {grade} ({passed ? 'উত্তীর্ণ' : 'অনুত্তীর্ণ'})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Fee Ledger & Printable Receipts */}
        {activeTab === 'fees' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">মোট নির্ধারিত ফি (ছাড় বাদে)</span>
                <span className="text-lg font-bold text-slate-900 font-mono-tabular mt-1 block">
                  {netFee === 0 ? 'সম্পূর্ণ ফ্রি' : formatBDT(netFee)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">মোট পরিশোধিত</span>
                <span className="text-lg font-bold text-emerald-700 font-mono-tabular mt-1 block">
                  {formatBDT(activeStudent.paidAmount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">বর্তমান বকেয়া</span>
                <span
                  className={`text-lg font-bold font-mono-tabular mt-1 block ${
                    dueAmount > 0 ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {formatBDT(dueAmount)}
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">পেমেন্ট ও মানি রসিদ</h2>
              </div>
              {studentPayments.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {netFee === 0
                    ? 'আপনি সরকারি ফ্রি / বৃত্তি কোর্সে ভর্তি থাকায় কোনো বেতন পেমেন্ট রসিদ নেই।'
                    : 'এখনো কোনো ফি পরিশোধের রেকর্ড যুক্ত হয়নি।'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4 whitespace-nowrap">রসিদ নং</th>
                        <th className="py-3 px-4 whitespace-nowrap">তারিখ</th>
                        <th className="py-3 px-4 whitespace-nowrap">মাধ্যম</th>
                        <th className="py-3 px-4 whitespace-nowrap">মন্তব্য</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">পরিমাণ</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">রসিদ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {studentPayments.map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-blue-700 whitespace-nowrap">
                            {pay.receiptNo}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                            {pay.date}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                            {pay.method}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">{pay.note || '—'}</td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-xs font-semibold text-emerald-700 whitespace-nowrap">
                            {formatBDT(pay.amount)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setReceiptPayment(pay)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              রসিদ দেখুন
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Guardian SMS & Notifications */}
        {activeTab === 'sms' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                নোটিশ ও অভিভাবক SMS লগ
              </h2>
            </div>
            {studentSmsLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                আপনার জন্য এখনো কোনো SMS বা বিশেষ নোটিফিকেশন লগ নেই।
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {studentSmsLogs.map((log) => (
                  <div key={log.id} className="p-5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-blue-700">{log.category}</span>
                      <span className="font-mono-tabular text-slate-500">
                        {log.sentAt} · {log.guardianPhone}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <ReceiptPrintModal
        payment={receiptPayment}
        student={activeStudent}
        course={studentCourse}
        onClose={() => setReceiptPayment(null)}
      />
    </div>
  );
}
