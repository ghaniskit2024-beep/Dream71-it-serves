import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Award,
  BellRing,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  Copy,
  CreditCard,
  ExternalLink,
  FileBarChart2,
  GraduationCap,
  LayoutDashboard,
  Link2,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AdmissionInquiry,
  AttendanceRecord,
  Batch,
  CertificateRecord,
  Course,
  ExamRecord,
  FeePayment,
  InquiryStatus,
  InstituteState,
  Instructor,
  PortalTab,
  SmsCategory,
  SmsNotification,
  Student,
} from '../types/institute';
import { AdmissionsCertsView } from './portal/AdmissionsCertsView';
import { AttendanceView } from './portal/AttendanceView';
import { AutomatedSmsView } from './portal/AutomatedSmsView';
import { CoursesBatchesView } from './portal/CoursesBatchesView';
import { ExamsResultsView } from './portal/ExamsResultsView';
import { FeesView } from './portal/FeesView';
import { InstructorsView } from './portal/InstructorsView';
import { OverviewView } from './portal/OverviewView';
import { SmsNotificationsView } from './portal/SmsNotificationsView';
import { StudentsView } from './portal/StudentsView';

interface ManagementPortalProps {
  state: InstituteState;
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  authError: string;
  isSeeding: boolean;
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSwitchToPublic: () => void;
  onSwitchToStudent: () => void;
  onResetDemoData: () => Promise<void>;
  onAddStudent: (student: Student, initialPayment?: number) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onAddCourse: (course: Course) => void;
  onUpdateCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onAddBatch: (batch: Batch) => void;
  onUpdateBatch: (batch: Batch) => void;
  onDeleteBatch: (batchId: string) => void;
  onSaveAttendance: (record: AttendanceRecord) => void;
  onSaveExam: (exam: ExamRecord) => void;
  onDeleteExam: (examId: string) => void;
  onSaveSmsLogs: (logs: SmsNotification[]) => Promise<void> | void;
  onDeleteSmsLog: (id: string) => Promise<void> | void;
  onAddPayment: (payment: FeePayment) => void;
  onAddInstructor: (instructor: Instructor) => void;
  onUpdateInstructor: (instructor: Instructor) => void;
  onDeleteInstructor: (id: string) => void;
  onUpdateInquiryStatus: (id: string, status: InquiryStatus) => void;
  onAddCertificate: (cert: CertificateRecord) => void;
  onDeleteCertificate: (id: string) => void;
}

const NAV_ITEMS: { id: PortalTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'ওভারভিউ', icon: LayoutDashboard },
  { id: 'students', label: 'শিক্ষার্থী ও তথ্য', icon: Users },
  { id: 'courses', label: 'কোর্স ও কারিকুলাম', icon: BookOpen },
  { id: 'batches', label: 'ক্লাস ও ব্যাচ', icon: CalendarDays },
  { id: 'attendance', label: 'ডিজিটাল হাজিরা (QR)', icon: ClipboardCheck },
  { id: 'fees', label: 'বেতন ও বকেয়া', icon: CreditCard },
  { id: 'exams', label: 'পরীক্ষা ও রেজাল্ট', icon: FileBarChart2 },
  { id: 'autoSms', label: 'অটোমেটেড SMS', icon: BellRing },
  { id: 'sms', label: 'অভিভাবক SMS', icon: MessageSquare },
  { id: 'instructors', label: 'মেন্টর প্যানেল', icon: UserCheck },
  { id: 'admissions', label: 'আবেদন ও সার্টিফিকেট', icon: Award },
];

export function ManagementPortal({
  state,
  user,
  authReady,
  isAdmin,
  authError,
  isSeeding,
  onSignInWithGoogle,
  onSignOut,
  onSwitchToPublic,
  onSwitchToStudent,
  onResetDemoData,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onAddBatch,
  onUpdateBatch,
  onDeleteBatch,
  onSaveAttendance,
  onSaveExam,
  onDeleteExam,
  onSaveSmsLogs,
  onDeleteSmsLog,
  onAddPayment,
  onAddInstructor,
  onUpdateInstructor,
  onDeleteInstructor,
  onUpdateInquiryStatus,
  onAddCertificate,
  onDeleteCertificate,
}: ManagementPortalProps) {
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [prefillStudent, setPrefillStudent] = useState<{
    name: string;
    phone: string;
    email: string;
    courseId: string;
    inquiryId?: string;
  } | null>(null);

  const [preselectedFeeStudentId, setPreselectedFeeStudentId] = useState<string | null>(null);
  const [prefillSms, setPrefillSms] = useState<{
    category: SmsCategory;
    studentIds: string[];
    message?: string;
  } | null>(null);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-sm w-full text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">অ্যাডমিন সেশন যাচাই হচ্ছে...</p>
          <p className="text-xs text-slate-500">Firebase অথেনটিকেশন লোড হচ্ছে।</p>
        </div>
      </div>
    );
  }

  // Gate 1: Not signed in -> Dedicated Google Sign-In Admin Login Card
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
              <Lock className="w-4 h-4" />
              অ্যাডমিন প্যানেল সুরক্ষিত প্রবেশ
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              ফ্রি ক্লাউড ডাটাবেস (Firebase Firestore) থেকে শিক্ষার্থী ভর্তি, ব্যাচ, উপস্থিতি,
              আবেদন এবং সার্টিফিকেট পরিচালনা করতে আপনার অনুমোদিত গুগল অ্যাকাউন্ট দিয়ে লগইন
              করুন।
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
              Google দিয়ে অ্যাডমিন লগইন করুন
            </button>
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="w-full py-2.5 px-4 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              পাবলিক ওয়েবসাইটে ফিরে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 2: Signed in, but not an authorized admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-8 space-y-5">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-base">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            অ্যাডমিন অনুমোদন নেই
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            আপনি বর্তমানে{' '}
            <span className="font-mono-tabular font-semibold text-slate-900">
              {user.email}
            </span>{' '}
            দিয়ে লগইন আছেন, যা অ্যাডমিন হিসেবে অনুমোদিত নয়। অনুগ্রহ করে অনুমোদিত অ্যাডমিন
            ইমেইল দিয়ে লগইন করুন।
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onSignOut}
              className="flex-1 py-2 px-4 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              লগআউট ও অন্য অ্যাকাউন্ট
            </button>
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="flex-1 py-2 px-4 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              পাবলিক ওয়েবসাইট
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeNav = NAV_ITEMS.find((item) => item.id === activeTab);
  const pendingCount = state.inquiries.filter((i) => i.status === 'অপেক্ষমাণ').length;

  const handleConvertInquiryToStudent = (inquiry: AdmissionInquiry) => {
    setPrefillStudent({
      name: inquiry.name,
      phone: inquiry.phone,
      email: inquiry.email,
      courseId: inquiry.courseId,
      inquiryId: inquiry.id,
    });
    setActiveTab('students');
  };

  const handleAddStudentWithInquirySync = (student: Student, initialPayment?: number) => {
    onAddStudent(student, initialPayment);
    if (prefillStudent?.inquiryId) {
      onUpdateInquiryStatus(prefillStudent.inquiryId, 'ভর্তি সম্পন্ন');
    }
    setPrefillStudent(null);
  };

  const handleQuickEnrollFromOverview = () => {
    setPrefillStudent({
      name: '',
      phone: '',
      email: '',
      courseId: state.courses[0]?.id || '',
    });
    setActiveTab('students');
  };

  const handleOpenPaymentForStudent = (studentId: string) => {
    setPreselectedFeeStudentId(studentId);
    setActiveTab('fees');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/assets/aistudio/dream71_it_logo__2__e39bbd51.png"
            alt="Dream 71 লোগো"
            className="w-9 h-9 object-contain shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 tracking-tight leading-snug">
              ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate font-mono-tabular">
              {user.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
          aria-label="মেনু বন্ধ করুন"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="ড্যাশবোর্ড মেনু">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-50 text-blue-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                {item.label}
              </span>
              {item.id === 'admissions' && pendingCount > 0 && (
                <span className="text-xs font-mono-tabular font-semibold text-amber-700">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 space-y-1">
        <button
          type="button"
          onClick={() => {
            setLinksModalOpen(true);
            setMobileMenuOpen(false);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap"
        >
          <Link2 className="w-3.5 h-3.5 text-blue-700" />
          ওয়েব ও স্টুডেন্ট লিংক
        </button>
        <button
          type="button"
          onClick={onSwitchToStudent}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
        >
          <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
          স্টুডেন্ট পোর্টাল দেখুন
        </button>
        <button
          type="button"
          onClick={onSwitchToPublic}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
        >
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          পাবলিক ওয়েবসাইট দেখুন
        </button>
        <button
          type="button"
          onClick={() => setResetConfirmOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          প্রাথমিক কোর্স সিড / রিসেট
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          অ্যাডমিন লগআউট
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-[260px] max-w-[80vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="মেনু খুলুন"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                অ্যাডমিন প্যানেল
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">{activeNav?.label}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setLinksModalOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Link2 className="w-3.5 h-3.5" />
              লিংক ও Netlify গাইড
            </button>
            <button
              type="button"
              onClick={onSwitchToPublic}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              পাবলিক ওয়েবসাইট
            </button>
            <button
              type="button"
              onClick={handleQuickEnrollFromOverview}
              className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              + নতুন শিক্ষার্থী
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1360px] w-full mx-auto">
          {isSeeding && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs font-medium text-blue-800">
              Firebase ফ্রি ডাটাবেসে প্রাথমিক কোর্স, ব্যাচ ও তথ্য সংরক্ষণ করা হচ্ছে...
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewView
              state={state}
              onNavigate={setActiveTab}
              onQuickEnroll={handleQuickEnrollFromOverview}
            />
          )}

          {activeTab === 'students' && (
            <StudentsView
              state={state}
              onAddStudent={handleAddStudentWithInquirySync}
              onUpdateStudent={onUpdateStudent}
              onDeleteStudent={onDeleteStudent}
              onOpenPaymentForStudent={handleOpenPaymentForStudent}
              prefillStudent={prefillStudent}
              onClearPrefill={() => setPrefillStudent(null)}
            />
          )}

          {(activeTab === 'courses' || activeTab === 'batches') && (
            <CoursesBatchesView
              mode={activeTab}
              state={state}
              onAddCourse={onAddCourse}
              onUpdateCourse={onUpdateCourse}
              onDeleteCourse={onDeleteCourse}
              onAddBatch={onAddBatch}
              onUpdateBatch={onUpdateBatch}
              onDeleteBatch={onDeleteBatch}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceView
              state={state}
              onSaveAttendance={onSaveAttendance}
              onNotifyAbsentSms={(batchId, date, absentStudentIds) => {
                const batchCode = state.batches.find((b) => b.id === batchId)?.code || 'ব্যাচ';
                setPrefillSms({
                  category: 'হাজিরা',
                  studentIds: absentStudentIds,
                  message: `ড্রিম-৭১ আইটি নাঙ্গলকোট: প্রিয় অভিভাবক, {name} ({code}) ${date} তারিখের (${batchCode}) ক্লাসে অনুপস্থিত ছিল। অনুগ্রহ করে নিয়মিত উপস্থিতি নিশ্চিত করুন।`,
                });
                setActiveTab('sms');
              }}
            />
          )}

          {activeTab === 'fees' && (
            <FeesView
              state={state}
              onAddPayment={onAddPayment}
              onSendDueSms={(studentId, message) => {
                setPrefillSms({
                  category: 'বেতন ও বকেয়া',
                  studentIds: [studentId],
                  message,
                });
                setActiveTab('sms');
              }}
              preselectedStudentId={preselectedFeeStudentId}
              onClearPreselectedStudent={() => setPreselectedFeeStudentId(null)}
            />
          )}

          {activeTab === 'exams' && (
            <ExamsResultsView
              state={state}
              onSaveExam={onSaveExam}
              onDeleteExam={onDeleteExam}
              onSendResultSms={(studentId, message) => {
                setPrefillSms({
                  category: 'পরীক্ষা ও রেজাল্ট',
                  studentIds: [studentId],
                  message,
                });
                setActiveTab('sms');
              }}
            />
          )}

          {activeTab === 'autoSms' && (
            <AutomatedSmsView
              state={state}
              onSaveSmsLogs={onSaveSmsLogs}
              onDeleteSmsLog={onDeleteSmsLog}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'sms' && (
            <SmsNotificationsView
              state={state}
              onSaveSmsLogs={onSaveSmsLogs}
              onDeleteSmsLog={onDeleteSmsLog}
              prefillSms={prefillSms}
              onClearPrefill={() => setPrefillSms(null)}
              onOpenAutoSms={() => setActiveTab('autoSms')}
            />
          )}

          {activeTab === 'instructors' && (
            <InstructorsView
              state={state}
              onAddInstructor={onAddInstructor}
              onUpdateInstructor={onUpdateInstructor}
              onDeleteInstructor={onDeleteInstructor}
            />
          )}

          {activeTab === 'admissions' && (
            <AdmissionsCertsView
              state={state}
              onUpdateInquiryStatus={onUpdateInquiryStatus}
              onConvertInquiryToStudent={handleConvertInquiryToStudent}
              onAddCertificate={onAddCertificate}
              onDeleteCertificate={onDeleteCertificate}
            />
          )}
        </main>
      </div>

      {linksModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  ওয়েবসাইট, স্টুডেন্ট ও অ্যাডমিন লিংক
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Netlify বা লাইভ ডোমেইনে আপলোডের পর নিচের লিংকগুলো সরাসরি কাজ করবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLinksModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  key: 'public',
                  label: 'মূল ওয়েবসাইট (পাবলিক ভিজিট)',
                  url: `${typeof window !== 'undefined' ? window.location.origin : ''}/`,
                },
                {
                  key: 'student',
                  label: 'স্টুডেন্ট লগইন ও পোর্টাল',
                  url: `${typeof window !== 'undefined' ? window.location.origin : ''}/student`,
                },
                {
                  key: 'admin',
                  label: 'অ্যাডমিন প্যানেল (ম্যানেজমেন্ট)',
                  url: `${typeof window !== 'undefined' ? window.location.origin : ''}/admin`,
                },
              ].map((item) => {
                const isCopied = copiedKey === item.key;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                      <p className="text-[11px] font-mono-tabular text-blue-700 truncate mt-0.5">
                        {item.url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(item.url);
                        setCopiedKey(item.key);
                        setTimeout(() => setCopiedKey(null), 1800);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-100 shrink-0"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          কপি হয়েছে
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                          কপি
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-4 text-xs text-slate-700 space-y-1.5 leading-relaxed">
              <p className="font-semibold text-blue-900">Netlify-এ চালানোর জরুরি নির্দেশনা:</p>
              <p>
                ১. প্রজেক্টে <span className="font-mono-tabular font-semibold">npm run build</span>{' '}
                চালিয়ে তৈরি হওয়া <span className="font-mono-tabular font-semibold">dist</span>{' '}
                ফোল্ডারটি Netlify-এ আপলোড করুন (অথবা GitHub যুক্ত করলে Netlify স্বয়ংক্রিয়ভাবে বিল্ড
                করবে)।
              </p>
              <p>
                ২. Google লগইন চালু রাখতে{' '}
                <span className="font-semibold">
                  Firebase Console → Authentication → Settings → Authorized domains
                </span>{' '}
                এ গিয়ে আপনার Netlify ডোমেইন (যেমন{' '}
                <span className="font-mono-tabular">your-site.netlify.app</span>) Add করুন।
              </p>
              <p>
                ৩. শিক্ষার্থীর প্রোফাইলে ভর্তির সময় তাদের সঠিক{' '}
                <span className="font-semibold">Gmail</span> দিন, তাহলে তারা{' '}
                <span className="font-mono-tabular">/student</span> লিংক থেকে লগইন করতে পারবে।
              </p>
            </div>
          </div>
        </div>
      )}

      {resetConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              সকল প্রাথমিক কোর্স ডাটাবেসে সিড করবেন?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              এটি Firebase Firestore ডাটাবেসে ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোটের নির্ধারিত ৮টি ফ্রি
              কোর্স, পেড কোর্স (বেসিক কম্পিউটার), ব্যাচ, মেন্টর এবং নমুনা রেকর্ড সংরক্ষণ করবে।
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={async () => {
                  setResetConfirmOpen(false);
                  await onResetDemoData();
                }}
                className="px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                হ্যাঁ, সিড করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
