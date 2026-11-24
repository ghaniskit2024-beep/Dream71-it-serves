import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { InstituteState, Student, StudentStatus } from '../../types/institute';
import {
  exportCsv,
  formatBDT,
  generateId,
  generateStudentCode,
  getNetFee,
  getPaymentStatusLabel,
  getStudentDue,
} from '../../utils/storage';
import { QrCodeBadge } from './QrCodeBadge';

interface StudentsViewProps {
  state: InstituteState;
  onAddStudent: (student: Student, initialPaymentAmount?: number) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onOpenPaymentForStudent: (studentId: string) => void;
  prefillStudent?: {
    name: string;
    phone: string;
    email: string;
    courseId: string;
    inquiryId?: string;
  } | null;
  onClearPrefill?: () => void;
}

export function StudentsView({
  state,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onOpenPaymentForStudent,
  prefillStudent,
  onClearPrefill,
}: StudentsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<
    'all' | 'ফ্রি কোর্স' | 'পরিশোধিত' | 'আংশিক' | 'বকেয়া'
  >('all');

  const [isFormOpen, setIsFormOpen] = useState(Boolean(prefillStudent));
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form states
  const defaultCourseId = prefillStudent?.courseId || state.courses[0]?.id || '';
  const defaultBatchForCourse =
    state.batches.find((b) => b.courseId === defaultCourseId && b.status !== 'সম্পন্ন')?.id ||
    state.batches[0]?.id ||
    '';

  const [name, setName] = useState(prefillStudent?.name || '');
  const [phone, setPhone] = useState(prefillStudent?.phone || '');
  const [email, setEmail] = useState(prefillStudent?.email || '');
  const [address, setAddress] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [batchId, setBatchId] = useState(defaultBatchForCourse);
  const [discount, setDiscount] = useState(0);
  const [initialPaid, setInitialPaid] = useState(0);
  const [status, setStatus] = useState<StudentStatus>('সক্রিয়');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (prefillStudent) {
      const targetCourseId = prefillStudent.courseId || state.courses[0]?.id || '';
      const targetBatchId =
        state.batches.find((b) => b.courseId === targetCourseId && b.status !== 'সম্পন্ন')?.id ||
        state.batches[0]?.id ||
        '';
      setEditingStudent(null);
      setName(prefillStudent.name || '');
      setPhone(prefillStudent.phone || '');
      setEmail(prefillStudent.email || '');
      setAddress('');
      setGuardianName('');
      setGuardianPhone('');
      setCourseId(targetCourseId);
      setBatchId(targetBatchId);
      setDiscount(0);
      setInitialPaid(0);
      setStatus('সক্রিয়');
      setFormError('');
      setIsFormOpen(true);
    }
  }, [prefillStudent, state.courses, state.batches]);

  const openCreateModal = () => {
    const firstCourse = state.courses[0];
    const firstBatch = state.batches.find((b) => b.courseId === firstCourse?.id) || state.batches[0];
    setEditingStudent(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGuardianName('');
    setGuardianPhone('');
    setCourseId(firstCourse?.id || '');
    setBatchId(firstBatch?.id || '');
    setDiscount(0);
    setInitialPaid(0);
    setStatus('সক্রিয়');
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setName(student.name);
    setPhone(student.phone);
    setEmail(student.email);
    setAddress(student.address);
    setGuardianName(student.guardianName || '');
    setGuardianPhone(student.guardianPhone || '');
    setCourseId(student.courseId);
    setBatchId(student.batchId);
    setDiscount(student.discount);
    setInitialPaid(student.paidAmount);
    setStatus(student.status);
    setFormError('');
    setIsFormOpen(true);
  };

  const closeModal = () => {
    setIsFormOpen(false);
    setEditingStudent(null);
    onClearPrefill?.();
  };

  const handleCourseChange = (newCourseId: string) => {
    setCourseId(newCourseId);
    const matchingBatch = state.batches.find((b) => b.courseId === newCourseId);
    if (matchingBatch) {
      setBatchId(matchingBatch.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !courseId || !batchId) {
      setFormError('শিক্ষার্থীর নাম, মোবাইল নম্বর, কোর্স এবং ব্যাচ নির্বাচন করা আবশ্যক।');
      return;
    }

    const selectedCourse = state.courses.find((c) => c.id === courseId);
    const courseFee = selectedCourse?.fee ?? 0;
    const cleanDiscount = Math.max(0, Math.min(courseFee, Number(discount) || 0));
    const netFee = courseFee - cleanDiscount;
    const cleanPaid = Math.max(0, Math.min(netFee, Number(initialPaid) || 0));

    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim(),
        courseId,
        batchId,
        totalFee: courseFee,
        discount: cleanDiscount,
        status,
      });
    } else {
      const newStudent: Student = {
        id: generateId('stu'),
        studentCode: generateStudentCode(state.students),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim() || 'নাঙ্গলকোট, কুমিল্লা',
        guardianName: guardianName.trim(),
        guardianPhone: guardianPhone.trim() || phone.trim(),
        courseId,
        batchId,
        enrolledDate: new Date().toISOString().slice(0, 10),
        totalFee: courseFee,
        discount: cleanDiscount,
        paidAmount: cleanPaid,
        status,
      };
      onAddStudent(newStudent, cleanPaid);
    }

    closeModal();
  };

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.students.filter((student) => {
      if (courseFilter !== 'all' && student.courseId !== courseFilter) return false;
      if (paymentFilter !== 'all' && getPaymentStatusLabel(student) !== paymentFilter) return false;
      if (!q) return true;
      return (
        student.name.toLowerCase().includes(q) ||
        student.studentCode.toLowerCase().includes(q) ||
        student.phone.toLowerCase().includes(q)
      );
    });
  }, [state.students, searchQuery, courseFilter, paymentFilter]);

  const selectedStudent = state.students.find((s) => s.id === selectedStudentId) || null;
  const studentPayments = selectedStudent
    ? state.payments.filter((p) => p.studentId === selectedStudent.id)
    : [];

  const getAttendanceRate = (studentId: string, stuBatchId: string) => {
    const batchRecords = state.attendance.filter((a) => a.batchId === stuBatchId);
    if (batchRecords.length === 0) return null;
    let present = 0;
    let total = 0;
    batchRecords.forEach((rec) => {
      if (rec.entries[studentId]) {
        total += 1;
        if (rec.entries[studentId] !== 'অনুপস্থিত') present += 1;
      }
    });
    if (total === 0) return null;
    return Math.round((present / total) * 100);
  };

  const handleExportCsv = () => {
    const headers = [
      'আইডি',
      'নাম',
      'মোবাইল',
      'কোর্স',
      'ব্যাচ',
      'নিট ফি',
      'পরিশোধিত',
      'বকেয়া',
      'অবস্থা',
    ];
    const rows = filteredStudents.map((s) => {
      const course = state.courses.find((c) => c.id === s.courseId);
      const batch = state.batches.find((b) => b.id === s.batchId);
      return [
        s.studentCode,
        s.name,
        s.phone,
        course?.title || '',
        batch?.code || '',
        getNetFee(s),
        s.paidAmount,
        getStudentDue(s),
        s.status,
      ];
    });
    exportCsv(`students-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম, আইডি বা মোবাইল নম্বর দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            aria-label="কোর্স অনুযায়ী ফিল্টার"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-blue-700"
          >
            <option value="all">সব কোর্স</option>
            {state.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(['all', 'ফ্রি কোর্স', 'পরিশোধিত', 'আংশিক', 'বকেয়া'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPaymentFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  paymentFilter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'all' ? 'সব' : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 text-slate-700 bg-white rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            CSV ডাউনলোড
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন শিক্ষার্থী ভর্তি
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
            <p className="text-xs text-slate-500">
              সার্চ বা ফিল্টার পরিবর্তন করুন অথবা নতুন শিক্ষার্থী ভর্তি করুন।
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              প্রথম শিক্ষার্থী যোগ করুন
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">আইডি</th>
                  <th className="py-3 px-4 whitespace-nowrap">শিক্ষার্থীর নাম ও যোগাযোগ</th>
                  <th className="py-3 px-4 whitespace-nowrap">কোর্স ও ব্যাচ</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">নিট ফি</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">পরিশোধিত</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">বকেয়া</th>
                  <th className="py-3 px-4 whitespace-nowrap">পেমেন্ট অবস্থা</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((student) => {
                  const course = state.courses.find((c) => c.id === student.courseId);
                  const batch = state.batches.find((b) => b.id === student.batchId);
                  const netFee = getNetFee(student);
                  const due = getStudentDue(student);
                  const payState = getPaymentStatusLabel(student);

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {student.studentCode}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{student.name}</p>
                        <p className="text-xs text-slate-500 font-mono-tabular">{student.phone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 text-xs font-medium max-w-[220px] truncate">
                          {course?.title}
                        </p>
                        <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                          ব্যাচ: {batch?.code || 'N/A'} · {student.status}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-700 whitespace-nowrap">
                        {formatBDT(netFee)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-emerald-700 font-medium whitespace-nowrap">
                        {formatBDT(student.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-900 font-medium whitespace-nowrap">
                        {formatBDT(due)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            payState === 'ফ্রি কোর্স' || payState === 'পরিশোধিত'
                              ? 'text-emerald-700'
                              : payState === 'আংশিক'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {payState === 'ফ্রি কোর্স' || payState === 'পরিশোধিত' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : payState === 'আংশিক' ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          {payState}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentId(student.id)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                            title="বিস্তারিত প্রোফাইল"
                            aria-label="প্রোফাইল দেখুন"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(student)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            title="তথ্য সম্পাদনা"
                            aria-label="সম্পাদনা করুন"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(student.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                            title="মুছে ফেলুন"
                            aria-label="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingStudent ? 'শিক্ষার্থীর তথ্য সম্পাদনা' : 'নতুন শিক্ষার্থী ভর্তি'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    শিক্ষার্থীর পূর্ণ নাম *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="যেমন: তানজিম আহমেদ"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    মোবাইল নম্বর *
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017XX-XXXXXX"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ইমেইল</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@email.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ঠিকানা</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="নাঙ্গলকোট, কুমিল্লা"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    অভিভাবকের নাম
                  </label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="যেমন: মোঃ আবুল কালাম (পিতা)"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    অভিভাবকের মোবাইল (SMS)
                  </label>
                  <input
                    type="text"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="017XX-XXXXXX"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">কোর্স *</label>
                  <select
                    value={courseId}
                    onChange={(e) => handleCourseChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-700"
                    required
                  >
                    {state.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({formatBDT(c.fee)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ব্যাচ *</label>
                  <select
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-700"
                    required
                  >
                    {state.batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.schedule}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">
                      ছাড় / স্কলারশিপ (৳)
                    </label>
                    {(() => {
                      const selCourse = state.courses.find((c) => c.id === courseId);
                      if (!selCourse || selCourse.fee <= 0) return null;
                      const seventyOff = Math.round(selCourse.fee * 0.7);
                      return (
                        <button
                          type="button"
                          onClick={() => setDiscount(seventyOff)}
                          className="text-[11px] font-medium text-blue-700 hover:underline"
                        >
                          ৭০% বৃত্তি ({formatBDT(seventyOff)})
                        </button>
                      );
                    })()}
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
                  />
                </div>
                {!editingStudent && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ভর্তির সময় জমা (৳)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={initialPaid}
                      onChange={(e) => setInitialPaid(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">অবস্থা</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StudentStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-700"
                  >
                    <option value="সক্রিয়">সক্রিয়</option>
                    <option value="সম্পন্ন">সম্পন্ন</option>
                    <option value="বিরতি">বিরতি</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  {editingStudent ? 'পরিবর্তন সংরক্ষণ করুন' : 'ভর্তি সম্পন্ন করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Detail Drawer */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-md h-full border-l border-slate-200 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-mono-tabular text-blue-700 font-semibold">
                  {selectedStudent.studentCode}
                </p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selectedStudent.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedStudent.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">মোবাইল</p>
                <p className="font-mono-tabular text-slate-900 mt-0.5">{selectedStudent.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">ইমেইল</p>
                <p className="text-slate-900 truncate mt-0.5">{selectedStudent.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">ভর্তির তারিখ</p>
                <p className="font-mono-tabular text-slate-900 mt-0.5">
                  {selectedStudent.enrolledDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">উপস্থিতির হার</p>
                <p className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                  {(() => {
                    const rate = getAttendanceRate(selectedStudent.id, selectedStudent.batchId);
                    return rate === null ? 'তথ্য নেই' : `${rate}%`;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">অভিভাবক</p>
                <p className="text-slate-900 truncate mt-0.5">
                  {selectedStudent.guardianName || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">অভিভাবকের মোবাইল (SMS)</p>
                <p className="font-mono-tabular text-slate-900 mt-0.5">
                  {selectedStudent.guardianPhone || selectedStudent.phone}
                </p>
              </div>
            </div>

            {/* Digital Student QR ID Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-900">ডিজিটাল হাজিরা QR আইডি</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  ক্লাসে প্রবেশের সময় এই QR কোড স্ক্যান করে তাৎক্ষণিক ডিজিটাল হাজিরা নেওয়া যাবে।
                </p>
              </div>
              <QrCodeBadge
                value={selectedStudent.studentCode}
                subLabel={selectedStudent.studentCode}
                size={92}
                allowDownload
              />
            </div>

            <div className="border-t border-b border-slate-200 py-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">কোর্স ফি</span>
                <span className="font-mono-tabular">{formatBDT(selectedStudent.totalFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">ছাড়</span>
                <span className="font-mono-tabular text-slate-600">
                  -{formatBDT(selectedStudent.discount)}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-900">পরিশোধিত</span>
                <span className="font-mono-tabular text-emerald-700">
                  {formatBDT(selectedStudent.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-900">বকেয়া</span>
                <span className="font-mono-tabular text-amber-700">
                  {formatBDT(getStudentDue(selectedStudent))}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">পেমেন্ট ইতিহাস</h4>
                {getStudentDue(selectedStudent) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedStudent.id;
                      setSelectedStudentId(null);
                      onOpenPaymentForStudent(id);
                    }}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800"
                  >
                    + ফি জমা নিন
                  </button>
                )}
              </div>

              {studentPayments.length === 0 ? (
                <p className="text-xs text-slate-500">এখনো কোনো পেমেন্ট এন্ট্রি নেই।</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {studentPayments.map((pay) => (
                    <div key={pay.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-mono-tabular font-medium text-slate-900">
                          {pay.receiptNo}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {pay.method} · {pay.date}
                        </p>
                      </div>
                      <span className="font-mono-tabular font-semibold text-emerald-700">
                        {formatBDT(pay.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">শিক্ষার্থীর রেকর্ড মুছে ফেলবেন?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              এই শিক্ষার্থীর প্রোফাইল স্থায়ীভাবে মুছে যাবে। পেমেন্ট হিস্ট্রি সংরক্ষণের প্রয়োজন হলে
              অবস্থা &quot;বিরতি&quot; হিসেবে আপডেট করতে পারেন।
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteStudent(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-3.5 py-2 text-xs font-medium bg-rose-700 text-white rounded-lg hover:bg-rose-800"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
