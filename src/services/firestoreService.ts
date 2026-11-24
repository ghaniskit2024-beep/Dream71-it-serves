import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { INITIAL_INSTITUTE_STATE } from '../data/seedData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AdmissionInquiry,
  AttendanceRecord,
  Batch,
  CertificateRecord,
  Course,
  ExamRecord,
  FeePayment,
  InquiryStatus,
  Instructor,
  SmsNotification,
  Student,
} from '../types/institute';

const clip = (val: string, max: number) => String(val || '').trim().slice(0, max);
const clipEmail = (val?: string) => clip(val || '', 120).toLowerCase();
const cleanEmailList = (emails?: string[]) =>
  Array.from(new Set((emails || []).map((e) => clipEmail(e)).filter(Boolean))).slice(0, 200);

// Strictly strip extra properties so Firestore keys().hasOnly() passes cleanly
function toCoursePayload(course: Course) {
  const syllabus = (course.syllabus || [])
    .map((s) => clip(s, 240))
    .filter(Boolean)
    .slice(0, 20);
  return {
    code: clip(course.code, 24) || 'CRS-100',
    title: clip(course.title, 160),
    category: course.category,
    categoryLabel: clip(course.categoryLabel, 80),
    durationWeeks: Math.max(1, Math.min(200, Number(course.durationWeeks) || 12)),
    totalClasses: Math.max(1, Math.min(500, Number(course.totalClasses) || 36)),
    fee: Math.max(0, Math.min(500000, Number(course.fee) || 0)),
    summary: clip(course.summary, 600),
    syllabus: syllabus.length > 0 ? syllabus : ['মূল প্রশিক্ষণ মডিউল'],
    imageUrl: clip(course.imageUrl, 300),
    active: Boolean(course.active),
  };
}

function toInstructorPublicPayload(ins: Instructor) {
  return {
    name: clip(ins.name, 120),
    designation: clip(ins.designation, 120),
    specialty: clip(ins.specialty, 200),
    experienceYears: Math.max(0, Math.min(60, Number(ins.experienceYears) || 1)),
    active: Boolean(ins.active),
  };
}

function toInstructorPrivatePayload(ins: Instructor) {
  return {
    phone: clip(ins.phone, 30),
    email: clip(ins.email, 120),
  };
}

function toBatchPayload(batch: Batch, enrolledCount = 0) {
  return {
    code: clip(batch.code, 32),
    courseId: clip(batch.courseId, 128),
    instructorId: clip(batch.instructorId, 128),
    schedule: clip(batch.schedule, 160),
    room: clip(batch.room, 100),
    startDate: clip(batch.startDate, 30),
    capacity: Math.max(1, Math.min(500, Number(batch.capacity) || 25)),
    enrolledCount: Math.max(0, Math.min(500, Number(enrolledCount) || 0)),
    status: batch.status,
  };
}

function toStudentPayload(stu: Student) {
  return {
    studentCode: clip(stu.studentCode, 32),
    name: clip(stu.name, 120),
    phone: clip(stu.phone, 30),
    email: clipEmail(stu.email),
    address: clip(stu.address, 240),
    guardianName: clip(stu.guardianName || '', 120),
    guardianPhone: clip(stu.guardianPhone || '', 30),
    courseId: clip(stu.courseId, 128),
    batchId: clip(stu.batchId, 128),
    enrolledDate: clip(stu.enrolledDate, 30),
    totalFee: Math.max(0, Math.min(500000, Number(stu.totalFee) || 0)),
    discount: Math.max(0, Math.min(500000, Number(stu.discount) || 0)),
    paidAmount: Math.max(0, Math.min(500000, Number(stu.paidAmount) || 0)),
    status: stu.status,
  };
}

export async function seedFirestoreIfEmpty(): Promise<boolean> {
  try {
    const existingCourses = await getDocs(collection(db, 'courses'));
    if (!existingCourses.empty) {
      const hasPaidCourse = existingCourses.docs.some((d) => d.id === 'crs-9');
      if (!hasPaidCourse && existingCourses.size <= 8) {
        const paidCourse = INITIAL_INSTITUTE_STATE.courses.find((c) => c.id === 'crs-9');
        const paidBatch = INITIAL_INSTITUTE_STATE.batches.find((b) => b.id === 'bat-7');
        if (paidCourse) {
          const patchBatch = writeBatch(db);
          patchBatch.set(doc(db, 'courses', paidCourse.id), toCoursePayload(paidCourse));
          if (paidBatch) {
            patchBatch.set(doc(db, 'batches', paidBatch.id), toBatchPayload(paidBatch, 0));
          }
          await patchBatch.commit();
        }
      }
      return false;
    }
    await seedInitialFirestoreData();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'courses');
  }
}

export async function seedInitialFirestoreData(): Promise<void> {
  try {
    // Batch 1: Parent collections (courses & instructors)
    const parentBatch = writeBatch(db);
    for (const course of INITIAL_INSTITUTE_STATE.courses) {
      parentBatch.set(doc(db, 'courses', course.id), toCoursePayload(course));
    }
    for (const ins of INITIAL_INSTITUTE_STATE.instructors) {
      parentBatch.set(doc(db, 'instructors', ins.id), toInstructorPublicPayload(ins));
      parentBatch.set(
        doc(db, 'instructors', ins.id, 'private', 'contact'),
        toInstructorPrivatePayload(ins)
      );
    }
    await parentBatch.commit();

    // Batch 2: Batches (depends on courses & instructors)
    const batchCommit = writeBatch(db);
    for (const b of INITIAL_INSTITUTE_STATE.batches) {
      const enrolledCount = INITIAL_INSTITUTE_STATE.students.filter(
        (s) => s.batchId === b.id
      ).length;
      batchCommit.set(doc(db, 'batches', b.id), toBatchPayload(b, enrolledCount));
    }
    await batchCommit.commit();

    // Batch 3: Students, Attendance, Exams, SMS Logs, Inquiries, Certificates
    const leafBatch = writeBatch(db);
    for (const stu of INITIAL_INSTITUTE_STATE.students) {
      leafBatch.set(doc(db, 'students', stu.id), toStudentPayload(stu));
    }
    for (const att of INITIAL_INSTITUTE_STATE.attendance) {
      const attEmails = cleanEmailList(
        INITIAL_INSTITUTE_STATE.students
          .filter(
            (s) =>
              s.batchId === att.batchId ||
              Object.prototype.hasOwnProperty.call(att.entries || {}, s.id)
          )
          .map((s) => s.email)
      );
      leafBatch.set(doc(db, 'attendance', att.id), {
        batchId: clip(att.batchId, 128),
        date: clip(att.date, 30),
        entries: att.entries,
        studentEmails: attEmails,
      });
    }
    for (const exam of INITIAL_INSTITUTE_STATE.exams) {
      const examEmails = cleanEmailList(
        INITIAL_INSTITUTE_STATE.students
          .filter(
            (s) =>
              s.batchId === exam.batchId ||
              Object.prototype.hasOwnProperty.call(exam.scores || {}, s.id)
          )
          .map((s) => s.email)
      );
      leafBatch.set(doc(db, 'exams', exam.id), {
        title: clip(exam.title, 160),
        batchId: clip(exam.batchId, 128),
        courseId: clip(exam.courseId, 128),
        examDate: clip(exam.examDate, 30),
        totalMarks: Math.max(1, Math.min(1000, Number(exam.totalMarks) || 100)),
        passMarks: Math.max(0, Math.min(1000, Number(exam.passMarks) || 40)),
        scores: exam.scores || {},
        createdAt: clip(exam.createdAt, 30),
        studentEmails: examEmails,
      });
    }
    for (const sms of INITIAL_INSTITUTE_STATE.smsLogs) {
      const targetStu = INITIAL_INSTITUTE_STATE.students.find((s) => s.id === sms.studentId);
      leafBatch.set(doc(db, 'smsLogs', sms.id), {
        studentId: clip(sms.studentId, 128),
        studentName: clip(sms.studentName, 120),
        studentEmail: clipEmail(sms.studentEmail || targetStu?.email),
        guardianPhone: clip(sms.guardianPhone, 30),
        category: sms.category,
        message: clip(sms.message, 500),
        sentAt: clip(sms.sentAt, 40),
        channel: sms.channel,
      });
    }
    for (const inq of INITIAL_INSTITUTE_STATE.inquiries) {
      leafBatch.set(doc(db, 'inquiries', inq.id), {
        name: clip(inq.name, 120),
        phone: clip(inq.phone, 30),
        email: clip(inq.email, 120),
        courseId: clip(inq.courseId, 128),
        preferredSlot: clip(inq.preferredSlot, 100),
        message: clip(inq.message, 600),
        submittedAt: clip(inq.submittedAt, 30),
        createdAt: serverTimestamp(),
        status: 'অপেক্ষমাণ',
      });
    }
    for (const cert of INITIAL_INSTITUTE_STATE.certificates) {
      leafBatch.set(doc(db, 'certificates', cert.certificateId), {
        certificateId: clip(cert.certificateId, 64),
        studentName: clip(cert.studentName, 120),
        studentCode: clip(cert.studentCode, 40),
        courseTitle: clip(cert.courseTitle, 180),
        batchCode: clip(cert.batchCode, 40),
        grade: clip(cert.grade, 40),
        issueDate: clip(cert.issueDate, 30),
      });
    }
    await leafBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed');
  }
}

export async function saveCourseDoc(course: Course): Promise<void> {
  const path = `courses/${course.id}`;
  try {
    await setDoc(doc(db, 'courses', course.id), toCoursePayload(course));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCourseDoc(courseId: string): Promise<void> {
  const path = `courses/${courseId}`;
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveInstructorDoc(ins: Instructor): Promise<void> {
  const path = `instructors/${ins.id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'instructors', ins.id), toInstructorPublicPayload(ins));
    batch.set(
      doc(db, 'instructors', ins.id, 'private', 'contact'),
      toInstructorPrivatePayload(ins)
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInstructorDoc(instructorId: string): Promise<void> {
  const path = `instructors/${instructorId}`;
  try {
    await deleteDoc(doc(db, 'instructors', instructorId, 'private', 'contact')).catch(() => {});
    await deleteDoc(doc(db, 'instructors', instructorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBatchDoc(batchData: Batch, enrolledCount = 0): Promise<void> {
  const path = `batches/${batchData.id}`;
  try {
    await setDoc(doc(db, 'batches', batchData.id), toBatchPayload(batchData, enrolledCount));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBatchDoc(batchId: string): Promise<void> {
  const path = `batches/${batchId}`;
  try {
    await deleteDoc(doc(db, 'batches', batchId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveStudentDoc(
  student: Student,
  batch?: Batch,
  nextEnrolledCount?: number,
  initialPayment?: FeePayment
): Promise<void> {
  const path = `students/${student.id}`;
  try {
    const wb = writeBatch(db);
    wb.set(doc(db, 'students', student.id), toStudentPayload(student));
    if (batch && typeof nextEnrolledCount === 'number') {
      wb.update(doc(db, 'batches', batch.id), {
        enrolledCount: Math.max(0, Math.min(500, nextEnrolledCount)),
      });
    }
    if (initialPayment && initialPayment.amount > 0) {
      wb.set(doc(db, 'payments', initialPayment.id), {
        receiptNo: clip(initialPayment.receiptNo, 40),
        studentId: clip(initialPayment.studentId, 128),
        studentEmail: clipEmail(initialPayment.studentEmail || student.email),
        amount: Math.max(1, Math.min(500000, Number(initialPayment.amount))),
        method: initialPayment.method,
        reference: clip(initialPayment.reference, 80),
        date: clip(initialPayment.date, 30),
        note: clip(initialPayment.note, 200),
        billingMonth: clip(initialPayment.billingMonth || initialPayment.date.slice(0, 7), 20),
      });
    }
    await wb.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStudentDoc(
  studentId: string,
  batch?: Batch,
  nextEnrolledCount?: number
): Promise<void> {
  const path = `students/${studentId}`;
  try {
    const wb = writeBatch(db);
    wb.delete(doc(db, 'students', studentId));
    if (batch && typeof nextEnrolledCount === 'number') {
      wb.update(doc(db, 'batches', batch.id), {
        enrolledCount: Math.max(0, Math.min(500, nextEnrolledCount)),
      });
    }
    await wb.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePaymentDoc(payment: FeePayment, updatedPaidAmount: number): Promise<void> {
  const path = `payments/${payment.id}`;
  try {
    const wb = writeBatch(db);
    wb.set(doc(db, 'payments', payment.id), {
      receiptNo: clip(payment.receiptNo, 40),
      studentId: clip(payment.studentId, 128),
      studentEmail: clipEmail(payment.studentEmail),
      amount: Math.max(1, Math.min(500000, Number(payment.amount))),
      method: payment.method,
      reference: clip(payment.reference, 80),
      date: clip(payment.date, 30),
      note: clip(payment.note, 200),
      billingMonth: clip(payment.billingMonth || payment.date.slice(0, 7), 20),
    });
    wb.update(doc(db, 'students', payment.studentId), {
      paidAmount: Math.max(0, Math.min(500000, Number(updatedPaidAmount))),
    });
    await wb.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAttendanceDoc(record: AttendanceRecord): Promise<void> {
  const path = `attendance/${record.id}`;
  try {
    await setDoc(doc(db, 'attendance', record.id), {
      batchId: clip(record.batchId, 128),
      date: clip(record.date, 30),
      entries: record.entries,
      studentEmails: cleanEmailList(record.studentEmails),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveExamDoc(exam: ExamRecord): Promise<void> {
  const path = `exams/${exam.id}`;
  try {
    const sanitizedScores: Record<string, number> = {};
    Object.entries(exam.scores || {}).forEach(([stuId, score]) => {
      const cleanId = clip(stuId, 128);
      if (cleanId) {
        sanitizedScores[cleanId] = Math.max(0, Math.min(1000, Number(score) || 0));
      }
    });
    await setDoc(doc(db, 'exams', exam.id), {
      title: clip(exam.title, 160),
      batchId: clip(exam.batchId, 128),
      courseId: clip(exam.courseId, 128),
      examDate: clip(exam.examDate, 30),
      totalMarks: Math.max(1, Math.min(1000, Number(exam.totalMarks) || 100)),
      passMarks: Math.max(0, Math.min(1000, Number(exam.passMarks) || 40)),
      scores: sanitizedScores,
      createdAt: clip(exam.createdAt, 30) || new Date().toISOString().slice(0, 10),
      studentEmails: cleanEmailList(exam.studentEmails),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteExamDoc(examId: string): Promise<void> {
  const path = `exams/${examId}`;
  try {
    await deleteDoc(doc(db, 'exams', examId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSmsLogDoc(sms: SmsNotification): Promise<void> {
  const path = `smsLogs/${sms.id}`;
  try {
    await setDoc(doc(db, 'smsLogs', sms.id), {
      studentId: clip(sms.studentId, 128),
      studentName: clip(sms.studentName, 120),
      studentEmail: clipEmail(sms.studentEmail),
      guardianPhone: clip(sms.guardianPhone, 30),
      category: sms.category,
      message: clip(sms.message, 500),
      sentAt: clip(sms.sentAt, 40),
      channel: sms.channel,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSmsLogBatch(logs: SmsNotification[]): Promise<void> {
  if (logs.length === 0) return;
  try {
    for (let i = 0; i < logs.length; i += 100) {
      const chunk = logs.slice(i, i + 100);
      const wb = writeBatch(db);
      for (const sms of chunk) {
        wb.set(doc(db, 'smsLogs', sms.id), {
          studentId: clip(sms.studentId, 128),
          studentName: clip(sms.studentName, 120),
          studentEmail: clipEmail(sms.studentEmail),
          guardianPhone: clip(sms.guardianPhone, 30),
          category: sms.category,
          message: clip(sms.message, 500),
          sentAt: clip(sms.sentAt, 40),
          channel: sms.channel,
        });
      }
      await wb.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'smsLogs');
  }
}

export async function deleteSmsLogDoc(smsId: string): Promise<void> {
  const path = `smsLogs/${smsId}`;
  try {
    await deleteDoc(doc(db, 'smsLogs', smsId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function submitPublicInquiry(inquiry: AdmissionInquiry): Promise<void> {
  const path = `inquiries/${inquiry.id}`;
  try {
    await setDoc(doc(db, 'inquiries', inquiry.id), {
      name: clip(inquiry.name, 120),
      phone: clip(inquiry.phone, 30),
      email: clip(inquiry.email, 120),
      courseId: clip(inquiry.courseId, 128),
      preferredSlot: clip(inquiry.preferredSlot, 100),
      message: clip(inquiry.message, 600),
      submittedAt: clip(inquiry.submittedAt, 30),
      createdAt: serverTimestamp(),
      status: 'অপেক্ষমাণ',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateInquiryStatusDoc(id: string, status: InquiryStatus): Promise<void> {
  const path = `inquiries/${id}`;
  try {
    await updateDoc(doc(db, 'inquiries', id), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveCertificateDoc(cert: CertificateRecord): Promise<void> {
  const certKey = clip(cert.certificateId, 64);
  const path = `certificates/${certKey}`;
  try {
    await setDoc(doc(db, 'certificates', certKey), {
      certificateId: certKey,
      studentName: clip(cert.studentName, 120),
      studentCode: clip(cert.studentCode, 40),
      courseTitle: clip(cert.courseTitle, 180),
      batchCode: clip(cert.batchCode, 40),
      grade: clip(cert.grade, 40),
      issueDate: clip(cert.issueDate, 30),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCertificateDoc(certificateId: string): Promise<void> {
  const path = `certificates/${certificateId}`;
  try {
    await deleteDoc(doc(db, 'certificates', certificateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function verifyCertificateById(certId: string): Promise<CertificateRecord | null> {
  const cleanId = clip(certId.toUpperCase(), 64);
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(cleanId)) {
    return null;
  }
  const path = `certificates/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'certificates', cleanId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      certificateId: data.certificateId,
      studentName: data.studentName,
      studentCode: data.studentCode,
      courseTitle: data.courseTitle,
      batchCode: data.batchCode,
      grade: data.grade,
      issueDate: data.issueDate,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
