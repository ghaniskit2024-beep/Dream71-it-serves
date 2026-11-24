import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  MessageSquare,
  Plus,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { FeePayment, InstituteState, PaymentMethod } from '../../types/institute';
import {
  exportCsv,
  formatBDT,
  generateId,
  generateReceiptNo,
  getNetFee,
  getStudentDue,
} from '../../utils/storage';
import { ReceiptPrintModal } from './ReceiptPrintModal';

interface FeesViewProps {
  state: InstituteState;
  onAddPayment: (payment: FeePayment) => void;
  onSendDueSms: (studentId: string, message: string) => void;
  preselectedStudentId?: string | null;
  onClearPreselectedStudent?: () => void;
}

export function FeesView({
  state,
  onAddPayment,
  onSendDueSms,
  preselectedStudentId,
  onClearPreselectedStudent,
}: FeesViewProps) {
  const [subTab, setSubTab] = useState<'ledger' | 'history'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const [isModalOpen, setIsModalOpen] = useState(Boolean(preselectedStudentId));
  const [studentId, setStudentId] = useState(
    preselectedStudentId ||
      state.students.find((s) => getStudentDue(s) > 0)?.id ||
      state.students[0]?.id ||
      ''
  );
  const [amount, setAmount] = useState(1500);
  const [method, setMethod] = useState<PaymentMethod>('বিকাশ');
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('মাসিক বেতন / কোর্স ফি');
  const [formError, setFormError] = useState('');

  const [printingPayment, setPrintingPayment] = useState<FeePayment | null>(null);

  useEffect(() => {
    if (preselectedStudentId) {
      setStudentId(preselectedStudentId);
      const stu = state.students.find((s) => s.id === preselectedStudentId);
      if (stu) {
        setAmount(Math.max(500, getStudentDue(stu)));
      }
      setIsModalOpen(true);
    }
  }, [preselectedStudentId, state.students]);

  const totalCollected = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDue = state.students.reduce((sum, s) => sum + getStudentDue(s), 0);
  const dueStudents = state.students.filter((s) => getStudentDue(s) > 0);
  const monthCollected = state.payments
    .filter((p) => (p.billingMonth || p.date.slice(0, 7)) === selectedMonth)
    .reduce((sum, p) => sum + p.amount, 0);

  const selectedStudent = state.students.find((s) => s.id === studentId);
  const selectedDue = selectedStudent ? getStudentDue(selectedStudent) : 0;

  const filteredPayments = state.payments.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const stu = state.students.find((s) => s.id === p.studentId);
    return (
      p.receiptNo.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q) ||
      (stu?.name.toLowerCase().includes(q) ?? false) ||
      (stu?.studentCode.toLowerCase().includes(q) ?? false)
    );
  });

  const filteredLedgerStudents = state.students.filter((stu) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      stu.name.toLowerCase().includes(q) ||
      stu.studentCode.toLowerCase().includes(q) ||
      stu.phone.toLowerCase().includes(q);
    return matchesSearch && (getNetFee(stu) > 0 || getStudentDue(stu) > 0);
  });

  const handleOpenCreate = (targetStuId?: string) => {
    const target =
      (targetStuId && state.students.find((s) => s.id === targetStuId)) ||
      state.students.find((s) => getStudentDue(s) > 0) ||
      state.students[0];
    setStudentId(target?.id || '');
    setAmount(target ? Math.max(500, getStudentDue(target)) : 1500);
    setMethod('বিকাশ');
    setBillingMonth(selectedMonth);
    setReference('');
    setNote('মাসিক বেতন / কোর্স ফি জমা');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    onClearPreselectedStudent?.();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || amount <= 0) {
      setFormError('সঠিক শিক্ষার্থী এবং জমার পরিমাণ উল্লেখ করুন।');
      return;
    }

    const newPayment: FeePayment = {
      id: generateId('pay'),
      receiptNo: generateReceiptNo(state.payments),
      studentId,
      amount: Number(amount),
      method,
      reference: reference.trim() || 'DIRECT',
      date: new Date().toISOString().slice(0, 10),
      note: note.trim() || 'মাসিক বেতন জমা',
      billingMonth,
    };

    onAddPayment(newPayment);
    handleCloseModal();
    setPrintingPayment(newPayment);
  };

  const handleExportCsv = () => {
    const headers = [
      'রসিদ নং',
      'তারিখ',
      'বিলিং মাস',
      'শিক্ষার্থী আইডি',
      'নাম',
      'মাধ্যম',
      'রেফারেন্স',
      'পরিমাণ',
    ];
    const rows = filteredPayments.map((p) => {
      const stu = state.students.find((s) => s.id === p.studentId);
      return [
        p.receiptNo,
        p.date,
        p.billingMonth || p.date.slice(0, 7),
        stu?.studentCode || '',
        stu?.name || '',
        p.method,
        p.reference,
        p.amount,
      ];
    });
    exportCsv(`payments-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">সর্বমোট আদায়</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1.5">
            {formatBDT(totalCollected)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">
            নির্বাচিত মাসের আদায় ({selectedMonth})
          </p>
          <p className="text-2xl font-bold text-blue-700 font-mono-tabular mt-1.5">
            {formatBDT(monthCollected)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">মোট বকেয়া ({dueStudents.length} জন)</p>
          <p className="text-2xl font-bold text-amber-700 font-mono-tabular mt-1.5">
            {formatBDT(totalDue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">ইস্যুকৃত রসিদ</p>
          <p className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1.5">
            {state.payments.length}টি
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setSubTab('ledger')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'ledger'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              মাসিক বেতন ও বকেয়া খাতা
            </button>
            <button
              type="button"
              onClick={() => setSubTab('history')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              পেমেন্ট রসিদ ({state.payments.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম, আইডি বা রসিদ..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
            />
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="মাস নির্বাচন"
            className="px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg bg-white text-slate-700"
          />
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 text-slate-700 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            CSV রিপোর্ট
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreate()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            ফি জমা নিন
          </button>
        </div>
      </div>

      {subTab === 'ledger' ? (
        /* Monthly Tuition & Due Ledger */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredLedgerStudents.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">
                কোনো পেড বা বকেয়া থাকা শিক্ষার্থী নেই
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                সকল ফ্রি সরকারি কোর্সের শিক্ষার্থীর ফি ৳০। বেসিক কম্পিউটার বা যেকোনো পেড কোর্সে
                শিক্ষার্থী ভর্তি হলে তাদের মাসিক বেতন ও বকেয়ার হিসাব এখানে স্বয়ংক্রিয়ভাবে দেখাবে।
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 whitespace-nowrap">আইডি ও নাম</th>
                    <th className="py-3 px-4 whitespace-nowrap">কোর্স ও ব্যাচ</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">নিট ফি</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">পরিশোধিত</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">বকেয়া</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLedgerStudents.map((stu) => {
                    const course = state.courses.find((c) => c.id === stu.courseId);
                    const batch = state.batches.find((b) => b.id === stu.batchId);
                    const netFee = getNetFee(stu);
                    const due = getStudentDue(stu);
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{stu.name}</p>
                          <p className="text-xs font-mono-tabular text-slate-500">
                            {stu.studentCode} · {stu.guardianPhone || stu.phone}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          <p className="font-medium">{course?.title}</p>
                          <p className="font-mono-tabular text-slate-500">{batch?.code}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-slate-700 whitespace-nowrap">
                          {formatBDT(netFee)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-emerald-700 font-medium whitespace-nowrap">
                          {formatBDT(stu.paidAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap">
                          {due === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              পরিশোধিত
                            </span>
                          ) : (
                            <span className="text-amber-700">{formatBDT(due)}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {due > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCreate(stu.id)}
                                  className="px-2.5 py-1 text-xs font-medium bg-blue-700 text-white rounded-md hover:bg-blue-800"
                                >
                                  জমা নিন
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSendDueSms(
                                      stu.id,
                                      `ড্রিম-৭১ আইটি নাঙ্গলকোট: ${stu.name} (${stu.studentCode}) এর ${selectedMonth} মাসের বকেয়া ফি ${formatBDT(due)}। অনুগ্রহ করে দ্রুত পরিশোধ করুন।`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-amber-200 bg-amber-50 text-amber-800 rounded-md hover:bg-amber-100"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  SMS রিমাইন্ডার
                                </button>
                              </>
                            )}
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
      ) : (
        /* Payments Table */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredPayments.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-900">এখনো কোনো ফি লেনদেন নেই</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                পেইড কোর্স বা মাসিক ফি এন্ট্রি করলে সাথে সাথে ডিজিটাল রসিদসহ এখানে তালিকাভুক্ত হবে।
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 whitespace-nowrap">রসিদ নং</th>
                    <th className="py-3 px-4 whitespace-nowrap">তারিখ ও মাস</th>
                    <th className="py-3 px-4 whitespace-nowrap">শিক্ষার্থী</th>
                    <th className="py-3 px-4 whitespace-nowrap">পেমেন্ট মাধ্যম ও রেফারেন্স</th>
                    <th className="py-3 px-4 whitespace-nowrap">বিবরণ</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">পরিমাণ</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">রসিদ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredPayments.map((pay) => {
                    const stu = state.students.find((s) => s.id === pay.studentId);
                    return (
                      <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-blue-700 whitespace-nowrap">
                          {pay.receiptNo}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                          <span>{pay.date}</span>
                          {pay.billingMonth && (
                            <span className="block text-[11px] text-slate-400">
                              মাস: {pay.billingMonth}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-slate-900">
                            {stu?.name || 'অজানা শিক্ষার্থী'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono-tabular">
                            {stu?.studentCode}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                          {pay.method} · <span className="font-mono-tabular">{pay.reference}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{pay.note}</td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-emerald-700 whitespace-nowrap">
                          {formatBDT(pay.amount)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setPrintingPayment(pay)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            প্রিন্ট
                          </button>
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

      {/* Collect Payment Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">নতুন ফি পেমেন্ট এন্ট্রি</h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
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

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  শিক্ষার্থী নির্বাচন করুন *
                </label>
                <select
                  value={studentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setStudentId(id);
                    const stu = state.students.find((s) => s.id === id);
                    if (stu) setAmount(Math.max(0, getStudentDue(stu)));
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  required
                >
                  {state.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentCode} — {s.name} (বকেয়া: {formatBDT(getStudentDue(s))})
                    </option>
                  ))}
                </select>
                {selectedStudent && (
                  <p className="text-xs text-slate-500 mt-1.5 font-mono-tabular">
                    বর্তমান বকেয়া:{' '}
                    <span className="text-amber-700 font-semibold">{formatBDT(selectedDue)}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    জমার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    পেমেন্ট মাস
                  </label>
                  <input
                    type="month"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    পেমেন্ট মাধ্যম
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="বিকাশ">বিকাশ</option>
                    <option value="নগদ">নগদ</option>
                    <option value="ব্যাংক ট্রান্সফার">ব্যাংক ট্রান্সফার</option>
                    <option value="নগদ ক্যাশ">নগদ ক্যাশ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ট্রানজেকশন রেফারেন্স
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="BK9X2104"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">মন্তব্য</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  রসিদ তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReceiptPrintModal
        payment={printingPayment}
        student={state.students.find((s) => s.id === printingPayment?.studentId)}
        course={state.courses.find(
          (c) =>
            c.id ===
            state.students.find((s) => s.id === printingPayment?.studentId)?.courseId
        )}
        onClose={() => setPrintingPayment(null)}
      />
    </div>
  );
}
