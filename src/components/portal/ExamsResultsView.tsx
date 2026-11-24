import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  MessageSquare,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import { ExamRecord, InstituteState, Student } from '../../types/institute';
import { exportCsv, generateId, getExamGrade, getStudentDue } from '../../utils/storage';

interface ExamsResultsViewProps {
  state: InstituteState;
  onSaveExam: (exam: ExamRecord) => void;
  onDeleteExam: (examId: string) => void;
  onSendResultSms: (studentId: string, message: string) => void;
}

export function ExamsResultsView({
  state,
  onSaveExam,
  onDeleteExam,
  onSendResultSms,
}: ExamsResultsViewProps) {
  const [subTab, setSubTab] = useState<'exams' | 'reports'>('exams');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>(state.exams[0]?.id || '');
  const [scoreDraft, setScoreDraft] = useState<Record<string, number>>({});
  const [savedNotice, setSavedNotice] = useState(false);

  // Create exam modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBatchId, setNewBatchId] = useState(state.batches[0]?.id || '');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newTotalMarks, setNewTotalMarks] = useState(100);
  const [newPassMarks, setNewPassMarks] = useState(40);
  const [formError, setFormError] = useState('');

  // Report print modal
  const [reportStudent, setReportStudent] = useState<Student | null>(null);

  const activeExam = state.exams.find((e) => e.id === selectedExamId) || state.exams[0] || null;

  useEffect(() => {
    if (!activeExam && state.exams.length > 0) {
      setSelectedExamId(state.exams[0].id);
    }
  }, [activeExam, state.exams]);

  useEffect(() => {
    if (activeExam) {
      setScoreDraft(activeExam.scores || {});
      setSavedNotice(false);
    }
  }, [activeExam]);

  const examStudents = useMemo(() => {
    if (!activeExam) return [];
    return state.students.filter((s) => s.batchId === activeExam.batchId);
  }, [activeExam, state.students]);

  const handleScoreChange = (studentId: string, rawVal: string) => {
    if (!activeExam) return;
    const num = Math.max(0, Math.min(activeExam.totalMarks, Number(rawVal) || 0));
    setScoreDraft((prev) => ({ ...prev, [studentId]: num }));
    setSavedNotice(false);
  };

  const handleSaveScores = () => {
    if (!activeExam) return;
    onSaveExam({
      ...activeExam,
      scores: scoreDraft,
    });
    setSavedNotice(true);
  };

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBatchId || !newDate) {
      setFormError('পরীক্ষার নাম, ব্যাচ এবং তারিখ দেওয়া আবশ্যক।');
      return;
    }
    const batch = state.batches.find((b) => b.id === newBatchId);
    if (!batch) {
      setFormError('সঠিক ব্যাচ নির্বাচন করুন।');
      return;
    }
    const created: ExamRecord = {
      id: generateId('exm'),
      title: newTitle.trim(),
      batchId: batch.id,
      courseId: batch.courseId,
      examDate: newDate,
      totalMarks: Math.max(1, Math.min(1000, Number(newTotalMarks) || 100)),
      passMarks: Math.max(0, Math.min(Number(newTotalMarks) || 100, Number(newPassMarks) || 40)),
      scores: {},
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onSaveExam(created);
    setSelectedExamId(created.id);
    setNewTitle('');
    setFormError('');
    setIsCreateOpen(false);
  };

  const examStats = useMemo(() => {
    if (!activeExam) return { avg: 0, passed: 0, total: 0, highest: 0 };
    const values = examStudents
      .map((s) => scoreDraft[s.id])
      .filter((v): v is number => typeof v === 'number');
    if (values.length === 0) return { avg: 0, passed: 0, total: examStudents.length, highest: 0 };
    const sum = values.reduce((a, b) => a + b, 0);
    const passed = values.filter((v) => v >= activeExam.passMarks).length;
    return {
      avg: Math.round((sum / values.length) * 10) / 10,
      passed,
      total: values.length,
      highest: Math.max(...values),
    };
  }, [activeExam, examStudents, scoreDraft]);

  const handleExportExamCsv = () => {
    if (!activeExam) return;
    const headers = ['আইডি', 'নাম', 'প্রাপ্ত নম্বর', 'মোট নম্বর', 'শতাংশ (%)', 'গ্রেড', 'ফলাফল'];
    const rows = examStudents.map((s) => {
      const score = scoreDraft[s.id] ?? 0;
      const pct = Math.round((score / Math.max(1, activeExam.totalMarks)) * 100);
      const grade = getExamGrade(score, activeExam.totalMarks);
      const result = score >= activeExam.passMarks ? 'উত্তীর্ণ' : 'অকৃতকার্য';
      return [s.studentCode, s.name, score, activeExam.totalMarks, `${pct}%`, grade, result];
    });
    exportCsv(`exam-result-${activeExam.examDate}.csv`, headers, rows);
  };

  // Performance Report aggregation across all students
  const filteredReportStudents = useMemo(() => {
    if (selectedBatchFilter === 'all') return state.students;
    return state.students.filter((s) => s.batchId === selectedBatchFilter);
  }, [state.students, selectedBatchFilter]);

  const getStudentPerformance = (student: Student) => {
    // Attendance %
    const batchAttendance = state.attendance.filter((a) => a.batchId === student.batchId);
    let attTotal = 0;
    let attPresent = 0;
    batchAttendance.forEach((a) => {
      if (a.entries[student.id]) {
        attTotal += 1;
        if (a.entries[student.id] !== 'অনুপস্থিত') attPresent += 1;
      }
    });
    const attendancePct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null;

    // Exam average %
    const studentExams = state.exams.filter(
      (ex) => ex.batchId === student.batchId && typeof ex.scores?.[student.id] === 'number'
    );
    let avgPct: number | null = null;
    if (studentExams.length > 0) {
      const totalPct = studentExams.reduce((acc, ex) => {
        const sc = ex.scores[student.id] ?? 0;
        return acc + (sc / Math.max(1, ex.totalMarks)) * 100;
      }, 0);
      avgPct = Math.round(totalPct / studentExams.length);
    }

    const grade = avgPct !== null ? getExamGrade(avgPct, 100) : '—';
    return {
      attTotal,
      attPresent,
      attendancePct,
      examsCount: studentExams.length,
      avgPct,
      grade,
      studentExams,
    };
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation & Summary Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSubTab('exams')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'exams'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            পরীক্ষা ও নম্বর এন্ট্রি
          </button>
          <button
            type="button"
            onClick={() => setSubTab('reports')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'reports'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            পারফরম্যান্স রিপোর্ট
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          নতুন পরীক্ষা যোগ করুন
        </button>
      </div>

      {subTab === 'exams' ? (
        <div className="space-y-5">
          {/* Exam Selector + Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  পরীক্ষা নির্বাচন করুন ({state.exams.length}টি)
                </label>
                {activeExam && (
                  <button
                    type="button"
                    onClick={() => onDeleteExam(activeExam.id)}
                    className="inline-flex items-center gap-1 text-xs text-rose-700 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    মুছুন
                  </button>
                )}
              </div>
              {state.exams.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  এখনো কোনো পরীক্ষা তৈরি করা হয়নি। উপরে &quot;নতুন পরীক্ষা যোগ করুন&quot; বাটনে ক্লিক করুন।
                </p>
              ) : (
                <select
                  value={activeExam?.id || ''}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-blue-700"
                >
                  {state.exams.map((ex) => {
                    const batch = state.batches.find((b) => b.id === ex.batchId);
                    return (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({batch?.code || 'ব্যাচ'} · {ex.examDate})
                      </option>
                    );
                  })}
                </select>
              )}
              {activeExam && (
                <p className="text-xs text-slate-500 font-mono-tabular">
                  তারিখ: {activeExam.examDate} · পূর্ণমান: {activeExam.totalMarks} · পাস নম্বর:{' '}
                  {activeExam.passMarks}
                </p>
              )}
            </div>

            <div className="lg:col-span-7 grid grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500">গড় নম্বর</p>
                <p className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1">
                  {examStats.avg}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  সর্বোচ্চ: <span className="font-mono-tabular font-semibold">{examStats.highest}</span>
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500">উত্তীর্ণ শিক্ষার্থী</p>
                <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
                  {examStats.passed}/{examStats.total}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">পাস হার ভিত্তিক হিসাব</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                <p className="text-xs font-medium text-slate-500">দ্রুত অ্যাকশন</p>
                <div className="flex flex-col gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={handleSaveScores}
                    disabled={!activeExam}
                    className="w-full py-1.5 px-3 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
                  >
                    নম্বর সংরক্ষণ করুন
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExamCsv}
                    disabled={!activeExam}
                    className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV রেজাল্ট
                  </button>
                </div>
              </div>
            </div>
          </div>

          {savedNotice && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              পরীক্ষার নম্বর ও গ্রেড সফলভাবে Firestore ডাটাবেসে সংরক্ষিত হয়েছে।
            </div>
          )}

          {/* Exam Marks Table */}
          {activeExam && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {examStudents.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  এই পরীক্ষার নির্ধারিত ব্যাচে এখনো কোনো শিক্ষার্থী ভর্তি নেই।
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4 whitespace-nowrap">আইডি</th>
                        <th className="py-3 px-4 whitespace-nowrap">শিক্ষার্থীর নাম</th>
                        <th className="py-3 px-4 whitespace-nowrap">
                          প্রাপ্ত নম্বর (/{activeExam.totalMarks})
                        </th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">শতাংশ</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">গ্রেড</th>
                        <th className="py-3 px-4 whitespace-nowrap">অবস্থা</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">অভিভাবক SMS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {examStudents.map((stu) => {
                        const score = scoreDraft[stu.id] ?? 0;
                        const pct = Math.round((score / Math.max(1, activeExam.totalMarks)) * 100);
                        const grade = getExamGrade(score, activeExam.totalMarks);
                        const passed = score >= activeExam.passMarks;

                        return (
                          <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-slate-700 whitespace-nowrap">
                              {stu.studentCode}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                              {stu.name}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <input
                                type="number"
                                min={0}
                                max={activeExam.totalMarks}
                                value={scoreDraft[stu.id] ?? ''}
                                onChange={(e) => handleScoreChange(stu.id, e.target.value)}
                                placeholder="0"
                                className="w-24 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
                              />
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular text-slate-700 whitespace-nowrap">
                              {pct}%
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                              {grade}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`text-xs font-medium ${
                                  passed ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {passed ? 'উত্তীর্ণ' : 'অকৃতকার্য'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  onSendResultSms(
                                    stu.id,
                                    `ড্রিম-৭১ আইটি নাঙ্গলকোট: ${stu.name} (${stu.studentCode}) "${activeExam.title}" পরীক্ষায় ${activeExam.totalMarks} এর মধ্যে ${score} (${grade}) পেয়েছে।`
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 whitespace-nowrap"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                রেজাল্ট SMS
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
        </div>
      ) : (
        /* Performance Reports Tab */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                শিক্ষার্থীভিত্তিক সমন্বিত পারফরম্যান্স রিপোর্ট
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ডিজিটাল উপস্থিতি, পরীক্ষার গড় নম্বর, গ্রেড ও ফি অবস্থার একত্রিত বিবরণী
              </p>
            </div>
            <select
              value={selectedBatchFilter}
              onChange={(e) => setSelectedBatchFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="all">সকল ব্যাচ</option>
              {state.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {filteredReportStudents.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                কোনো শিক্ষার্থী পাওয়া যায়নি।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 whitespace-nowrap">আইডি ও নাম</th>
                      <th className="py-3 px-4 whitespace-nowrap">ব্যাচ</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">উপস্থিতি</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">পরীক্ষা (গড়)</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">গ্রেড</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">ফি বকেয়া</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">রিপোর্ট কার্ড</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredReportStudents.map((stu) => {
                      const perf = getStudentPerformance(stu);
                      const batch = state.batches.find((b) => b.id === stu.batchId);
                      const due = getStudentDue(stu);

                      return (
                        <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900">{stu.name}</p>
                            <p className="text-xs font-mono-tabular text-slate-500">
                              {stu.studentCode}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-xs text-slate-700 whitespace-nowrap">
                            {batch?.code || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-xs font-medium text-slate-700 whitespace-nowrap">
                            {perf.attendancePct === null ? 'তথ্য নেই' : `${perf.attendancePct}%`}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-xs font-medium text-slate-700 whitespace-nowrap">
                            {perf.avgPct === null
                              ? 'পরীক্ষা নেই'
                              : `${perf.avgPct}% (${perf.examsCount}টি)`}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                            {perf.grade}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-xs font-semibold text-amber-700 whitespace-nowrap">
                            {due === 0 ? 'পরিশোধিত' : `৳${due.toLocaleString('en-IN')}`}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setReportStudent(stu)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              রিপোর্ট কার্ড
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
        </div>
      )}

      {/* Create Exam Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">নতুন পরীক্ষা / মূল্যায়ন যোগ করুন</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateExam} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  পরীক্ষার শিরোনাম *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="যেমন: মাসিক মূল্যায়ন পরীক্ষা - ০২"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ব্যাচ *</label>
                <select
                  value={newBatchId}
                  onChange={(e) => setNewBatchId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  required
                >
                  {state.batches.map((b) => {
                    const c = state.courses.find((course) => course.id === b.courseId);
                    return (
                      <option key={b.id} value={b.id}>
                        {b.code} — {c?.title}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">তারিখ *</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">পূর্ণমান</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={newTotalMarks}
                    onChange={(e) => setNewTotalMarks(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">পাস নম্বর</label>
                  <input
                    type="number"
                    min={0}
                    max={newTotalMarks}
                    value={newPassMarks}
                    onChange={(e) => setNewPassMarks(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Progress Report Modal */}
      {reportStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 no-print">
              <h3 className="text-base font-semibold text-slate-900">শিক্ষার্থী প্রোগ্রেস রিপোর্ট</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  প্রিন্ট
                </button>
                <button
                  type="button"
                  onClick={() => setReportStudent(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(() => {
              const perf = getStudentPerformance(reportStudent);
              const course = state.courses.find((c) => c.id === reportStudent.courseId);
              const batch = state.batches.find((b) => b.id === reportStudent.batchId);
              return (
                <div className="p-6 print-area space-y-5">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src="/assets/aistudio/dream71_it_logo__2__e39bbd51.png"
                        alt="Dream 71 লোগো"
                        className="w-11 h-11 object-contain"
                      />
                      <div>
                        <p className="text-base font-bold text-slate-900">
                          ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট
                        </p>
                        <p className="text-xs text-slate-500">ডিজিটাল পারফরম্যান্স ও প্রোগ্রেস রিপোর্ট</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono-tabular font-semibold text-blue-700">
                      {reportStudent.studentCode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">শিক্ষার্থীর নাম:</span>
                      <p className="font-semibold text-slate-900 text-sm">{reportStudent.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">কোর্স ও ব্যাচ:</span>
                      <p className="font-medium text-slate-900">
                        {course?.title} ({batch?.code})
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">উপস্থিতির হার:</span>
                      <p className="font-mono-tabular font-bold text-slate-900">
                        {perf.attendancePct === null
                          ? 'তথ্য নেই'
                          : `${perf.attendancePct}% (${perf.attPresent}/${perf.attTotal} দিন)`}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">সামগ্রিক গ্রেড:</span>
                      <p className="font-mono-tabular font-bold text-emerald-700">
                        {perf.grade} {perf.avgPct !== null ? `(${perf.avgPct}%)` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-2 px-3">পরীক্ষার নাম</th>
                          <th className="py-2 px-3">তারিখ</th>
                          <th className="py-2 px-3 text-right">নম্বর</th>
                          <th className="py-2 px-3 text-right">গ্রেড</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {perf.studentExams.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 px-3 text-center text-slate-500">
                              এখনো কোনো পরীক্ষার নম্বর যুক্ত হয়নি।
                            </td>
                          </tr>
                        ) : (
                          perf.studentExams.map((ex) => {
                            const sc = ex.scores[reportStudent.id] ?? 0;
                            return (
                              <tr key={ex.id}>
                                <td className="py-2 px-3 font-medium text-slate-900">{ex.title}</td>
                                <td className="py-2 px-3 font-mono-tabular text-slate-500">
                                  {ex.examDate}
                                </td>
                                <td className="py-2 px-3 text-right font-mono-tabular">
                                  {sc}/{ex.totalMarks}
                                </td>
                                <td className="py-2 px-3 text-right font-mono-tabular font-bold">
                                  {getExamGrade(sc, ex.totalMarks)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
