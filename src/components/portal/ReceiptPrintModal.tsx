import { Printer, X } from 'lucide-react';
import { CertificateRecord, Course, FeePayment, Student } from '../../types/institute';
import { formatBDT, getNetFee, getStudentDue } from '../../utils/storage';

interface ReceiptModalProps {
  payment: FeePayment | null;
  student: Student | undefined;
  course: Course | undefined;
  onClose: () => void;
}

export function ReceiptPrintModal({ payment, student, course, onClose }: ReceiptModalProps) {
  if (!payment || !student) return null;

  const netFee = getNetFee(student);
  const due = getStudentDue(student);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="পেমেন্ট রসিদ"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 no-print">
          <h3 className="text-base font-semibold text-slate-900">ফি পরিশোধের রসিদ</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              প্রিন্ট করুন
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 print-area space-y-5">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div className="flex items-start gap-3">
              <img
                src="/assets/aistudio/dream71_it_logo__2__e39bbd51.png"
                alt="Dream 71 লোগো"
                className="w-12 h-12 object-contain shrink-0"
              />
              <div>
                <p className="text-lg font-bold text-slate-900">ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট</p>
                <p className="text-xs text-slate-500 mt-0.5">নাঙ্গলকোট, কুমিল্লা</p>
                <p className="text-xs text-slate-500 font-mono-tabular">ফোন: +৮৮০ ১৭১৫-৪০৮২১০</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">রসিদ নম্বর</p>
              <p className="text-sm font-semibold text-slate-900 font-mono-tabular">
                {payment.receiptNo}
              </p>
              <p className="text-xs text-slate-500 font-mono-tabular mt-1">{payment.date}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">শিক্ষার্থীর নাম</p>
              <p className="font-semibold text-slate-900">{student.name}</p>
              <p className="text-xs text-slate-600 font-mono-tabular mt-0.5">
                আইডি: {student.studentCode}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">কোর্স</p>
              <p className="font-medium text-slate-900">{course?.title ?? 'নির্ধারিত কোর্স'}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                মাধ্যম: {payment.method} ({payment.reference || 'N/A'})
              </p>
            </div>
          </div>

          <div className="border-t border-b border-slate-200 py-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">মোট নির্ধারিত ফি (ছাড় বাদে)</span>
              <span className="font-mono-tabular font-medium text-slate-900">
                {formatBDT(netFee)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">এই রসিদে জমা ({payment.note || 'কোর্স ফি'})</span>
              <span className="font-mono-tabular font-bold text-emerald-700 text-base">
                {formatBDT(payment.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-600">মোট পরিশোধিত</span>
              <span className="font-mono-tabular font-medium text-slate-900">
                {formatBDT(student.paidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">বর্তমান বকেয়া</span>
              <span className="font-mono-tabular font-semibold text-slate-900">
                {formatBDT(due)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>কম্পিউটার জেনারেটেড রসিদ</span>
            <span>অ্যাকাউন্টস বিভাগ · ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CertificatePrintModalProps {
  certificate: CertificateRecord | null;
  onClose: () => void;
}

export function CertificatePrintModal({ certificate, onClose }: CertificatePrintModalProps) {
  if (!certificate) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="সার্টিফিকেট প্রিভিউ"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 no-print">
          <h3 className="text-base font-semibold text-slate-900">অফিশিয়াল সার্টিফিকেট</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              প্রিন্ট করুন
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-8 print-area">
          <div className="border-2 border-slate-900 p-8 text-center space-y-5 bg-slate-50/40">
            <div className="flex flex-col items-center justify-center gap-2">
              <img
                src="/assets/aistudio/dream71_it_logo__2__e39bbd51.png"
                alt="Dream 71 IT Service Nangalkot লোগো"
                className="w-16 h-16 object-contain"
              />
              <span className="text-lg font-bold tracking-tight text-slate-900">
                ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-600">
                গণপ্রজাতন্ত্রী বাংলাদেশ সরকার · NSDA (জাতীয় দক্ষতা উন্নয়ন কর্তৃপক্ষ) অনুমোদিত ·
                ASSET Project
              </p>
              <h2 className="text-2xl font-bold text-slate-900">সাফল্যের প্রত্যয়নপত্র</h2>
            </div>

            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              এই মর্মে প্রত্যয়ন করা যাচ্ছে যে,
            </p>

            <div className="space-y-1">
              <p className="text-2xl font-bold text-blue-800">{certificate.studentName}</p>
              <p className="text-xs text-slate-500 font-mono-tabular">
                শিক্ষার্থী আইডি: {certificate.studentCode} · ব্যাচ: {certificate.batchCode}
              </p>
            </div>

            <p className="text-sm text-slate-700 max-w-lg mx-auto leading-relaxed">
              সফলভাবে <span className="font-semibold text-slate-900">{certificate.courseTitle}</span>{' '}
              প্রশিক্ষণ কার্যক্রম, ল্যাব মূল্যায়ন ও চূড়ান্ত প্রজেক্ট{' '}
              <span className="font-semibold text-slate-900 font-mono-tabular">
                {certificate.grade}
              </span>{' '}
              গ্রেডসহ সম্পন্ন করেছেন।
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-200 text-xs text-slate-600">
              <div className="text-left">
                <p className="text-slate-400">সার্টিফিকেট আইডি</p>
                <p className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                  {certificate.certificateId}
                </p>
              </div>
              <div>
                <p className="text-slate-400">ইস্যুর তারিখ</p>
                <p className="font-mono-tabular font-semibold text-slate-900 mt-0.5">
                  {certificate.issueDate}
                </p>
              </div>
              <div>
                <p className="text-slate-400">চেয়ারম্যান</p>
                <p className="font-semibold text-slate-900 mt-0.5">Omar Faruk</p>
                <p className="text-[11px] text-slate-500">Co-Founder & Chairman</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400">ডিরেক্টর</p>
                <p className="font-semibold text-slate-900 mt-0.5">Osman Ghani</p>
                <p className="text-[11px] text-slate-500">Co-Founder & Director</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
