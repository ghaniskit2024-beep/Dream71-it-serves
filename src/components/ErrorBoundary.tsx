import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'অপ্রত্যাশিত একটি ত্রুটি ঘটেছে।';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.includes('Quota exceeded')) {
          readable = 'Firestore দৈনিক ফ্রি কোটা সীমা অতিক্রম করেছে। আগামীকাল পুনরায় চেষ্টা করুন।';
        } else if (parsed.error.includes('Missing or insufficient permissions')) {
          readable = `ডাটাবেস অনুমতি পাওয়া যায়নি (${parsed.operationType}: ${parsed.path || ''})। অনুগ্রহ করে অনুমোদিত অ্যাকাউন্ট দিয়ে লগইন করুন।`;
        } else {
          readable = parsed.error;
        }
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, errorMessage: readable };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-semibold text-base">
              <AlertCircle className="w-5 h-5 shrink-0" />
              সিস্টেমে একটি সমস্যা হয়েছে
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              পৃষ্ঠা রিলোড করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
