import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  Filter,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import {
  InstituteState,
  PortalTab,
  SmsCategory,
  SmsChannel,
  SmsNotification,
  Student,
} from '../../types/institute';
import {
  exportCsv,
  formatBDT,
  generateId,
  getNetFee,
  getStudentDue,
} from '../../utils/storage';

interface AutomatedSmsViewProps {
  state: InstituteState;
  onSaveSmsLogs: (logs: SmsNotification[]) => Promise<void> | void;
  onDeleteSmsLog: (id: string) => Promise<void> | void;
  onNavigateTab: (tab: PortalTab) => void;
}

type AutomationRuleId =
  | 'class_schedule'
  | 'class_reschedule'
  | 'payment_due'
  | 'payment_upcoming';

type CooldownMode = 'today' | '7days' | 'none';
type PhonePreference = 'student_first' | 'guardian_first';

interface AutomationRulePreset {
  id: AutomationRuleId;
  group: 'class' | 'payment';
  title: string;
  description: string;
  category: SmsCategory;
  defaultTemplate: string;
}

const AUTOMATION_RULES: AutomationRulePreset[] = [
  {
    id: 'class_schedule',
    group: 'class',
    title: 'নিয়মিত ক্লাস রিমাইন্ডার',
    description: 'ব্যাচের সক্রিয় শিক্ষার্থীদের সময়সূচি ও ল্যাব রুমের রিমাইন্ডার পাঠান',
    category: 'সাধারণ নোটিশ',
    defaultTemplate:
      'ড্রিম-৭১ আইটি নাঙ্গলকোট: প্রিয় {name} ({code}), আপনার {course} ({batch}) ব্যাচের ক্লাস {schedule} ({room}) এ অনুষ্ঠিত হবে। যথাসময়ে উপস্থিত থাকার অনুরোধ রইল।',
  },
  {
    id: 'class_reschedule',
    group: 'class',
    title: 'ক্লাস সময় / রুম পরিবর্তন আপডেট',
    description: 'হঠাৎ ক্লাসের সময়, তারিখ বা ল্যাব পরিবর্তনের জরুরি আপডেট পাঠান',
    category: 'সাধারণ নোটিশ',
    defaultTemplate:
      'ড্রিম-৭১ আইটি নাঙ্গলকোট: জরুরি ক্লাস আপডেট — {name} ({code}), {batch} ব্যাচের আগামী ক্লাস {eventDate} তারিখে নতুন সময়/তথ্য: {updateNote}।',
  },
  {
    id: 'payment_due',
    group: 'payment',
    title: 'বকেয়া বেতন অটো-রিমাইন্ডার',
    description: 'বকেয়া থাকা সকল শিক্ষার্থীকে স্বয়ংক্রিয়ভাবে হিসাবসহ পেমেন্ট রিমাইন্ডার পাঠান',
    category: 'বেতন ও বকেয়া',
    defaultTemplate:
      'ড্রিম-৭১ আইটি নাঙ্গলকোট: প্রিয় {name} ({code}), আপনার {course} কোর্সের মোট {netFee} টাকার মধ্যে {paid} টাকা জমা হয়েছে এবং বকেয়া রয়েছে {due}। অনুগ্রহ করে {deadline} তারিখের মধ্যে পরিশোধ করুন।',
  },
  {
    id: 'payment_upcoming',
    group: 'payment',
    title: 'মাসিক বেতন / কিস্তি নোটিশ',
    description: 'পেড কোর্সের সকল সক্রিয় শিক্ষার্থীকে মাসিক বেতন পরিশোধের নোটিশ পাঠান',
    category: 'বেতন ও বকেয়া',
    defaultTemplate:
      'ড্রিম-৭১ আইটি নাঙ্গলকোট: প্রিয় {name} ({code}), {course} ({batch}) এর চলতি মাসের ফি/কিস্তি {deadline} তারিখের মধ্যে পরিশোধ করার অনুরোধ রইল। বর্তমান বকেয়া: {due}।',
  },
];

function parseSentDate(sentAt: string): Date | null {
  const datePart = (sentAt || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const parsed = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function AutomatedSmsView({
  state,
  onSaveSmsLogs,
  onDeleteSmsLog,
  onNavigateTab,
}: AutomatedSmsViewProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextWeekStr = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

  const [activeRuleId, setActiveRuleId] = useState<AutomationRuleId>('class_schedule');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [onlyActiveStudents, setOnlyActiveStudents] = useState<boolean>(true);
  const [minDueAmount, setMinDueAmount] = useState<number>(1);
  const [cooldownMode, setCooldownMode] = useState<CooldownMode>('today');
  const [phonePreference, setPhonePreference] = useState<PhonePreference>('student_first');

  // Dynamic context fields interpolated into automated messages
  const [eventDate, setEventDate] = useState<string>(todayStr);
  const [updateNote, setUpdateNote] = useState<string>('সকাল ১১:০০ টায় কম্পিউটার ল্যাব ০১-এ অনুষ্ঠিত হবে');
  const [paymentDeadline, setPaymentDeadline] = useState<string>(nextWeekStr);

  const [template, setTemplate] = useState<string>(AUTOMATION_RULES[0].defaultTemplate);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [searchQueue, setSearchQueue] = useState<string>('');

  const [dispatching, setDispatching] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const activeRule = useMemo(
    () => AUTOMATION_RULES.find((r) => r.id === activeRuleId) || AUTOMATION_RULES[0],
    [activeRuleId]
  );

  const handleSelectRule = (ruleId: AutomationRuleId) => {
    const nextRule = AUTOMATION_RULES.find((r) => r.id === ruleId);
    if (!nextRule) return;
    setActiveRuleId(ruleId);
    setTemplate(nextRule.defaultTemplate);
    setExcludedIds([]);
    setFeedback(null);
  };

  // Resolve target phone respecting preference & firestore.rules minimum length (>= 6, <= 30)
  const resolveRecipientPhone = (stu: Student): string => {
    const primary =
      phonePreference === 'student_first' ? stu.phone : stu.guardianPhone || stu.phone;
    const secondary =
      phonePreference === 'student_first' ? stu.guardianPhone : stu.phone;
    const chosen = (primary || secondary || '').trim();
    return chosen.slice(0, 30);
  };

  // Check if student recently received an SMS in the rule's category
  const getLastSentInCategory = (studentId: string, cat: SmsCategory): string | null => {
    const match = state.smsLogs.find((l) => l.studentId === studentId && l.category === cat);
    return match ? match.sentAt : null;
  };

  const isWithinCooldown = (lastSentAt: string | null): boolean => {
    if (!lastSentAt || cooldownMode === 'none') return false;
    if (cooldownMode === 'today') {
      return lastSentAt.slice(0, 10) === todayStr;
    }
    const lastDate = parseSentDate(lastSentAt);
    const todayDate = parseSentDate(todayStr);
    if (!lastDate || !todayDate) return false;
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);
    return diffDays >= 0 && diffDays < 7;
  };

  // Evaluate rule matches across students
  const evaluatedMatches = useMemo(() => {
    const q = searchQueue.trim().toLowerCase();

    return state.students
      .filter((stu) => {
        if (onlyActiveStudents && stu.status !== 'সক্রিয়') return false;
        if (selectedBatchId !== 'all' && stu.batchId !== selectedBatchId) return false;

        if (activeRuleId === 'payment_due') {
          if (getStudentDue(stu) < Math.max(1, Number(minDueAmount) || 1)) return false;
        } else if (activeRuleId === 'payment_upcoming') {
          if (getNetFee(stu) <= 0) return false;
        }

        if (q) {
          const matchesQuery =
            stu.name.toLowerCase().includes(q) ||
            stu.studentCode.toLowerCase().includes(q) ||
            stu.phone.toLowerCase().includes(q);
          if (!matchesQuery) return false;
        }

        return true;
      })
      .map((stu) => {
        const batch = state.batches.find((b) => b.id === stu.batchId);
        const course = state.courses.find((c) => c.id === stu.courseId);
        const netFee = getNetFee(stu);
        const due = getStudentDue(stu);
        const phone = resolveRecipientPhone(stu);
        const hasValidPhone = phone.length >= 6;
        const lastSentAt = getLastSentInCategory(stu.id, activeRule.category);
        const skippedByCooldown = isWithinCooldown(lastSentAt);

        const renderedMessage = template
          .replace(/\{name\}/g, stu.name)
          .replace(/\{code\}/g, stu.studentCode)
          .replace(/\{batch\}/g, batch?.code || 'ব্যাচ')
          .replace(/\{course\}/g, course?.title || 'প্রশিক্ষণ কোর্স')
          .replace(/\{schedule\}/g, batch?.schedule || 'নির্ধারিত সময়')
          .replace(/\{room\}/g, batch?.room || 'প্রশিক্ষণ ল্যাব')
          .replace(/\{eventDate\}/g, eventDate || todayStr)
          .replace(/\{updateNote\}/g, updateNote.trim() || 'নির্ধারিত সময়সূচি অনুযায়ী')
          .replace(/\{netFee\}/g, formatBDT(netFee))
          .replace(/\{paid\}/g, formatBDT(stu.paidAmount))
          .replace(/\{due\}/g, formatBDT(due))
          .replace(/\{deadline\}/g, paymentDeadline || nextWeekStr)
          .trim()
          .slice(0, 500);

        return {
          student: stu,
          batch,
          course,
          netFee,
          due,
          phone,
          hasValidPhone,
          lastSentAt,
          skippedByCooldown,
          renderedMessage,
        };
      });
  }, [
    state.students,
    state.batches,
    state.courses,
    state.smsLogs,
    onlyActiveStudents,
    selectedBatchId,
    activeRuleId,
    activeRule.category,
    minDueAmount,
    searchQueue,
    phonePreference,
    cooldownMode,
    template,
    eventDate,
    updateNote,
    paymentDeadline,
    todayStr,
    nextWeekStr,
  ]);

  const eligibleRows = useMemo(
    () => evaluatedMatches.filter((r) => r.hasValidPhone && !r.skippedByCooldown),
    [evaluatedMatches]
  );

  const queuedRows = useMemo(
    () => eligibleRows.filter((r) => !excludedIds.includes(r.student.id)),
    [eligibleRows, excludedIds]
  );

  // Reset manual exclusions when core filters change so stale exclusions don't stick silently
  useEffect(() => {
    setExcludedIds([]);
  }, [selectedBatchId, cooldownMode, onlyActiveStudents]);

  const toggleStudentInQueue = (studentId: string) => {
    setExcludedIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Summary KPIs across portal
  const totalDueStudentsCount = state.students.filter(
    (s) => s.status === 'সক্রিয়' && getStudentDue(s) > 0
  ).length;
  const totalDueAmount = state.students.reduce((sum, s) => sum + getStudentDue(s), 0);
  const todaySentCount = state.smsLogs.filter((l) => l.sentAt.slice(0, 10) === todayStr).length;
  const autoRelevantLogs = useMemo(
    () =>
      state.smsLogs.filter(
        (l) => l.category === 'সাধারণ নোটিশ' || l.category === 'বেতন ও বকেয়া'
      ),
    [state.smsLogs]
  );

  const handleRunAutomation = async (channel: SmsChannel) => {
    setFeedback(null);
    if (queuedRows.length === 0 || !template.trim()) {
      setFeedback({
        type: 'err',
        text: 'পাঠানোর মতো কোনো যোগ্য শিক্ষার্থী বা বার্তা পাওয়া যায়নি।',
      });
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const logs: SmsNotification[] = queuedRows
      .filter((row) => row.renderedMessage.length >= 2 && row.phone.length >= 6)
      .map((row) => ({
        id: generateId('sms'),
        studentId: row.student.id,
        studentName: row.student.name.slice(0, 120),
        studentEmail: row.student.email || '',
        guardianPhone: row.phone.slice(0, 30),
        category: activeRule.category,
        message: row.renderedMessage.slice(0, 500),
        sentAt: timestamp,
        channel,
      }));

    if (logs.length === 0) {
      setFeedback({
        type: 'err',
        text: 'সঠিক মোবাইল নম্বর ও বার্তাসহ কোনো প্রাপক পাওয়া যায়নি।',
      });
      return;
    }

    setDispatching(true);
    try {
      if (channel === 'ডিভাইস SMS' && logs.length === 1) {
        const cleanNumber = logs[0].guardianPhone.replace(/[^\d+]/g, '');
        const a = document.createElement('a');
        a.href = `sms:${cleanNumber}?body=${encodeURIComponent(logs[0].message)}`;
        a.click();
      }
      await Promise.resolve(onSaveSmsLogs(logs));
      setFeedback({
        type: 'ok',
        text: `${logs.length} জন শিক্ষার্থীর জন্য "${activeRule.title}" অটোমেটেড SMS লগ Firestore ডাটাবেসে সংরক্ষিত হয়েছে।`,
      });
    } catch {
      setFeedback({
        type: 'err',
        text: 'SMS লগ সংরক্ষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      });
    } finally {
      setDispatching(false);
    }
  };

  const handleExportQueueCsv = () => {
    const headers = ['মোবাইল নম্বর', 'শিক্ষার্থী আইডি', 'শিক্ষার্থীর নাম', 'ব্যাচ', 'ধরন', 'SMS বার্তা'];
    const rows = queuedRows.map((row) => [
      row.phone,
      row.student.studentCode,
      row.student.name,
      row.batch?.code || '',
      activeRule.category,
      row.renderedMessage,
    ]);
    exportCsv(`automated-sms-${activeRule.id}-${todayStr}.csv`, headers, rows);
  };

  const cooldownSkippedCount = evaluatedMatches.filter((r) => r.skippedByCooldown).length;
  const invalidPhoneCount = evaluatedMatches.filter((r) => !r.hasValidPhone).length;

  return (
    <div className="space-y-6">
      {/* Top 4 Flat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>প্রস্তুত প্রাপক কিউ</span>
            <BellRing className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1.5">
            {queuedRows.length} জন
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {cooldownSkippedCount > 0
              ? `ডুপ্লিকেট এড়াতে ${cooldownSkippedCount} জন বাদ`
              : 'বর্তমান রুল অনুযায়ী প্রস্তুত'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>বকেয়া থাকা শিক্ষার্থী</span>
            <CreditCard className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-2xl font-bold text-amber-700 font-mono-tabular mt-1.5">
            {totalDueStudentsCount} জন
          </p>
          <p className="text-xs text-slate-500 font-mono-tabular mt-1">
            মোট বকেয়া: {formatBDT(totalDueAmount)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>আজ প্রেরিত SMS</span>
            <Send className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1.5">
            {todaySentCount}টি
          </p>
          <p className="text-xs text-slate-500 mt-1">আজকের তারিখ: {todayStr}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ক্লাস ও পেমেন্ট লগ</span>
            <MessageSquare className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1.5">
            {autoRelevantLogs.length}টি
          </p>
          <p className="text-xs text-slate-500 mt-1">শিক্ষার্থী পোর্টালেও দৃশ্যমান</p>
        </div>
      </div>

      {/* Automation Rule Selector Cards */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              অটোমেটেড SMS রুল নির্বাচন করুন
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ক্লাস আপডেট বা বেতন বকেয়ার রুল বাছাই করলে প্রাপক তালিকা ও ব্যক্তিগত বার্তা স্বয়ংক্রিয়ভাবে তৈরি হবে
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('sms')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            ম্যানুয়াল SMS কম্পোজার
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {AUTOMATION_RULES.map((rule) => {
            const isSelected = rule.id === activeRuleId;
            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => handleSelectRule(rule.id)}
                className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-blue-700 bg-blue-50/40 ring-1 ring-blue-700'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        rule.group === 'class' ? 'text-blue-700' : 'text-amber-700'
                      }`}
                    >
                      {rule.group === 'class' ? 'ক্লাস আপডেট' : 'পেমেন্ট রিমাইন্ডার'}
                    </span>
                    {rule.group === 'class' ? (
                      <CalendarClock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    ) : (
                      <CreditCard className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{rule.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{rule.description}</p>
                </div>
                <span className="text-[11px] font-mono-tabular text-slate-500">
                  ক্যাটাগরি: {rule.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rule Configuration & Template Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Target Filters & Schedule/Payment Context */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Filter className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-semibold text-slate-900">টার্গেট শর্তাবলি ও ফিল্টার</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ব্যাচ ফিল্টার</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="all">সকল ব্যাচ</option>
                {state.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ডুপ্লিকেট সুরক্ষা (Cooldown)
              </label>
              <select
                value={cooldownMode}
                onChange={(e) => setCooldownMode(e.target.value as CooldownMode)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="today">আজ পাঠানোদের বাদ দিন</option>
                <option value="7days">গত ৭ দিনে পাঠানোদের বাদ দিন</option>
                <option value="none">সবাইকে অন্তর্ভুক্ত করুন</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                প্রাপক ফোন অগ্রাধিকার
              </label>
              <select
                value={phonePreference}
                onChange={(e) => setPhonePreference(e.target.value as PhonePreference)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="student_first">শিক্ষার্থীর নম্বর (প্রথমে)</option>
                <option value="guardian_first">অভিভাবকের নম্বর (প্রথমে)</option>
              </select>
            </div>

            {activeRuleId === 'payment_due' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  সর্বনিম্ন বকেয়া (৳)
                </label>
                <input
                  type="number"
                  min={1}
                  value={minDueAmount}
                  onChange={(e) => setMinDueAmount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg"
                />
              </div>
            ) : activeRule.group === 'payment' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  পরিশোধের শেষ তারিখ
                </label>
                <input
                  type="date"
                  value={paymentDeadline}
                  onChange={(e) => setPaymentDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ক্লাসের তারিখ
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg"
                />
              </div>
            )}
          </div>

          {activeRuleId === 'payment_due' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                বকেয়া পরিশোধের শেষ তারিখ
              </label>
              <input
                type="date"
                value={paymentDeadline}
                onChange={(e) => setPaymentDeadline(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-200 rounded-lg"
              />
            </div>
          )}

          {activeRuleId === 'class_reschedule' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                পরিবর্তিত সময় / রুম / আপডেট তথ্য
              </label>
              <input
                type="text"
                value={updateNote}
                onChange={(e) => setUpdateNote(e.target.value)}
                maxLength={160}
                placeholder="যেমন: দুপুর ৩:০০ টায় ওয়েব ল্যাব ০২-তে ক্লাস হবে"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          )}

          <label className="flex items-center gap-2 pt-1 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyActiveStudents}
              onChange={(e) => setOnlyActiveStudents(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            কেবল সক্রিয় (Active) শিক্ষার্থীদের অন্তর্ভুক্ত করুন
          </label>
        </div>

        {/* Right: Dynamic Template & Dispatch Actions */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                ডায়নামিক SMS টেমপ্লেট ({activeRule.title})
              </h3>
              <p className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
                ভ্যারিয়েবল: {'{name}'}, {'{code}'}, {'{course}'}, {'{batch}'}, {'{schedule}'},{' '}
                {'{room}'}, {'{due}'}, {'{deadline}'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTemplate(activeRule.defaultTemplate)}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              ডিফল্ট টেমপ্লেট
            </button>
          </div>

          <textarea
            rows={4}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            maxLength={480}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
          />

          {queuedRows.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold">
                  প্রথম প্রাপকের প্রিভিউ ({queuedRows[0].student.name})
                </span>
                <span className="font-mono-tabular">
                  {queuedRows[0].renderedMessage.length} অক্ষর
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed">
                {queuedRows[0].renderedMessage}
              </p>
            </div>
          )}

          {feedback && (
            <div
              className={`rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-medium border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleRunAutomation('গেটওয়ে প্রস্তুত / লগ')}
              disabled={dispatching || queuedRows.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              {dispatching
                ? 'পাঠানো হচ্ছে...'
                : `অটোমেটেড SMS পাঠান (${queuedRows.length} জন)`}
            </button>

            {queuedRows.length === 1 && (
              <button
                type="button"
                onClick={() => handleRunAutomation('ডিভাইস SMS')}
                disabled={dispatching}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                ডিভাইসে SMS খুলুন
              </button>
            )}

            <button
              type="button"
              onClick={handleExportQueueCsv}
              disabled={queuedRows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Queue CSV
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              স্বয়ংক্রিয় প্রাপক ও বার্তা প্রিভিউ কিউ ({queuedRows.length}/{eligibleRows.length} জন নির্বাচিত)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {invalidPhoneCount > 0
                ? `${invalidPhoneCount} জনের সঠিক মোবাইল নম্বর নেই · `
                : ''}
              পাঠানোর আগে যেকোনো শিক্ষার্থীকে আনচেক করে বাদ দিতে পারেন
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQueue}
              onChange={(e) => setSearchQueue(e.target.value)}
              placeholder="কিউ খুঁজুন (নাম / আইডি)..."
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
            />
            <button
              type="button"
              onClick={() => setExcludedIds([])}
              className="px-2.5 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap"
            >
              সব নির্বাচন
            </button>
            <button
              type="button"
              onClick={() => setExcludedIds(eligibleRows.map((r) => r.student.id))}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              সব বাদ
            </button>
          </div>
        </div>

        {evaluatedMatches.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">
              বর্তমান শর্তে কোনো শিক্ষার্থী পাওয়া যায়নি
            </p>
            <p className="text-xs text-slate-500">
              {activeRuleId === 'payment_due'
                ? 'এই মুহূর্তে কোনো শিক্ষার্থীর বকেয়া নেই অথবা নির্বাচিত ব্যাচে বকেয়াধারী শিক্ষার্থী নেই।'
                : 'ব্যাচ ফিল্টার পরিবর্তন করুন বা নতুন শিক্ষার্থী ভর্তি করুন।'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-10">নির্বাচন</th>
                  <th className="py-3 px-4 whitespace-nowrap">শিক্ষার্থী ও ব্যাচ</th>
                  <th className="py-3 px-4 whitespace-nowrap">প্রাপক নম্বর</th>
                  <th className="py-3 px-4">প্রস্তুতকৃত SMS বার্তা</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">অবস্থা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {evaluatedMatches.map((row) => {
                  const disabled = !row.hasValidPhone || row.skippedByCooldown;
                  const checked = !disabled && !excludedIds.includes(row.student.id);
                  return (
                    <tr
                      key={row.student.id}
                      className={`hover:bg-slate-50/80 ${disabled ? 'opacity-55 bg-slate-50/40' : ''}`}
                    >
                      <td className="py-3 px-4 align-top">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleStudentInQueue(row.student.id)}
                          aria-label={`${row.student.name} নির্বাচন`}
                          className="rounded border-slate-300 text-blue-700 mt-0.5"
                        />
                      </td>
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <p className="font-medium text-slate-900">{row.student.name}</p>
                        <p className="font-mono-tabular text-slate-500 mt-0.5">
                          {row.student.studentCode} · {row.batch?.code || '—'}
                          {row.due > 0 ? ` · বকেয়া ${formatBDT(row.due)}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 align-top font-mono-tabular text-slate-700 whitespace-nowrap">
                        {row.hasValidPhone ? row.phone : 'নম্বর নেই'}
                      </td>
                      <td className="py-3 px-4 align-top text-slate-700 max-w-lg leading-relaxed">
                        {row.renderedMessage}
                      </td>
                      <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                        {!row.hasValidPhone ? (
                          <span className="font-medium text-rose-700">নম্বর অসম্পূর্ণ</span>
                        ) : row.skippedByCooldown ? (
                          <span className="font-medium text-amber-700">
                            ইতোমধ্যে প্রেরিত ({row.lastSentAt?.slice(0, 10)})
                          </span>
                        ) : row.lastSentAt ? (
                          <span className="font-medium text-slate-600">
                            পূর্বের লগ: {row.lastSentAt.slice(0, 10)}
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-700">পাঠানোর জন্য প্রস্তুত</span>
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

      {/* Existing SMS Log History Filtered for Class Updates & Payment Reminders */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              সাম্প্রতিক ক্লাস ও পেমেন্ট SMS লগ ({autoRelevantLogs.length}টি)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('sms')}
            className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
          >
            সব SMS লগ দেখুন
          </button>
        </div>

        {autoRelevantLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            এখনো ক্লাস আপডেট বা পেমেন্ট রিমাইন্ডার লগ সংরক্ষিত হয়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">সময়</th>
                  <th className="py-3 px-4 whitespace-nowrap">শিক্ষার্থী ও নম্বর</th>
                  <th className="py-3 px-4 whitespace-nowrap">ক্যাটাগরি ও মাধ্যম</th>
                  <th className="py-3 px-4">বার্তা</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {autoRelevantLogs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono-tabular text-slate-500 whitespace-nowrap">
                      {log.sentAt}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-medium text-slate-900">{log.studentName}</p>
                      <p className="font-mono-tabular text-slate-500">{log.guardianPhone}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p
                        className={`font-medium ${
                          log.category === 'বেতন ও বকেয়া' ? 'text-amber-700' : 'text-blue-700'
                        }`}
                      >
                        {log.category}
                      </p>
                      <p className="text-[11px] text-slate-500">{log.channel}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md">{log.message}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onDeleteSmsLog(log.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-700 rounded-md"
                        title="লগ মুছুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
  );
}
