import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  Check,
  CheckCircle2,
  Clock,
  MessageSquare,
  QrCode,
  ScanLine,
  StopCircle,
  X,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, InstituteState } from '../../types/institute';
import { generateId } from '../../utils/storage';
import { QrCodeBadge } from './QrCodeBadge';

interface AttendanceViewProps {
  state: InstituteState;
  onSaveAttendance: (record: AttendanceRecord) => void;
  onNotifyAbsentSms: (batchId: string, date: string, absentStudentIds: string[]) => void;
}

export function AttendanceView({
  state,
  onSaveAttendance,
  onNotifyAbsentSms,
}: AttendanceViewProps) {
  const [selectedBatchId, setSelectedBatchId] = useState(state.batches[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>({});
  const [savedNotice, setSavedNotice] = useState(false);

  // QR Scan states
  const [qrInput, setQrInput] = useState('');
  const [scanModeStatus, setScanModeStatus] = useState<'উপস্থিত' | 'বিলম্বিত'>('উপস্থিত');
  const [scanFeedback, setScanFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [qrCardsModalOpen, setQrCardsModalOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const batchStudents = state.students.filter((s) => s.batchId === selectedBatchId);

  useEffect(() => {
    const existing = state.attendance.find(
      (a) => a.batchId === selectedBatchId && a.date === selectedDate
    );
    if (existing) {
      setEntries(existing.entries);
    } else {
      const initial: Record<string, AttendanceStatus> = {};
      batchStudents.forEach((s) => {
        initial[s.id] = 'উপস্থিত';
      });
      setEntries(initial);
    }
    setSavedNotice(false);
  }, [selectedBatchId, selectedDate, state.attendance, batchStudents.length]);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const processScannedCode = (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    // Prevent rapid duplicate trigger from webcam frames within 2.5 seconds
    const now = Date.now();
    if (
      lastScannedRef.current.code === trimmed.toUpperCase() &&
      now - lastScannedRef.current.at < 2500
    ) {
      return;
    }
    lastScannedRef.current = { code: trimmed.toUpperCase(), at: now };

    const target = state.students.find(
      (s) =>
        s.studentCode.toUpperCase() === trimmed.toUpperCase() ||
        s.id.toUpperCase() === trimmed.toUpperCase()
    );

    if (!target) {
      setScanFeedback({
        ok: false,
        text: `"${trimmed}" কোডের কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি।`,
      });
      return;
    }

    // Switch batch automatically if scanned student belongs to another batch
    if (target.batchId !== selectedBatchId) {
      setSelectedBatchId(target.batchId);
    }

    const existing = state.attendance.find(
      (a) => a.batchId === target.batchId && a.date === selectedDate
    );
    const baseEntries: Record<string, AttendanceStatus> = existing ? { ...existing.entries } : { ...entries };
    baseEntries[target.id] = scanModeStatus;

    setEntries(baseEntries);
    onSaveAttendance({
      id: existing ? existing.id : generateId('att'),
      batchId: target.batchId,
      date: selectedDate,
      entries: baseEntries,
    });
    setSavedNotice(true);
    setScanFeedback({
      ok: true,
      text: `${target.name} (${target.studentCode}) — "${scanModeStatus}" হিসেবে QR হাজিরা সম্পন্ন হয়েছে!`,
    });
    setQrInput('');
  };

  const startCameraScanner = async () => {
    setCameraError('');
    setScanFeedback(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'এই ব্রাউজারে ক্যামেরা অ্যাক্সেস সমর্থিত নয়। নিচের QR স্ক্যানার ইনপুট বক্স ব্যবহার করুন।'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});

        const scanFrame = () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || !streamRef.current) return;

          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (decoded?.data) {
                processScannedCode(decoded.data);
              }
            }
          }
          rafRef.current = requestAnimationFrame(scanFrame);
        };
        rafRef.current = requestAnimationFrame(scanFrame);
      }, 150);
    } catch {
      setCameraError(
        'ক্যামেরা চালু করা যায়নি বা অনুমতি পাওয়া যায়নি। USB QR স্ক্যানার বা নিচের কোড বক্স দিয়ে হাজিরা নিন।'
      );
      stopCamera();
    }
  };

  const handleManualQrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processScannedCode(qrInput);
  };

  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    setEntries((prev) => ({ ...prev, [studentId]: status }));
    setSavedNotice(false);
  };

  const handleMarkAllPresent = () => {
    const next: Record<string, AttendanceStatus> = {};
    batchStudents.forEach((s) => {
      next[s.id] = 'উপস্থিত';
    });
    setEntries(next);
    setSavedNotice(false);
  };

  const handleSave = () => {
    if (!selectedBatchId || !selectedDate) return;
    const existing = state.attendance.find(
      (a) => a.batchId === selectedBatchId && a.date === selectedDate
    );
    onSaveAttendance({
      id: existing ? existing.id : generateId('att'),
      batchId: selectedBatchId,
      date: selectedDate,
      entries,
    });
    setSavedNotice(true);
  };

  const presentCount = batchStudents.filter((s) => entries[s.id] === 'উপস্থিত').length;
  const lateCount = batchStudents.filter((s) => entries[s.id] === 'বিলম্বিত').length;
  const absentStudents = batchStudents.filter((s) => entries[s.id] === 'অনুপস্থিত');
  const absentCount = absentStudents.length;

  return (
    <div className="space-y-5">
      {/* Digital QR Attendance Scanner Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                ডিজিটাল হাজিরা (QR Code Scan)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ওয়েবক্যাম দিয়ে শিক্ষার্থীর আইডি QR স্ক্যান করুন অথবা USB QR স্ক্যানার / স্টুডেন্ট কোড দিয়ে সাথে সাথে হাজিরা দিন
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setQrCardsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <QrCode className="w-3.5 h-3.5" />
              ব্যাচের QR আইডি কার্ড
            </button>
            {cameraActive ? (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-rose-700 text-white rounded-lg hover:bg-rose-800 whitespace-nowrap"
              >
                <StopCircle className="w-3.5 h-3.5" />
                ক্যামেরা বন্ধ করুন
              </button>
            ) : (
              <button
                type="button"
                onClick={startCameraScanner}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5" />
                ক্যামেরা QR স্ক্যান চালু করুন
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <form onSubmit={handleManualQrSubmit} className="lg:col-span-8 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="QR স্ক্যান করুন বা আইডি লিখুন (যেমন: D71-2601)..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
              />
            </div>
            <select
              value={scanModeStatus}
              onChange={(e) => setScanModeStatus(e.target.value as 'উপস্থিত' | 'বিলম্বিত')}
              aria-label="স্ক্যান অবস্থা"
              className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
            >
              <option value="উপস্থিত">স্ট্যাটাস: উপস্থিত</option>
              <option value="বিলম্বিত">স্ট্যাটাস: বিলম্বিত</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              চেক-ইন করুন
            </button>
          </form>

          <div className="lg:col-span-4 text-xs text-slate-500 flex items-center justify-between lg:justify-end gap-2">
            <span>দ্রুত স্ক্যান:</span>
            {batchStudents.slice(0, 3).map((stu) => (
              <button
                key={stu.id}
                type="button"
                onClick={() => processScannedCode(stu.studentCode)}
                className="px-2 py-1 text-[11px] font-mono-tabular border border-slate-200 rounded hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
              >
                {stu.studentCode}
              </button>
            ))}
          </div>
        </div>

        {cameraError && (
          <div className="p-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
            {cameraError}
          </div>
        )}

        {cameraActive && (
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-950 flex flex-col items-center gap-2">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full max-w-sm rounded-lg aspect-video object-cover bg-black"
            />
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-[11px] text-slate-300">
              শিক্ষার্থীর স্টুডেন্ট কার্ডের QR কোডটি ক্যামেরার সামনে ধরুন...
            </p>
          </div>
        )}

        {scanFeedback && (
          <div
            className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
              scanFeedback.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {scanFeedback.text}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              ব্যাচ নির্বাচন করুন
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-700"
            >
              {state.batches.map((b) => {
                const course = state.courses.find((c) => c.id === b.courseId);
                return (
                  <option key={b.id} value={b.id}>
                    {b.code} — {course?.title}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">তারিখ</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="text-xs text-slate-600 font-mono-tabular flex items-center gap-3 mr-1">
            <span className="text-emerald-700 font-medium">উপস্থিত: {presentCount}</span>
            <span className="text-amber-700 font-medium">বিলম্বিত: {lateCount}</span>
            <span className="text-rose-700 font-medium">অনুপস্থিত: {absentCount}</span>
          </div>
          {absentCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onNotifyAbsentSms(
                  selectedBatchId,
                  selectedDate,
                  absentStudents.map((s) => s.id)
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-rose-200 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              অনুপস্থিত SMS ({absentCount})
            </button>
          )}
          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="px-3.5 py-2 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            সবাই উপস্থিত
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            উপস্থিতি সংরক্ষণ করুন
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-mono-tabular">{selectedDate}</span> তারিখের উপস্থিতি সফলভাবে সংরক্ষিত হয়েছে।
        </div>
      )}

      {/* Attendance Roster */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {batchStudents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            এই ব্যাচে এখনো কোনো শিক্ষার্থী ভর্তি করা হয়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">আইডি</th>
                  <th className="py-3 px-4 whitespace-nowrap">শিক্ষার্থীর নাম</th>
                  <th className="py-3 px-4 whitespace-nowrap">অভিভাবক মোবাইল</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">উপস্থিতির হার</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">আজকের অবস্থা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {batchStudents.map((student) => {
                  const currentStatus = entries[student.id] || 'উপস্থিত';
                  const batchRecords = state.attendance.filter((a) => a.batchId === selectedBatchId);
                  let totalDays = 0;
                  let presentDays = 0;
                  batchRecords.forEach((r) => {
                    if (r.entries[student.id]) {
                      totalDays += 1;
                      if (r.entries[student.id] !== 'অনুপস্থিত') presentDays += 1;
                    }
                  });
                  const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {student.studentCode}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {student.name}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500 whitespace-nowrap">
                        {student.guardianPhone || student.phone}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-xs font-medium text-slate-700 whitespace-nowrap">
                        {pct}% ({presentDays}/{totalDays || 1} দিন)
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'উপস্থিত')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              currentStatus === 'উপস্থিত'
                                ? 'bg-emerald-700 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            উপস্থিত
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'বিলম্বিত')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              currentStatus === 'বিলম্বিত'
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            বিলম্বিত
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetStatus(student.id, 'অনুপস্থিত')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              currentStatus === 'অনুপস্থিত'
                                ? 'bg-rose-700 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <X className="w-3 h-3" />
                            অনুপস্থিত
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

      {/* Batch QR ID Cards Modal */}
      {qrCardsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  ব্যাচের ডিজিটাল QR আইডি কার্ড ({batchStudents.length} জন)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  প্রতিটি QR কোড স্ক্যান করে শিক্ষার্থীদের তাৎক্ষণিক হাজিরা নেওয়া যাবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrCardsModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {batchStudents.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-8">
                  এই ব্যাচে এখনো কোনো শিক্ষার্থী নেই।
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {batchStudents.map((stu) => (
                    <QrCodeBadge
                      key={stu.id}
                      value={stu.studentCode}
                      label={stu.name}
                      subLabel={stu.studentCode}
                      size={120}
                      allowDownload
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
