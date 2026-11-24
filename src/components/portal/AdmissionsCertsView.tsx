import { useState } from 'react';
import { Award, CheckCircle2, Plus, Printer, Trash2, UserPlus, X } from 'lucide-react';
import {
  AdmissionInquiry,
  CertificateRecord,
  InquiryStatus,
  InstituteState,
} from '../../types/institute';
import { generateId } from '../../utils/storage';
import { CertificatePrintModal } from './ReceiptPrintModal';

interface AdmissionsCertsViewProps {
  state: InstituteState;
  onUpdateInquiryStatus: (id: string, status: InquiryStatus) => void;
  onConvertInquiryToStudent: (inquiry: AdmissionInquiry) => void;
  onAddCertificate: (cert: CertificateRecord) => void;
  onDeleteCertificate: (id: string) => void;
}

export function AdmissionsCertsView({
  state,
  onUpdateInquiryStatus,
  onConvertInquiryToStudent,
  onAddCertificate,
  onDeleteCertificate,
}: AdmissionsCertsViewProps) {
  const [subTab, setSubTab] = useState<'inquiries' | 'certificates'>('inquiries');
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);

  // Issue Certificate form
  const [selectedStudentId, setSelectedStudentId] = useState(state.students[0]?.id || '');
  const [grade, setGrade] = useState('A+ (৯২%)');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));

  const filteredInquiries = state.inquiries.filter((inq) =>
    statusFilter === 'all' ? true : inq.status === statusFilter
  );

  const handleIssueCertificate = (e: React.FormEvent) => {
    e.preventDefault();
    const stu = state.students.find((s) => s.id === selectedStudentId);
    if (!stu) return;
    const course = state.courses.find((c) => c.id === stu.courseId);
    const batch = state.batches.find((b) => b.id === stu.batchId);

    const maxCertNum = state.certificates.reduce((acc, c) => {
      const m = c.certificateId.match(/(\d+)$/);
      return Math.max(acc, m ? parseInt(m[1], 10) : 1042);
    }, 1042);

    const newCert: CertificateRecord = {
      id: generateId('cert'),
      certificateId: `D71-2026-${maxCertNum + 1}`,
      studentName: stu.name,
      studentCode: stu.studentCode,
      courseTitle: course?.title || 'আইটি ও ফ্রিল্যান্সিং কোর্স',
      batchCode: batch?.code || 'BATCH-26',
      grade: grade.trim() || 'A+',
      issueDate,
    };

    onAddCertificate(newCert);
    setCertModalOpen(false);
    setPreviewCert(newCert);
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setSubTab('inquiries')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'inquiries'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ভর্তি আবেদন ({state.inquiries.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('certificates')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'certificates'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সার্টিফিকেট রেজিস্ট্রি ({state.certificates.length})
          </button>
        </div>

        {subTab === 'inquiries' ? (
          <div className="flex items-center gap-2 overflow-x-auto">
            {(['all', 'অপেক্ষমাণ', 'যোগাযোগ করা হয়েছে', 'ভর্তি সম্পন্ন'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === s
                    ? 'border-blue-700 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s === 'all' ? 'সব আবেদন' : s}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCertModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন সার্টিফিকেট ইস্যু
          </button>
        )}
      </div>

      {subTab === 'inquiries' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredInquiries.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              এই ক্যাটাগরিতে কোনো আবেদন নেই।
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredInquiries.map((inq) => {
                const course = state.courses.find((c) => c.id === inq.courseId);
                return (
                  <div
                    key={inq.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono-tabular">{inq.submittedAt}</span>
                        <span>·</span>
                        <span>{inq.preferredSlot}</span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900">{inq.name}</h3>
                      <p className="text-xs text-slate-700">
                        কোর্স: <span className="font-medium">{course?.title || '—'}</span> ·{' '}
                        <span className="font-mono-tabular">{inq.phone}</span> · {inq.email}
                      </p>
                      {inq.message && (
                        <p className="text-xs text-slate-500 mt-1">{inq.message}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                      <select
                        value={inq.status}
                        onChange={(e) =>
                          onUpdateInquiryStatus(inq.id, e.target.value as InquiryStatus)
                        }
                        aria-label="আবেদনের অবস্থা"
                        className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700"
                      >
                        <option value="অপেক্ষমাণ">অপেক্ষমাণ</option>
                        <option value="যোগাযোগ করা হয়েছে">যোগাযোগ করা হয়েছে</option>
                        <option value="ভর্তি সম্পন্ন">ভর্তি সম্পন্ন</option>
                        <option value="বাতিল">বাতিল</option>
                      </select>

                      {inq.status !== 'ভর্তি সম্পন্ন' && (
                        <button
                          type="button"
                          onClick={() => onConvertInquiryToStudent(inq)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          শিক্ষার্থী হিসেবে ভর্তি করুন
                        </button>
                      )}

                      {inq.status === 'ভর্তি সম্পন্ন' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          ভর্তি হয়েছে
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">সার্টিফিকেট আইডি</th>
                  <th className="py-3 px-4 whitespace-nowrap">শিক্ষার্থী</th>
                  <th className="py-3 px-4 whitespace-nowrap">কোর্স ও ব্যাচ</th>
                  <th className="py-3 px-4 whitespace-nowrap">গ্রেড</th>
                  <th className="py-3 px-4 whitespace-nowrap">ইস্যুর তারিখ</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {state.certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-blue-700 whitespace-nowrap">
                      {cert.certificateId}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{cert.studentName}</p>
                      <p className="text-xs text-slate-500 font-mono-tabular">
                        {cert.studentCode}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="text-slate-800 font-medium">{cert.courseTitle}</p>
                      <p className="text-slate-500 font-mono-tabular mt-0.5">
                        ব্যাচ: {cert.batchCode}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-emerald-700 whitespace-nowrap">
                      {cert.grade}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                      {cert.issueDate}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewCert(cert)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          প্রিন্ট
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCertificate(cert.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue Certificate Modal */}
      {certModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-700" />
                <h3 className="text-base font-semibold text-slate-900">নতুন সার্টিফিকেট ইস্যু</h3>
              </div>
              <button
                type="button"
                onClick={() => setCertModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueCertificate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  শিক্ষার্থী নির্বাচন করুন *
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  required
                >
                  {state.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentCode} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    মূল্যায়ন গ্রেড
                  </label>
                  <input
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="A+ (৯৪%)"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ইস্যুর তারিখ
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                    required
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                ইস্যু করার পর এই সার্টিফিকেট আইডি দিয়ে পাবলিক ওয়েবসাইটের &quot;সার্টিফিকেট যাচাই&quot;
                অংশে তাৎক্ষণিক ভেরিফিকেশন করা যাবে।
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCertModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  ইস্যু করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CertificatePrintModal certificate={previewCert} onClose={() => setPreviewCert(null)} />
    </div>
  );
}
