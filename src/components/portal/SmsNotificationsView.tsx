import { useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Download,
  ExternalLink,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import { InstituteState, SmsCategory, SmsNotification } from '../../types/institute';
import { exportCsv, formatBDT, generateId, getStudentDue } from '../../utils/storage';

interface SmsNotificationsViewProps {
  state: InstituteState;
  onSaveSmsLogs: (logs: SmsNotification[]) => Promise<void> | void;
  onDeleteSmsLog: (id: string) => Promise<void> | void;
  prefillSms?: {
    category: SmsCategory;
    studentIds: string[];
    message?: string;
  } | null;
  onClearPrefill?: () => void;
  onOpenAutoSms?: () => void;
}

export function SmsNotificationsView({
  state,
  onSaveSmsLogs,
  onDeleteSmsLog,
  prefillSms,
  onClearPrefill,
  onOpenAutoSms,
}: SmsNotificationsViewProps) {
  const [category, setCategory] = useState<SmsCategory>(prefillSms?.category || 'হাজিরা');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    prefillSms?.studentIds || []
  );
  const [messageTemplate, setMessageTemplate] = useState<string>(
    prefillSms?.message ||
      'ড্রিম-৭১ আইটি নাঙ্গলকোট: প্রিয় অভিভাবক, আপনার সন্তান {name} ({code}) এর আজকের উপস্থিতি ও ক্লাস কার্যক্রম সম্পর্কে অবহিত করা হলো।'
  );
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (prefillSms) {
      setCategory(prefillSms.category);
      setSelectedStudentIds(prefillSms.studentIds);
      if (prefillSms.message) {
        setMessageTemplate(prefillSms.message);
      }
      setNotice('');
      onClearPrefill?.();
    }
  }, [prefillSms, onClearPrefill]);

  const applyCategoryTemplate = (cat: SmsCategory) => {
    setCategory(cat);
    setNotice('');
    if (cat === 'হাজিরা') {
      setMessageTemplate(
        'ড্রিম-৭১ আইটি নাঙ্গলকোট: প্রিয় অভিভাবক, {name} ({code}) আজকের ({batch}) ক্লাসে অনুপস্থিত ছিল। অনুগ্রহ করে নিয়মিত উপস্থিতি নিশ্চিত করুন।'
      );
    } else if (cat === 'বেতন ও বকেয়া') {
      setMessageTemplate(
        'ড্রিম-৭১ আইটি নাঙ্গলকোট: {name} ({code}) এর বর্তমান বকেয়া ফি {due}। অনুগ্রহ করে দ্রুত পরিশোধ করার অনুরোধ রইল।'
      );
    } else if (cat === 'পরীক্ষা ও রেজাল্ট') {
      setMessageTemplate(
        'ড্রিম-৭১ আইটি নাঙ্গলকোট: {name} ({code}) এর সাম্প্রতিক মূল্যায়ন পরীক্ষার ফলাফল প্রকাশিত হয়েছে। বিস্তারিত জানতে যোগাযোগ করুন।'
      );
    } else {
      setMessageTemplate(
        'ড্রিম-৭১ আইটি নাঙ্গলকোট: প্রিয় অভিভাবক, আগামী ক্লাস ও ব্যাচ ({batch}) নির্ধারিত সময়সূচি অনুযায়ী অনুষ্ঠিত হবে।'
      );
    }
  };

  const filteredStudents = state.students.filter(
    (s) => selectedBatchId === 'all' || s.batchId === selectedBatchId
  );

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectPresetGroup = (group: 'absentToday' | 'dueOnly' | 'allVisible' | 'clear') => {
    setNotice('');
    if (group === 'clear') {
      setSelectedStudentIds([]);
      return;
    }
    if (group === 'allVisible') {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
      return;
    }
    if (group === 'dueOnly') {
      applyCategoryTemplate('বেতন ও বকেয়া');
      setSelectedStudentIds(filteredStudents.filter((s) => getStudentDue(s) > 0).map((s) => s.id));
      return;
    }
    // absentToday — check latest attendance date
    applyCategoryTemplate('হাজিরা');
    const latestDate = [...state.attendance]
      .map((a) => a.date)
      .sort()
      .pop();
    if (!latestDate) {
      setSelectedStudentIds([]);
      return;
    }
    const absentIds = new Set<string>();
    state.attendance
      .filter((a) => a.date === latestDate)
      .forEach((a) => {
        Object.entries(a.entries).forEach(([stuId, st]) => {
          if (st === 'অনুপস্থিত') absentIds.add(stuId);
        });
      });
    setSelectedStudentIds(filteredStudents.filter((s) => absentIds.has(s.id)).map((s) => s.id));
  };

  const buildPersonalizedMessage = (studentId: string) => {
    const stu = state.students.find((s) => s.id === studentId);
    if (!stu) return messageTemplate;
    const batch = state.batches.find((b) => b.id === stu.batchId);
    const due = formatBDT(getStudentDue(stu));
    return messageTemplate
      .replace(/\{name\}/g, stu.name)
      .replace(/\{code\}/g, stu.studentCode)
      .replace(/\{batch\}/g, batch?.code || 'ব্যাচ')
      .replace(/\{due\}/g, due);
  };

  const handleDispatchLogs = (channel: 'ডিভাইস SMS' | 'গেটওয়ে প্রস্তুত / লগ') => {
    if (selectedStudentIds.length === 0 || !messageTemplate.trim()) return;
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const logs: SmsNotification[] = selectedStudentIds
      .map((id): SmsNotification | null => {
        const stu = state.students.find((s) => s.id === id);
        if (!stu) return null;
        return {
          id: generateId('sms'),
          studentId: stu.id,
          studentName: stu.name,
          studentEmail: stu.email || '',
          guardianPhone: (stu.guardianPhone || stu.phone || '').trim(),
          category,
          message: buildPersonalizedMessage(stu.id).slice(0, 500),
          sentAt: timestamp,
          channel,
        };
      })
      .filter((item): item is SmsNotification => item !== null && item.guardianPhone.length >= 6);

    if (logs.length === 0) return;

    // If single recipient and device SMS requested, trigger native sms: protocol link cleanly
    if (channel === 'ডিভাইস SMS' && logs.length === 1) {
      const cleanNumber = logs[0].guardianPhone.replace(/[^\d+]/g, '');
      const smsHref = `sms:${cleanNumber}?body=${encodeURIComponent(logs[0].message)}`;
      const a = document.createElement('a');
      a.href = smsHref;
      a.click();
    }

    onSaveSmsLogs(logs);
    setNotice(`${logs.length}টি অভিভাবক SMS নোটিফিকেশন লগে সংরক্ষিত হয়েছে।`);
  };

  const handleExportBulkSmsCsv = () => {
    const headers = ['অভিভাবক মোবাইল', 'শিক্ষার্থী', 'আইডি', 'ক্যাটাগরি', 'বার্তা'];
    const rows = selectedStudentIds
      .map((id) => state.students.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((stu) => [
        stu.guardianPhone || stu.phone,
        stu.name,
        stu.studentCode,
        category,
        buildPersonalizedMessage(stu.id),
      ]);
    exportCsv(`guardian-sms-queue-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Composer */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                অভিভাবক SMS নোটিফিকেশন কম্পোজার
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                হাজিরা, বকেয়া ফি বা পরীক্ষার রেজাল্ট সরাসরি অভিভাবকের নম্বরে পাঠান ও লগ রাখুন
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {onOpenAutoSms && (
                <button
                  type="button"
                  onClick={onOpenAutoSms}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  অটোমেটেড SMS
                </button>
              )}
              <span className="text-xs font-mono-tabular font-semibold text-blue-700 whitespace-nowrap">
                নির্বাচিত: {selectedStudentIds.length} জন
              </span>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(['হাজিরা', 'বেতন ও বকেয়া', 'পরীক্ষা ও রেজাল্ট', 'সাধারণ নোটিশ'] as SmsCategory[]).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => applyCategoryTemplate(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    category === cat
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-700">SMS বার্তা (টেমপ্লেট)</label>
              <span className="text-[11px] text-slate-400 font-mono-tabular">
                ভ্যারিয়েবল: {'{name}'}, {'{code}'}, {'{batch}'}, {'{due}'}
              </span>
            </div>
            <textarea
              rows={4}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              maxLength={480}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
            />
          </div>

          {selectedStudentIds.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <p className="text-[11px] font-semibold text-slate-500">
                নমুনা প্রিভিউ ({state.students.find((s) => s.id === selectedStudentIds[0])?.name})
              </p>
              <p className="text-xs text-slate-800 leading-relaxed">
                {buildPersonalizedMessage(selectedStudentIds[0])}
              </p>
            </div>
          )}

          {notice && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {notice}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            {selectedStudentIds.length === 1 && (
              <button
                type="button"
                onClick={() => handleDispatchLogs('ডিভাইস SMS')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                ডিভাইসে SMS পাঠান
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDispatchLogs('গেটওয়ে প্রস্তুত / লগ')}
              disabled={selectedStudentIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              SMS পাঠান ও লগ সংরক্ষণ করুন
            </button>
            <button
              type="button"
              onClick={handleExportBulkSmsCsv}
              disabled={selectedStudentIds.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Bulk SMS CSV
            </button>
          </div>
        </div>

        {/* Recipient Selector */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">প্রাপক অভিভাবক নির্বাচন</h3>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">সব ব্যাচ</option>
              {state.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => selectPresetGroup('absentToday')}
              className="px-2.5 py-1 text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-100"
            >
              সর্বশেষ অনুপস্থিত
            </button>
            <button
              type="button"
              onClick={() => selectPresetGroup('dueOnly')}
              className="px-2.5 py-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100"
            >
              বকেয়াধারী শিক্ষার্থী
            </button>
            <button
              type="button"
              onClick={() => selectPresetGroup('allVisible')}
              className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200"
            >
              সবাইকে নির্বাচন
            </button>
            <button
              type="button"
              onClick={() => selectPresetGroup('clear')}
              className="px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800"
            >
              মুছুন
            </button>
          </div>

          <div className="flex-1 max-h-[300px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {filteredStudents.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">কোনো শিক্ষার্থী নেই।</p>
            ) : (
              filteredStudents.map((stu) => {
                const checked = selectedStudentIds.includes(stu.id);
                return (
                  <label
                    key={stu.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(stu.id)}
                        className="rounded border-slate-300 text-blue-700"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{stu.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          অভিভাবক: {stu.guardianName || 'শিক্ষার্থী'}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono-tabular text-slate-700 shrink-0">
                      {stu.guardianPhone || stu.phone}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SMS Dispatch Log History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              প্রেরিত SMS নোটিফিকেশন লগ ({state.smsLogs.length}টি)
            </h3>
          </div>
        </div>

        {state.smsLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            এখনো কোনো SMS নোটিফিকেশন পাঠানো হয়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">সময়</th>
                  <th className="py-3 px-4 whitespace-nowrap">শিক্ষার্থী ও অভিভাবক নম্বর</th>
                  <th className="py-3 px-4 whitespace-nowrap">ধরন</th>
                  <th className="py-3 px-4">বার্তা</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {state.smsLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono-tabular text-slate-500 whitespace-nowrap">
                      {log.sentAt}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-medium text-slate-900">{log.studentName}</p>
                      <p className="font-mono-tabular text-slate-500">{log.guardianPhone}</p>
                    </td>
                    <td className="py-3 px-4 font-medium text-blue-700 whitespace-nowrap">
                      {log.category}
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
