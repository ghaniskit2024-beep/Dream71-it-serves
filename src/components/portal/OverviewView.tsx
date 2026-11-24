import { ArrowUpRight, CheckCircle2, Clock, Users } from 'lucide-react';
import { InstituteState, PortalTab } from '../../types/institute';
import { formatBDT } from '../../utils/storage';

interface OverviewViewProps {
  state: InstituteState;
  onNavigate: (tab: PortalTab) => void;
  onQuickEnroll: () => void;
}

export function OverviewView({ state, onNavigate, onQuickEnroll }: OverviewViewProps) {
  const activeStudents = state.students.filter((s) => s.status === 'সক্রিয়');
  const activeBatches = state.batches.filter((b) => b.status !== 'সম্পন্ন');
  const freeCoursesCount = state.courses.filter((c) => c.active && c.fee === 0).length;
  const pendingInquiries = state.inquiries.filter((i) => i.status === 'অপেক্ষমাণ');

  const courseBreakdown = state.courses.map((course) => {
    const courseStudents = state.students.filter((s) => s.courseId === course.id);
    const courseBatches = state.batches.filter((b) => b.courseId === course.id);
    const totalSeats = courseBatches.reduce((sum, b) => sum + b.capacity, 0);
    return {
      id: course.id,
      code: course.code,
      title: course.title,
      studentCount: courseStudents.length,
      totalSeats: Math.max(totalSeats, courseStudents.length),
      fee: course.fee,
    };
  });

  const maxStudents = Math.max(1, ...courseBreakdown.map((c) => c.studentCount));

  return (
    <div className="space-y-6">
      {/* 4 KPI Summary Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">মোট সক্রিয় শিক্ষার্থী</p>
          <p className="text-2xl font-bold text-slate-900 font-mono-tabular mt-2">
            {activeStudents.length} জন
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            সর্বমোট নিবন্ধিত: <span className="font-mono-tabular">{state.students.length} জন</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">চলমান ও আসন্ন ব্যাচ</p>
          <p className="text-2xl font-bold text-slate-900 font-mono-tabular mt-2">
            {activeBatches.length}টি
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            চালু কোর্স: <span className="font-mono-tabular">{state.courses.filter((c) => c.active).length}টি</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">সম্পূর্ণ ফ্রি কোর্স</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-2">
            {freeCoursesCount}টি
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            ১০০% বিনামূল্যে প্রশিক্ষণ প্রোগ্রাম
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">অপেক্ষমাণ ভর্তি আবেদন</p>
          <p className="text-2xl font-bold text-amber-700 font-mono-tabular mt-2">
            {pendingInquiries.length}টি
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            মোট আবেদন: <span className="font-mono-tabular">{state.inquiries.length}টি</span>
          </p>
        </div>
      </div>

      {/* Main Split: Course Enrollment Breakdown + Batch Seat Occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                কোর্সভিত্তিক শিক্ষার্থী ও প্রশিক্ষণ অবস্থা
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোটের প্রতিটি ফ্রি কোর্সে ভর্তি শিক্ষার্থীর সংখ্যা
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('courses')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              সব কোর্স
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-5 space-y-3.5">
            {courseBreakdown.map((item) => {
              const pct = Math.round((item.studentCount / maxStudents) * 100);
              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono-tabular text-slate-500 shrink-0">{item.code}</span>
                      <span className="font-medium text-slate-900 truncate">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono-tabular">
                      <span className="text-emerald-700 font-medium">
                        {item.fee === 0 ? 'ফ্রি' : formatBDT(item.fee)}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-900 font-semibold">{item.studentCount} জন</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="bg-blue-700 h-full transition-all duration-200"
                      style={{ width: `${Math.max(item.studentCount > 0 ? 8 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Batch Occupancy */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">ব্যাচ আসন ও সময়সূচি</h2>
              <p className="text-xs text-slate-500 mt-0.5">সক্রিয় ও আসন্ন ব্যাচের আসন বিন্যাস</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('batches')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              সব ব্যাচ
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {activeBatches.map((batch) => {
              const enrolled = state.students.filter((s) => s.batchId === batch.id).length;
              const course = state.courses.find((c) => c.id === batch.courseId);
              const pct = Math.min(100, Math.round((enrolled / Math.max(1, batch.capacity)) * 100));

              return (
                <div key={batch.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        <span className="font-mono-tabular text-blue-700 mr-2">{batch.code}</span>
                        {course?.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{batch.schedule}</p>
                    </div>
                    <span className="text-xs font-mono-tabular font-medium text-slate-700 shrink-0">
                      {enrolled}/{batch.capacity} আসন
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                    <div className="h-full bg-slate-800" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Split: Pending Admissions + Recent Enrolled Students */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">সাম্প্রতিক ভর্তি আবেদন</h2>
            <button
              type="button"
              onClick={() => onNavigate('admissions')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              আবেদন কিউ দেখুন
            </button>
          </div>

          {state.inquiries.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              এখনো কোনো ভর্তি আবেদন জমা পড়েনি।
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-2">
              {state.inquiries.slice(0, 4).map((inq) => {
                const course = state.courses.find((c) => c.id === inq.courseId);
                return (
                  <div key={inq.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{inq.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {course?.title ?? 'কোর্স নির্ধারিত নয়'} ·{' '}
                        <span className="font-mono-tabular">{inq.phone}</span>
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium shrink-0 ${
                        inq.status === 'ভর্তি সম্পন্ন'
                          ? 'text-emerald-700'
                          : inq.status === 'অপেক্ষমাণ'
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {inq.status === 'ভর্তি সম্পন্ন' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      {inq.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">সাম্প্রতিক নিবন্ধিত শিক্ষার্থী</h2>
            <button
              type="button"
              onClick={onQuickEnroll}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              নতুন শিক্ষার্থী ভর্তি
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {state.students.slice(0, 4).map((stu) => {
              const course = state.courses.find((c) => c.id === stu.courseId);
              return (
                <div key={stu.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{stu.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      <span className="font-mono-tabular">{stu.studentCode}</span> · {course?.title}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-emerald-700 shrink-0">
                    {stu.totalFee === 0 ? 'ফ্রি কোর্স' : formatBDT(stu.paidAmount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
