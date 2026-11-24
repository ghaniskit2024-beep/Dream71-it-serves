import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Batch, BatchStatus, Course, CourseCategory, InstituteState } from '../../types/institute';
import { INSTITUTE_IMAGES } from '../../data/seedData';
import { formatBDT, generateId } from '../../utils/storage';

interface CoursesBatchesViewProps {
  mode: 'courses' | 'batches';
  state: InstituteState;
  onAddCourse: (course: Course) => void;
  onUpdateCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onAddBatch: (batch: Batch) => void;
  onUpdateBatch: (batch: Batch) => void;
  onDeleteBatch: (batchId: string) => void;
}

const CATEGORY_MAP: Record<CourseCategory, { label: string; image: string }> = {
  tech: { label: 'কম্পিউটার ও ওয়েব', image: INSTITUTE_IMAGES.webCourse },
  creative: { label: 'ডিজাইন ও মার্কেটিং', image: INSTITUTE_IMAGES.uiuxCourse },
  career: { label: 'ভাষা, হিসাব ও উদ্যোক্তা', image: INSTITUTE_IMAGES.mentorship },
  paid: { label: 'পেড কোর্স', image: INSTITUTE_IMAGES.dataCourse },
};

export function CoursesBatchesView({
  mode,
  state,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onAddBatch,
  onUpdateBatch,
  onDeleteBatch,
}: CoursesBatchesViewProps) {
  // Course modal state
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [cCode, setCCode] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [cCategory, setCCategory] = useState<CourseCategory>('tech');
  const [cWeeks, setCWeeks] = useState(12);
  const [cClasses, setCClasses] = useState(36);
  const [cFee, setCFee] = useState(0);
  const [cSummary, setCSummary] = useState('');
  const [cSyllabusText, setCSyllabusText] = useState('');
  const [cActive, setCActive] = useState(true);

  // Batch modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [bCode, setBCode] = useState('');
  const [bCourseId, setBCourseId] = useState(state.courses[0]?.id || '');
  const [bInstructorId, setBInstructorId] = useState(state.instructors[0]?.id || '');
  const [bSchedule, setBSchedule] = useState('');
  const [bRoom, setBRoom] = useState('');
  const [bStartDate, setBStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [bCapacity, setBCapacity] = useState(22);
  const [bStatus, setBStatus] = useState<BatchStatus>('ভর্তি চলছে');

  const openCourseForm = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setCCode(course.code);
      setCTitle(course.title);
      setCCategory(course.category);
      setCWeeks(course.durationWeeks);
      setCClasses(course.totalClasses);
      setCFee(course.fee);
      setCSummary(course.summary);
      setCSyllabusText(course.syllabus.join('\n'));
      setCActive(course.active);
    } else {
      setEditingCourse(null);
      setCCode('');
      setCTitle('');
      setCCategory('tech');
      setCWeeks(12);
      setCClasses(36);
      setCFee(0);
      setCSummary('');
      setCSyllabusText('');
      setCActive(true);
    }
    setCourseModalOpen(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cCode.trim() || !cTitle.trim()) return;
    const catInfo = CATEGORY_MAP[cCategory];
    const syllabus = cSyllabusText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Course = {
      id: editingCourse ? editingCourse.id : generateId('crs'),
      code: cCode.trim().toUpperCase(),
      title: cTitle.trim(),
      category: cCategory,
      categoryLabel: catInfo.label,
      durationWeeks: Math.max(1, Number(cWeeks) || 12),
      totalClasses: Math.max(1, Number(cClasses) || 36),
      fee: Math.max(0, Number(cFee) || 0),
      summary: cSummary.trim() || 'ইন্ডাস্ট্রি-স্ট্যান্ডার্ড প্রজেক্ট ভিত্তিক প্রশিক্ষণ কোর্স।',
      syllabus: syllabus.length > 0 ? syllabus : ['ফান্ডামেন্টালস ও প্রজেক্ট ওয়ার্কশপ'],
      imageUrl: editingCourse?.imageUrl || catInfo.image,
      active: cActive,
    };

    if (editingCourse) {
      onUpdateCourse(payload);
    } else {
      onAddCourse(payload);
    }
    setCourseModalOpen(false);
  };

  const openBatchForm = (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      setBCode(batch.code);
      setBCourseId(batch.courseId);
      setBInstructorId(batch.instructorId);
      setBSchedule(batch.schedule);
      setBRoom(batch.room);
      setBStartDate(batch.startDate);
      setBCapacity(batch.capacity);
      setBStatus(batch.status);
    } else {
      setEditingBatch(null);
      setBCode('');
      setBCourseId(state.courses[0]?.id || '');
      setBInstructorId(state.instructors[0]?.id || '');
      setBSchedule('শনি, সোম ও বুধ · সন্ধ্যা ৭:০০');
      setBRoom('ল্যাব ০১');
      setBStartDate(new Date().toISOString().slice(0, 10));
      setBCapacity(24);
      setBStatus('ভর্তি চলছে');
    }
    setBatchModalOpen(true);
  };

  const handleSaveBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bCode.trim() || !bCourseId || !bInstructorId) return;

    const payload: Batch = {
      id: editingBatch ? editingBatch.id : generateId('bat'),
      code: bCode.trim().toUpperCase(),
      courseId: bCourseId,
      instructorId: bInstructorId,
      schedule: bSchedule.trim(),
      room: bRoom.trim(),
      startDate: bStartDate,
      capacity: Math.max(1, Number(bCapacity) || 20),
      status: bStatus,
    };

    if (editingBatch) {
      onUpdateBatch(payload);
    } else {
      onAddBatch(payload);
    }
    setBatchModalOpen(false);
  };

  if (mode === 'courses') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">কোর্স ও কারিকুলাম তালিকা</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              এখানে যোগ করা সক্রিয় কোর্সসমূহ সরাসরি পাবলিক ওয়েবসাইটে প্রদর্শিত হয়
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCourseForm()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন কোর্স যোগ করুন
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {state.courses.map((course) => {
            const studentCount = state.students.filter((s) => s.courseId === course.id).length;
            return (
              <div
                key={course.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-mono-tabular font-semibold text-blue-700">
                      {course.code}
                    </span>
                    <span>
                      {course.categoryLabel} · {course.active ? 'সক্রিয়' : 'বন্ধ'}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{course.summary}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="space-y-0.5 font-mono-tabular">
                    <p className="font-semibold text-emerald-700 text-sm">
                      {course.fee === 0 ? 'সম্পূর্ণ ফ্রি কোর্স' : formatBDT(course.fee)}
                    </p>
                    <p className="text-slate-500">
                      {course.durationWeeks} সপ্তাহ · {course.totalClasses} ক্লাস · {studentCount} জন
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openCourseForm(course)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                      title="সম্পাদনা"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCourse(course.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {courseModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">
                  {editingCourse ? 'কোর্স সম্পাদনা' : 'নতুন কোর্স তৈরি'}
                </h3>
                <button
                  type="button"
                  onClick={() => setCourseModalOpen(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveCourse} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      কোর্স কোড *
                    </label>
                    <input
                      type="text"
                      value={cCode}
                      onChange={(e) => setCCode(e.target.value)}
                      placeholder="WEB-202"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ক্যাটাগরি
                    </label>
                    <select
                      value={cCategory}
                      onChange={(e) => setCCategory(e.target.value as CourseCategory)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="tech">কম্পিউটার ও ওয়েব</option>
                      <option value="creative">ডিজাইন ও মার্কেটিং</option>
                      <option value="career">ভাষা, হিসাব ও উদ্যোক্তা</option>
                      <option value="paid">পেড কোর্স</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    কোর্সের শিরোনাম *
                  </label>
                  <input
                    type="text"
                    value={cTitle}
                    onChange={(e) => setCTitle(e.target.value)}
                    placeholder="যেমন: অ্যাডভান্সড লারাভেল ও Vue.js ডেভেলপমেন্ট"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">সপ্তাহ</label>
                    <input
                      type="number"
                      min={1}
                      value={cWeeks}
                      onChange={(e) => setCWeeks(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">মোট ক্লাস</label>
                    <input
                      type="number"
                      min={1}
                      value={cClasses}
                      onChange={(e) => setCClasses(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      কোর্স ফি (৳)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={cFee}
                      onChange={(e) => setCFee(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">সংক্ষিপ্ত বিবরণ</label>
                  <textarea
                    rows={2}
                    value={cSummary}
                    onChange={(e) => setCSummary(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    সিলেবাস মডিউল (প্রতি লাইনে একটি)
                  </label>
                  <textarea
                    rows={3}
                    value={cSyllabusText}
                    onChange={(e) => setCSyllabusText(e.target.value)}
                    placeholder="মডিউল ১&#10;মডিউল ২"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={cActive}
                    onChange={(e) => setCActive(e.target.checked)}
                    className="rounded border-slate-300 text-blue-700"
                  />
                  পাবলিক ওয়েবসাইটে ভর্তি চালু রাখুন
                </label>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCourseModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                  >
                    সংরক্ষণ করুন
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Batches Mode
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">ব্যাচ ও ক্লাস রুটিন</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ব্যাচ কোড, ল্যাব রুম, মেন্টর এবং আসন ধারণক্ষমতা ব্যবস্থাপনা
          </p>
        </div>
        <button
          type="button"
          onClick={() => openBatchForm()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          নতুন ব্যাচ তৈরি
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">ব্যাচ কোড</th>
                <th className="py-3 px-4 whitespace-nowrap">কোর্স</th>
                <th className="py-3 px-4 whitespace-nowrap">মেন্টর</th>
                <th className="py-3 px-4 whitespace-nowrap">সময়সূচি ও ল্যাব</th>
                <th className="py-3 px-4 whitespace-nowrap">শুরুর তারিখ</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">আসন</th>
                <th className="py-3 px-4 whitespace-nowrap">অবস্থা</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {state.batches.map((batch) => {
                const course = state.courses.find((c) => c.id === batch.courseId);
                const instructor = state.instructors.find((i) => i.id === batch.instructorId);
                const enrolled = state.students.filter((s) => s.batchId === batch.id).length;

                return (
                  <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-blue-700 whitespace-nowrap">
                      {batch.code}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-900 max-w-[220px] truncate">
                      {course?.title || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {instructor?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="text-slate-900">{batch.schedule}</p>
                      <p className="text-slate-500 mt-0.5">{batch.room}</p>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-tabular text-slate-600 whitespace-nowrap">
                      {batch.startDate}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-mono-tabular text-slate-900 whitespace-nowrap">
                      {enrolled} / {batch.capacity}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium whitespace-nowrap">
                      <span
                        className={
                          batch.status === 'চলমান'
                            ? 'text-emerald-700'
                            : batch.status === 'ভর্তি চলছে'
                            ? 'text-blue-700'
                            : 'text-slate-500'
                        }
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openBatchForm(batch)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                          title="সম্পাদনা"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBatch(batch.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                          title="মুছে ফেলুন"
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
      </div>

      {batchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editingBatch ? 'ব্যাচ তথ্য সম্পাদনা' : 'নতুন ব্যাচ তৈরি'}
              </h3>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBatch} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ব্যাচ কোড *</label>
                  <input
                    type="text"
                    value={bCode}
                    onChange={(e) => setBCode(e.target.value)}
                    placeholder="WEB-2608"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">অবস্থা</label>
                  <select
                    value={bStatus}
                    onChange={(e) => setBStatus(e.target.value as BatchStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="ভর্তি চলছে">ভর্তি চলছে</option>
                    <option value="চলমান">চলমান</option>
                    <option value="সম্পন্ন">সম্পন্ন</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">কোর্স *</label>
                <select
                  value={bCourseId}
                  onChange={(e) => setBCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  required
                >
                  {state.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">মেন্টর *</label>
                <select
                  value={bInstructorId}
                  onChange={(e) => setBInstructorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  required
                >
                  {state.instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {i.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ক্লাসের সময়</label>
                  <input
                    type="text"
                    value={bSchedule}
                    onChange={(e) => setBSchedule(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ল্যাব রুম</label>
                  <input
                    type="text"
                    value={bRoom}
                    onChange={(e) => setBRoom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">শুরুর তারিখ</label>
                  <input
                    type="date"
                    value={bStartDate}
                    onChange={(e) => setBStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    সর্বোচ্চ আসন
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={bCapacity}
                    onChange={(e) => setBCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
