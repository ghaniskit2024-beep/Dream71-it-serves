import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ManagementPortal } from './components/ManagementPortal';
import { PublicWebsite } from './components/PublicWebsite';
import { StudentPortal } from './components/StudentPortal';
import { INITIAL_INSTITUTE_STATE } from './data/seedData';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAILS,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  deleteBatchDoc,
  deleteCertificateDoc,
  deleteCourseDoc,
  deleteExamDoc,
  deleteInstructorDoc,
  deleteSmsLogDoc,
  deleteStudentDoc,
  saveAttendanceDoc,
  saveBatchDoc,
  saveCertificateDoc,
  saveCourseDoc,
  saveExamDoc,
  saveInstructorDoc,
  savePaymentDoc,
  saveSmsLogBatch,
  saveStudentDoc,
  seedFirestoreIfEmpty,
  seedInitialFirestoreData,
  submitPublicInquiry,
  updateInquiryStatusDoc,
  verifyCertificateById,
} from './services/firestoreService';
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
  SmsNotification,
  Student,
} from './types/institute';
import { generateId, generateReceiptNo } from './utils/storage';

function resolveViewModeFromLocation(): 'public' | 'portal' | 'student' {
  if (typeof window === 'undefined') return 'public';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path === '/student' || path.startsWith('/student/') || hash === '#student') {
    return 'student';
  }
  if (path === '/admin' || path.startsWith('/admin/') || path === '/portal' || hash === '#admin') {
    return 'portal';
  }
  return 'public';
}

export default function App() {
  const [viewMode, setViewMode] = useState<'public' | 'portal' | 'student'>(
    resolveViewModeFromLocation
  );

  const navigateViewMode = (mode: 'public' | 'portal' | 'student') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      const nextPath = mode === 'student' ? '/student' : mode === 'portal' ? '/admin' : '/';
      if (window.location.pathname !== nextPath) {
        window.history.pushState({ viewMode: mode }, '', nextPath);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setViewMode(resolveViewModeFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  // Public collections (start with seedData fallback until Firestore snapshots load)
  const [courses, setCourses] = useState<Course[]>(INITIAL_INSTITUTE_STATE.courses);
  const [batches, setBatches] = useState<Batch[]>(INITIAL_INSTITUTE_STATE.batches);
  const [publicInstructors, setPublicInstructors] = useState<Instructor[]>(
    INITIAL_INSTITUTE_STATE.instructors
  );
  const [privateContacts, setPrivateContacts] = useState<
    Record<string, { phone: string; email: string }>
  >({});

  // Admin-only collections
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsNotification[]>([]);
  const [inquiries, setInquiries] = useState<AdmissionInquiry[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);

  // 1. Auth & Admin Role Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError('');

      if (!currentUser) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      const isBootstrapAdmin =
        Boolean(currentUser.email && BOOTSTRAP_ADMIN_EMAILS.includes(currentUser.email)) &&
        currentUser.emailVerified;

      if (isBootstrapAdmin) {
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        setIsAdmin(adminDoc.exists() && currentUser.emailVerified);
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // 2. Seed Firestore automatically on first Admin login if empty
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;
    let active = true;
    (async () => {
      try {
        setIsSeeding(true);
        await seedFirestoreIfEmpty();
      } catch (err) {
        console.error('Auto-seed error:', err);
      } finally {
        if (active) setIsSeeding(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authReady, user, isAdmin]);

  // 3. Public Listeners (Courses, Batches, Public Instructors)
  useEffect(() => {
    const unsubCourses = onSnapshot(
      collection(db, 'courses'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Course, 'id'>),
          }));
          list.sort((a, b) => a.code.localeCompare(b.code));
          setCourses(list);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'courses')
    );

    const unsubBatches = onSnapshot(
      collection(db, 'batches'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Batch, 'id'>),
          }));
          list.sort((a, b) => a.code.localeCompare(b.code));
          setBatches(list);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'batches')
    );

    const unsubInstructors = onSnapshot(
      collection(db, 'instructors'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            phone: '',
            email: '',
            ...(d.data() as Omit<Instructor, 'id' | 'phone' | 'email'>),
          }));
          setPublicInstructors(list);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'instructors')
    );

    return () => {
      unsubCourses();
      unsubBatches();
      unsubInstructors();
    };
  }, []);

  // 4. Admin-only Listeners (Students, Payments, Attendance, Inquiries, Certificates)
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setStudents([]);
      setPayments([]);
      setAttendance([]);
      setExams([]);
      setSmsLogs([]);
      setInquiries([]);
      setCertificates([]);
      setPrivateContacts({});
      return;
    }

    const unsubStudents = onSnapshot(
      collection(db, 'students'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Student, 'id'>),
        }));
        list.sort((a, b) => b.studentCode.localeCompare(a.studentCode));
        setStudents(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'students')
    );

    const unsubPayments = onSnapshot(
      collection(db, 'payments'),
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
      collection(db, 'attendance'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AttendanceRecord, 'id'>),
        }));
        setAttendance(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'attendance')
    );

    const unsubExams = onSnapshot(
      collection(db, 'exams'),
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

    const unsubSmsLogs = onSnapshot(
      collection(db, 'smsLogs'),
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

    const unsubInquiries = onSnapshot(
      collection(db, 'inquiries'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdmissionInquiry, 'id'>),
        }));
        list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
        setInquiries(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'inquiries')
    );

    const unsubCerts = onSnapshot(
      collection(db, 'certificates'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CertificateRecord, 'id'>),
        }));
        list.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
        setCertificates(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'certificates')
    );

    return () => {
      unsubStudents();
      unsubPayments();
      unsubAttendance();
      unsubExams();
      unsubSmsLogs();
      unsubInquiries();
      unsubCerts();
    };
  }, [authReady, user, isAdmin]);

  // Load private instructor contacts when admin is authenticated
  useEffect(() => {
    if (!authReady || !user || !isAdmin || publicInstructors.length === 0) return;
    let active = true;
    (async () => {
      const next: Record<string, { phone: string; email: string }> = {};
      await Promise.all(
        publicInstructors.map(async (ins) => {
          try {
            const snap = await getDoc(doc(db, 'instructors', ins.id, 'private', 'contact'));
            if (snap.exists()) {
              const d = snap.data();
              next[ins.id] = { phone: d.phone || '', email: d.email || '' };
            }
          } catch {
            // ignore missing private doc
          }
        })
      );
      if (active) setPrivateContacts(next);
    })();
    return () => {
      active = false;
    };
  }, [authReady, user, isAdmin, publicInstructors]);

  const mergedInstructors: Instructor[] = publicInstructors.map((ins) => ({
    ...ins,
    phone: privateContacts[ins.id]?.phone || ins.phone || '',
    email: privateContacts[ins.id]?.email || ins.email || '',
  }));

  const state: InstituteState = {
    courses,
    instructors: mergedInstructors,
    batches,
    students,
    payments,
    attendance,
    exams,
    smsLogs,
    inquiries,
    certificates,
  };

  // Auth Actions
  const handleSignInWithGoogle = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setAuthError(`লগইন সম্পন্ন করা যায়নি: ${msg}`);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleResetDemoData = async () => {
    setIsSeeding(true);
    try {
      await seedInitialFirestoreData();
    } finally {
      setIsSeeding(false);
    }
  };

  // Public Certificate Verification (single doc getDoc + fallback if unseeded)
  const handleVerifyCertificate = async (certId: string): Promise<CertificateRecord | null> => {
    const clean = certId.trim().toUpperCase();
    const fromDb = await verifyCertificateById(clean);
    if (fromDb) return fromDb;
    return (
      INITIAL_INSTITUTE_STATE.certificates.find(
        (c) => c.certificateId.toUpperCase() === clean
      ) || null
    );
  };

  // CRUD handlers backed by Firestore
  const handleAddStudent = async (student: Student, initialPaymentAmount?: number) => {
    const targetBatch = batches.find((b) => b.id === student.batchId);
    const currentCount = students.filter((s) => s.batchId === student.batchId).length;
    const initialPayment: FeePayment | undefined =
      initialPaymentAmount && initialPaymentAmount > 0
        ? {
            id: generateId('pay'),
            receiptNo: generateReceiptNo(payments),
            studentId: student.id,
            studentEmail: student.email,
            amount: initialPaymentAmount,
            method: 'নগদ ক্যাশ',
            reference: 'ADMISSION',
            date: student.enrolledDate,
            note: 'ভর্তির সময় পরিশোধিত',
          }
        : undefined;

    await saveStudentDoc(student, targetBatch, currentCount + 1, initialPayment);
  };

  const handleUpdateStudent = async (updated: Student) => {
    await saveStudentDoc(updated);
  };

  const handleDeleteStudent = async (studentId: string) => {
    const stu = students.find((s) => s.id === studentId);
    const targetBatch = stu ? batches.find((b) => b.id === stu.batchId) : undefined;
    const currentCount = stu ? students.filter((s) => s.batchId === stu.batchId).length : 0;
    await deleteStudentDoc(studentId, targetBatch, Math.max(0, currentCount - 1));
  };

  const handleAddCourse = async (course: Course) => {
    await saveCourseDoc(course);
  };

  const handleUpdateCourse = async (updated: Course) => {
    await saveCourseDoc(updated);
  };

  const handleDeleteCourse = async (courseId: string) => {
    await deleteCourseDoc(courseId);
  };

  const handleAddBatch = async (batch: Batch) => {
    await saveBatchDoc(batch, 0);
  };

  const handleUpdateBatch = async (updated: Batch) => {
    const count = students.filter((s) => s.batchId === updated.id).length;
    await saveBatchDoc(updated, count);
  };

  const handleDeleteBatch = async (batchId: string) => {
    await deleteBatchDoc(batchId);
  };

  const handleSaveAttendance = async (record: AttendanceRecord) => {
    const studentEmails = students
      .filter(
        (s) =>
          s.batchId === record.batchId ||
          Object.prototype.hasOwnProperty.call(record.entries || {}, s.id)
      )
      .map((s) => s.email)
      .filter(Boolean);
    await saveAttendanceDoc({ ...record, studentEmails });
  };

  const handleSaveExam = async (exam: ExamRecord) => {
    const studentEmails = students
      .filter(
        (s) =>
          s.batchId === exam.batchId ||
          Object.prototype.hasOwnProperty.call(exam.scores || {}, s.id)
      )
      .map((s) => s.email)
      .filter(Boolean);
    await saveExamDoc({ ...exam, studentEmails });
  };

  const handleDeleteExam = async (examId: string) => {
    await deleteExamDoc(examId);
  };

  const handleSaveSmsLogs = async (logs: SmsNotification[]) => {
    const enrichedLogs = logs.map((sms) => {
      const stu = students.find((s) => s.id === sms.studentId);
      return {
        ...sms,
        studentEmail: sms.studentEmail || stu?.email || '',
      };
    });
    await saveSmsLogBatch(enrichedLogs);
  };

  const handleDeleteSmsLog = async (id: string) => {
    await deleteSmsLogDoc(id);
  };

  const handleAddPayment = async (payment: FeePayment) => {
    const stu = students.find((s) => s.id === payment.studentId);
    const nextPaid = (stu?.paidAmount || 0) + payment.amount;
    await savePaymentDoc(
      { ...payment, studentEmail: payment.studentEmail || stu?.email || '' },
      nextPaid
    );
  };

  const handleAddInstructor = async (instructor: Instructor) => {
    await saveInstructorDoc(instructor);
  };

  const handleUpdateInstructor = async (updated: Instructor) => {
    await saveInstructorDoc(updated);
  };

  const handleDeleteInstructor = async (id: string) => {
    await deleteInstructorDoc(id);
  };

  const handleSubmitInquiry = async (inquiry: AdmissionInquiry) => {
    await submitPublicInquiry(inquiry);
  };

  const handleUpdateInquiryStatus = async (id: string, status: InquiryStatus) => {
    await updateInquiryStatusDoc(id, status);
  };

  const handleAddCertificate = async (cert: CertificateRecord) => {
    await saveCertificateDoc(cert);
  };

  const handleDeleteCertificate = async (id: string) => {
    await deleteCertificateDoc(id);
  };

  if (viewMode === 'student') {
    return (
      <StudentPortal
        courses={courses}
        batches={batches}
        instructors={mergedInstructors}
        user={user}
        authReady={authReady}
        isAdmin={isAdmin}
        authError={authError}
        onSignInWithGoogle={handleSignInWithGoogle}
        onSignOut={handleSignOut}
        onSwitchToPublic={() => navigateViewMode('public')}
        onOpenAdminPortal={() => navigateViewMode('portal')}
      />
    );
  }

  if (viewMode === 'portal') {
    return (
      <ManagementPortal
        state={state}
        user={user}
        authReady={authReady}
        isAdmin={isAdmin}
        authError={authError}
        isSeeding={isSeeding}
        onSignInWithGoogle={handleSignInWithGoogle}
        onSignOut={handleSignOut}
        onSwitchToPublic={() => navigateViewMode('public')}
        onSwitchToStudent={() => navigateViewMode('student')}
        onResetDemoData={handleResetDemoData}
        onAddStudent={handleAddStudent}
        onUpdateStudent={handleUpdateStudent}
        onDeleteStudent={handleDeleteStudent}
        onAddCourse={handleAddCourse}
        onUpdateCourse={handleUpdateCourse}
        onDeleteCourse={handleDeleteCourse}
        onAddBatch={handleAddBatch}
        onUpdateBatch={handleUpdateBatch}
        onDeleteBatch={handleDeleteBatch}
        onSaveAttendance={handleSaveAttendance}
        onSaveExam={handleSaveExam}
        onDeleteExam={handleDeleteExam}
        onSaveSmsLogs={handleSaveSmsLogs}
        onDeleteSmsLog={handleDeleteSmsLog}
        onAddPayment={handleAddPayment}
        onAddInstructor={handleAddInstructor}
        onUpdateInstructor={handleUpdateInstructor}
        onDeleteInstructor={handleDeleteInstructor}
        onUpdateInquiryStatus={handleUpdateInquiryStatus}
        onAddCertificate={handleAddCertificate}
        onDeleteCertificate={handleDeleteCertificate}
      />
    );
  }

  return (
    <PublicWebsite
      state={state}
      onOpenPortal={() => navigateViewMode('portal')}
      onOpenStudentPortal={() => navigateViewMode('student')}
      onSubmitInquiry={handleSubmitInquiry}
      onVerifyCertificate={handleVerifyCertificate}
    />
  );
}
