import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { INSTITUTE_IMAGES, INITIAL_INSTITUTE_STATE } from '../data/seedData';
import {
  AdmissionInquiry,
  CertificateRecord,
  CourseCategory,
  InstituteState,
} from '../types/institute';
import { formatBDT, generateId } from '../utils/storage';
import { ImageWithFallback } from './ImageWithFallback';

interface PublicWebsiteProps {
  state: InstituteState;
  onOpenPortal: () => void;
  onOpenStudentPortal: () => void;
  onSubmitInquiry: (inquiry: AdmissionInquiry) => Promise<void>;
  onVerifyCertificate: (certId: string) => Promise<CertificateRecord | null>;
}

export function PublicWebsite({
  state,
  onOpenPortal,
  onOpenStudentPortal,
  onSubmitInquiry,
  onVerifyCertificate,
}: PublicWebsiteProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'courses' | 'program' | null>(null);
  const [menuHoverCategory, setMenuHoverCategory] = useState<CourseCategory>('tech');
  const [courseFilter, setCourseFilter] = useState<CourseCategory | null>(null);
  const [expandedSyllabusId, setExpandedSyllabusId] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
        setMobileNavOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Certificate lookup state
  const [certQuery, setCertQuery] = useState('');
  const [certSearched, setCertSearched] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [certResult, setCertResult] = useState<CertificateRecord | null>(null);

  const activeCourses = state.courses.filter((c) => c.active);
  const allCoursesWithPaidFallback =
    activeCourses.some((c) => c.category === 'paid')
      ? activeCourses
      : [...activeCourses, ...INITIAL_INSTITUTE_STATE.courses.filter((c) => c.category === 'paid')];

  // Admission inquiry form state
  const [appName, setAppName] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appEmail, setAppEmail] = useState('');
  const [appCourseId, setAppCourseId] = useState(
    () => activeCourses[0]?.id || INITIAL_INSTITUTE_STATE.courses[0]?.id || ''
  );
  const [appSlot, setAppSlot] = useState('সকাল ১০:০০ (শুক্র ও শনি)');
  const [appMessage, setAppMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const visibleCourses =
    courseFilter === null
      ? []
      : allCoursesWithPaidFallback.filter((c) => c.category === courseFilter);

  const menuCourses = allCoursesWithPaidFallback.filter((c) => c.category === menuHoverCategory);

  const openBatches = state.batches.filter((b) => b.status !== 'সম্পন্ন');

  const scrollToSection = (sectionId: string) => {
    setOpenDropdown(null);
    setMobileNavOpen(false);
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBrowseCategory = (category: CourseCategory) => {
    setCourseFilter(category);
    scrollToSection('courses');
  };

  const handleSelectCourseForAdmission = (courseId: string) => {
    setAppCourseId(courseId);
    setSubmittedRef(null);
    scrollToSection('admission');
  };

  const handleVerifyCertificate = async (e: React.FormEvent, overrideId?: string) => {
    e.preventDefault();
    const target = (overrideId ?? certQuery).trim().toUpperCase();
    if (!target) return;
    if (overrideId) setCertQuery(overrideId);
    setCertLoading(true);
    try {
      const found = await onVerifyCertificate(target);
      setCertResult(found);
      setCertSearched(true);
    } catch {
      setCertResult(null);
      setCertSearched(true);
    } finally {
      setCertLoading(false);
    }
  };

  const handleSubmitAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanPhone = appPhone.replace(/[\s-]/g, '');
    if (!appName.trim()) {
      setFormError('অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন।');
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setFormError('সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)।');
      return;
    }
    if (appEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appEmail.trim())) {
      setFormError('অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা লিখুন।');
      return;
    }

    const newInquiry: AdmissionInquiry = {
      id: generateId('inq'),
      name: appName.trim(),
      phone: appPhone.trim(),
      email: appEmail.trim(),
      courseId: appCourseId || allCoursesWithPaidFallback[0]?.id || '',
      preferredSlot: appSlot,
      message: appMessage.trim(),
      submittedAt: new Date().toISOString().slice(0, 10),
      status: 'অপেক্ষমাণ',
    };

    setSubmitting(true);
    try {
      await onSubmitInquiry(newInquiry);
      setSubmittedRef(newInquiry.id.toUpperCase());
      setAppName('');
      setAppPhone('');
      setAppEmail('');
      setAppMessage('');
    } catch {
      setFormError('আবেদন জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 10 Minute School–Style Clean Navigation Header */}
      <header
        ref={navRef}
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Mark & Wordmark */}
          <a
            href="#top"
            onClick={() => {
              setOpenDropdown(null);
              setMobileNavOpen(false);
            }}
            className="flex items-center gap-2.5 text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <img
              src="/assets/aistudio/dream71_it_logo__2__e39bbd51.png"
              alt="Dream 71 IT Service Nangalkot লোগো"
              className="w-9 h-9 object-contain shrink-0"
            />
            <span>ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট</span>
          </a>

          {/* Zone 2: Structured Navigation Menu with Dropdowns */}
          <nav
            className="hidden lg:flex items-center gap-1 text-sm font-medium text-slate-700"
            aria-label="প্রধান নেভিগেশন"
          >
            {/* Dropdown 1: Courses (10MS-style category + course explorer) */}
            <div
              className="relative"
              onMouseEnter={() => setOpenDropdown('courses')}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'courses' ? null : 'courses')}
                aria-expanded={openDropdown === 'courses'}
                className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  openDropdown === 'courses'
                    ? 'text-blue-700 bg-blue-50/70'
                    : 'hover:text-blue-700 hover:bg-slate-50'
                }`}
              >
                কোর্সসমূহ
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    openDropdown === 'courses' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openDropdown === 'courses' && (
                <div className="absolute left-0 top-full pt-2 w-[560px] z-50">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-5 grid grid-cols-12 gap-5">
                    <div className="col-span-5 border-r border-slate-100 pr-4 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 pb-1">
                        কোর্স ক্যাটাগরি
                      </p>
                      {(
                        [
                          { id: 'tech', label: 'কম্পিউটার ও ওয়েব' },
                          { id: 'creative', label: 'ডিজাইন ও মার্কেটিং' },
                          { id: 'career', label: 'ভাষা, হিসাব ও উদ্যোক্তা' },
                          { id: 'paid', label: 'পেড কোর্স (৭০% বৃত্তি)' },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onMouseEnter={() => setMenuHoverCategory(cat.id)}
                          onClick={() => handleBrowseCategory(cat.id)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                            menuHoverCategory === cat.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-blue-700'
                          }`}
                        >
                          <span>{cat.label}</span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                        </button>
                      ))}
                    </div>

                    <div className="col-span-7 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 pb-1">
                        ক্যাটাগরির কোর্সসমূহ ({menuCourses.length}টি)
                      </p>
                      <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
                        {menuCourses.map((course) => (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => handleSelectCourseForAdmission(course.id)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-2.5 group"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-blue-700 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-800 group-hover:text-blue-700 truncate">
                                {course.title}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {course.fee === 0
                                  ? `${course.categoryLabel} · ৩ মাস · সম্পূর্ণ ফ্রি`
                                  : `${course.categoryLabel} · ৩ মাস · বৃত্তিতে ৳১,৫০০ (৭০% ছাড়)`}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dropdown 2: ASSET Project & Eligibility */}
            <div
              className="relative"
              onMouseEnter={() => setOpenDropdown('program')}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'program' ? null : 'program')}
                aria-expanded={openDropdown === 'program'}
                className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  openDropdown === 'program'
                    ? 'text-blue-700 bg-blue-50/70'
                    : 'hover:text-blue-700 hover:bg-slate-50'
                }`}
              >
                ASSET ও যোগ্যতা
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    openDropdown === 'program' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openDropdown === 'program' && (
                <div className="absolute left-0 top-full pt-2 w-72 z-50">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => scrollToSection('benefits')}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-3"
                    >
                      <GraduationCap className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900">সুবিধা সমূহ</p>
                        <p className="text-[11px] text-slate-500">
                          ৩ মাস ফ্রি ট্রেনিং ও ৳১২,০০০ ভাতা
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('eligibility')}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-3"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900">ভর্তির যোগ্যতা</p>
                        <p className="text-[11px] text-slate-500">
                          ন্যূনতম এসএসসি · ১৮–৪৫ বছর · ২৪ আসন
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('admission')}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-start gap-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900">অনলাইন ভর্তি ফর্ম</p>
                        <p className="text-[11px] text-slate-500">সরাসরি ফ্রি নিবন্ধন করুন</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <a
              href="#batches"
              onClick={() => setOpenDropdown(null)}
              className="px-3 py-2 rounded-lg hover:text-blue-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              ব্যাচ সূচি
            </a>
            <a
              href="#leadership"
              onClick={() => setOpenDropdown(null)}
              className="px-3 py-2 rounded-lg hover:text-blue-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              নেতৃত্ব ও মেন্টর
            </a>
            <a
              href="#verify"
              onClick={() => setOpenDropdown(null)}
              className="px-3 py-2 rounded-lg hover:text-blue-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              সার্টিফিকেট যাচাই
            </a>
          </nav>

          {/* Zone 3: Student Login + Admin Portal */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#admission"
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 border border-emerald-200 bg-emerald-50/50 rounded-lg hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0"
            >
              ফ্রি ভর্তি
            </a>
            <button
              type="button"
              onClick={onOpenStudentPortal}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
            >
              স্টুডেন্ট লগইন
            </button>
            <button
              type="button"
              onClick={onOpenPortal}
              className="px-3.5 sm:px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              অ্যাডমিন প্যানেল
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="নেভিগেশন মেনু"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Organized Navigation Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                দ্রুত নেভিগেশন
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-700">
                <button
                  type="button"
                  onClick={() => scrollToSection('courses')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-left"
                >
                  <BookOpen className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>সব ফ্রি কোর্স</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('batches')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-left"
                >
                  <CalendarDays className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>ব্যাচ সূচি</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('benefits')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-left"
                >
                  <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>সুবিধা ও ভাতা</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('eligibility')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-left"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>ভর্তির যোগ্যতা</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('leadership')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-left"
                >
                  <Users className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>নেতৃত্ব ও মেন্টর</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('verify')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-left"
                >
                  <Award className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>সার্টিফিকেট যাচাই</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                ক্যাটাগরি অনুযায়ী কোর্স
              </p>
              <div className="grid grid-cols-1 gap-1">
                {(
                  [
                    { id: 'tech', label: 'কম্পিউটার ও ওয়েব' },
                    { id: 'creative', label: 'ডিজাইন ও মার্কেটিং' },
                    { id: 'career', label: 'ভাষা, হিসাব ও উদ্যোক্তা' },
                    { id: 'paid', label: 'পেড কোর্স (৭০% বৃত্তি)' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleBrowseCategory(cat.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>{cat.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  onOpenStudentPortal();
                }}
                className="w-full py-2.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/60 rounded-lg hover:bg-blue-50 transition-colors"
              >
                স্টুডেন্ট লগইন
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('admission')}
                className="w-full py-2.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
              >
                ফ্রি ভর্তি আবেদন
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section (Asymmetric 2-Column Split + Full-Width Proof Strip below) */}
      <section id="top" className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-medium text-slate-600">
                গণপ্রজাতন্ত্রী বাংলাদেশ সরকার <span aria-hidden="true">·</span> NSDA (জাতীয় দক্ষতা
                উন্নয়ন কর্তৃপক্ষ) <span aria-hidden="true">·</span> ASSET Project
              </p>

              <h1
                className="font-bold tracking-tight text-slate-900 leading-[1.15] [text-wrap:balance]"
                style={{ fontSize: 'clamp(2.05rem, 3.4vw, 3.1rem)' }}
              >
                বিনামূল্যে সরকারি স্কিল ডেভেলপমেন্ট ট্রেনিং — আপনার দক্ষতাই আপনার আগামী
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোটের আয়োজনে ও NSDA অনুমোদিত ASSET Project-এর
                আওতায় ৩ মাসের সম্পূর্ণ ফ্রি সরকারি প্রশিক্ষণ। দক্ষতা গড়ুন, নিজেকে আত্মনির্ভর
                হিসেবে গড়ে তুলুন।
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <a
                  href="#admission"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                >
                  ফ্রি ট্রেনিংয়ে আবেদন করুন
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#courses"
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  কোর্স ক্যাটাগরি দেখুন
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] lg:min-h-[400px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <ImageWithFallback
                  src={INSTITUTE_IMAGES.heroLab}
                  alt="ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট — ASSET Project সরকারি প্রশিক্ষণ ল্যাব"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Column Quantitative Proof Strip directly below Hero Split */}
          <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
                ৩ মাস
              </p>
              <p className="text-xs text-slate-600 mt-1">সম্পূর্ণ ফ্রি সরকারি ট্রেনিং (কোর্স ফি ফ্রি)</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono-tabular">
                ৳১২,০০০
              </p>
              <p className="text-xs text-slate-600 mt-1">
                ভাতা (পরীক্ষায় উত্তীর্ণ ও বরাদ্দ প্রাপ্তি সাপেক্ষে)
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
                ২৪ জন
              </p>
              <p className="text-xs text-slate-600 mt-1">
                প্রতি ট্রেডে সীমিত আসন (নারী, পুরুষ ও তৃতীয় লিঙ্গ)
              </p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular">
                NSDA সনদ
              </p>
              <p className="text-xs text-slate-600 mt-1">
                এনএসডিএ অনুমোদিত সরকারি সার্টিফিকেট
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits & Eligibility Section */}
      <section id="benefits" className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-4 scroll-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-700">ASSET Project · প্রশিক্ষণ সুযোগ-সুবিধা</p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">সুবিধা সমূহ</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <p className="text-xs font-mono-tabular text-slate-400">০১</p>
                <p className="font-semibold text-slate-900">৩ মাসের ফ্রি সরকারি ট্রেনিং</p>
                <p className="text-xs text-slate-600">
                  সবগুলো ট্রেডে কোর্স ফি সম্পূর্ণ ফ্রি — কোনো ভর্তি বা টিউশন ফি নেই।
                </p>
              </div>
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <p className="text-xs font-mono-tabular text-slate-400">০২</p>
                <p className="font-semibold text-slate-900">১২,০০০ টাকা প্রশিক্ষণ ভাতা</p>
                <p className="text-xs text-slate-600">
                  পরীক্ষায় উত্তীর্ণ ও সরকারি বরাদ্দ প্রাপ্তি সাপেক্ষে ১২,০০০ টাকা ভাতা।
                </p>
              </div>
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <p className="text-xs font-mono-tabular text-slate-400">০৩</p>
                <p className="font-semibold text-slate-900">NSDA অনুমোদিত সরকারি সার্টিফিকেট</p>
                <p className="text-xs text-slate-600">
                  জাতীয় দক্ষতা উন্নয়ন কর্তৃপক্ষ (NSDA) বাংলাদেশ অনুমোদিত সনদপত্র।
                </p>
              </div>
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <p className="text-xs font-mono-tabular text-slate-400">০৪</p>
                <p className="font-semibold text-slate-900">চাকরি ও ফ্রিল্যান্সিংয়ের সুযোগ</p>
                <p className="text-xs text-slate-600">
                  কোর্স শেষে দেশি-বিদেশি চাকরি ও অনলাইন ফ্রিল্যান্সিং ক্যারিয়ার গাইডলাইন।
                </p>
              </div>
            </div>
          </div>

          <div
            id="eligibility"
            className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6 scroll-mt-20"
          >
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-300">আবেদন শর্তাবলি ও আসন</p>
              <h2 className="text-xl sm:text-2xl font-bold text-white">ভর্তির যোগ্যতা</h2>
            </div>

            <dl className="space-y-4 text-sm divide-y divide-slate-800">
              <div className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                <dt className="text-slate-400 text-xs">শিক্ষাগত যোগ্যতা</dt>
                <dd className="text-right font-medium text-white">
                  ন্যূনতম এসএসসি / দাখিল বা সমমান পাস
                </dd>
              </div>
              <div className="pt-3 flex items-start justify-between gap-4">
                <dt className="text-slate-400 text-xs">বয়সসীমা</dt>
                <dd className="text-right font-medium font-mono-tabular text-white">
                  ১৮–৪৫ বছর
                </dd>
              </div>
              <div className="pt-3 flex items-start justify-between gap-4">
                <dt className="text-slate-400 text-xs">প্রার্থী</dt>
                <dd className="text-right font-medium text-white">
                  নারী, পুরুষ ও তৃতীয় লিঙ্গ — সকলের জন্য উন্মুক্ত
                </dd>
              </div>
              <div className="pt-3 flex items-start justify-between gap-4">
                <dt className="text-slate-400 text-xs">আসন সংখ্যা</dt>
                <dd className="text-right font-semibold text-emerald-400">
                  প্রতি ট্রেডে মাত্র ২৪ জন
                </dd>
              </div>
            </dl>

            <a
              href="#admission"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              অনলাইনে ফ্রি আবেদন করুন
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* Courses Section — Click a Category to Reveal Its Courses */}
      <section id="courses" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-8 scroll-mt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-blue-700">০১. কোর্স ক্যাটাগরি</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              কোর্স ক্যাটাগরি বেছে নিন
            </h2>
            <p className="text-sm text-slate-600">
              যেকোনো একটি ক্যাটাগরিতে ক্লিক করলে ওই ক্যাটাগরির সকল ফ্রি কোর্স, সিলেবাস ও ভর্তি
              আবেদন অপশন চলে আসবে।
            </p>
          </div>

          {courseFilter !== null && (
            <button
              type="button"
              onClick={() => setCourseFilter(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
            >
              কোর্স তালিকা বন্ধ করুন
            </button>
          )}
        </div>

        {/* 4 Clean Clickable Category Cards — Courses Stay Inside Until Clicked */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {(
            [
              {
                id: 'tech',
                num: '০১',
                title: 'কম্পিউটার ও ওয়েব',
                subtitle: 'কম্পিউটার অপারেশন, ওয়েব ডিজাইন ও ফুল-স্ট্যাক ওয়েব ডেভেলপমেন্ট',
                badgeText: 'ফ্রি কোর্স',
              },
              {
                id: 'creative',
                num: '০২',
                title: 'ডিজাইন ও মার্কেটিং',
                subtitle: 'গ্রাফিক ডিজাইন ও ডিজিটাল মার্কেটিং ফ্রিল্যান্সিং',
                badgeText: 'ফ্রি কোর্স',
              },
              {
                id: 'career',
                num: '০৩',
                title: 'ভাষা, হিসাব ও উদ্যোক্তা',
                subtitle: 'কর্মক্ষেত্রের ইংরেজি, ফ্রিল্যান্সিং অ্যাকাউন্টিং ও উদ্যোক্তা উন্নয়ন',
                badgeText: 'ফ্রি কোর্স',
              },
              {
                id: 'paid',
                num: '০৪',
                title: 'পেড কোর্স',
                subtitle: 'বেসিক কম্পিউটার — বিশেষ মেধা ও আর্থিক সহায়তা বৃত্তি (৭০% ছাড়)',
                badgeText: '৭০% বৃত্তি ছাড়',
              },
            ] as const
          ).map((cat) => {
            const catCount = allCoursesWithPaidFallback.filter((c) => c.category === cat.id).length;
            const isSelected = courseFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCourseFilter(isSelected ? null : cat.id)}
                className={`text-left bg-white rounded-xl p-5 flex flex-col justify-between space-y-5 border transition-colors ${
                  isSelected
                    ? 'border-blue-700 ring-1 ring-blue-700 bg-blue-50/20'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="space-y-2 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono-tabular text-blue-700 font-semibold">
                      ক্যাটাগরি {cat.num}
                    </span>
                    <span
                      className={`text-xs font-mono-tabular font-semibold ${
                        cat.id === 'paid' ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {catCount}টি · {cat.badgeText}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{cat.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{cat.subtitle}</p>
                </div>

                <div
                  className={`w-full py-2.5 px-4 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-900 text-white'
                  }`}
                >
                  <span>{isSelected ? 'কোর্সগুলো খোলা আছে' : 'ক্যাটাগরির কোর্স দেখুন'}</span>
                  {isSelected ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Courses Appear Only When a Category Is Clicked */}
        {courseFilter !== null && (
          <div className="space-y-6 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-900">
                নির্বাচিত ক্যাটাগরি:{' '}
                <span className="text-blue-700">
                  {courseFilter === 'tech'
                    ? 'কম্পিউটার ও ওয়েব'
                    : courseFilter === 'creative'
                      ? 'ডিজাইন ও মার্কেটিং'
                      : courseFilter === 'career'
                        ? 'ভাষা, হিসাব ও উদ্যোক্তা'
                        : 'পেড কোর্স'}
                </span>{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({visibleCourses.length}টি কোর্স)
                </span>
              </p>

              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit overflow-x-auto">
                {(
                  [
                    { id: 'tech', label: 'কম্পিউটার ও ওয়েব' },
                    { id: 'creative', label: 'ডিজাইন ও মার্কেটিং' },
                    { id: 'career', label: 'ভাষা, হিসাব ও উদ্যোক্তা' },
                    { id: 'paid', label: 'পেড কোর্স' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCourseFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      courseFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {courseFilter === 'paid' && (
              <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7 space-y-2.5">
                  <p className="text-xs font-semibold text-amber-300">
                    বিশেষ মেধা ও আর্থিক সহায়তা বৃত্তি — ৭০% ছাড়!
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    বেসিক কম্পিউটার — বিশেষ বৃত্তি উদ্যোগ
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    মেধাবী কিন্তু আর্থিক সমস্যার কারণে যারা দক্ষতা অর্জনে পিছিয়ে আছেন, তাদের জন্য
                    আমাদের বিশেষ উদ্যোগ।
                  </p>
                  <p className="text-xs text-slate-300 pt-1">
                    শর্ত: মেধা ও আর্থিক অসচ্ছলতার ভিত্তিতে সুপারিশ প্রাপ্ত শিক্ষার্থীদের জন্য
                    প্রযোজ্য। সীমিত আসন।
                  </p>
                </div>
                <dl className="lg:col-span-5 bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-400">কোর্সের মেয়াদ</dt>
                    <dd className="font-medium text-white text-right">
                      ৩ মাস (সাপ্তাহিক ২ থেকে ৩ দিন ক্লাস)
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-700">
                    <dt className="text-slate-400">নিয়মিত ফি</dt>
                    <dd className="font-mono-tabular text-slate-400 line-through">৫,০০০ টাকা</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-700">
                    <dt className="text-slate-300 font-medium">বৃত্তিতে ফি</dt>
                    <dd className="font-mono-tabular font-bold text-emerald-400 text-sm">
                      মাত্র ১,৫০০ টাকা (৩,৫০০ টাকা ছাড়)
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCourses.map((course) => {
                const isExpanded = expandedSyllabusId === course.id;
                const nextBatch = state.batches.find(
                  (b) => b.courseId === course.id && b.status !== 'সম্পন্ন'
                );
                const isScholarshipPaid = course.category === 'paid' && course.fee === 5000;
                return (
                  <article
                    key={course.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                        <ImageWithFallback
                          src={course.imageUrl}
                          alt={course.title}
                          fallbackTitle={course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{course.categoryLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{course.durationWeeks} সপ্তাহ</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{course.totalClasses} ক্লাস</span>
                        </div>

                        <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                          {course.title}
                        </h3>

                        <p className="text-sm text-slate-600 leading-relaxed">{course.summary}</p>

                        {nextBatch && (
                          <p className="text-xs text-slate-500 pt-1">
                            পরবর্তী ব্যাচ:{' '}
                            <span className="font-mono-tabular font-medium text-slate-800">
                              {nextBatch.code} ({nextBatch.startDate})
                            </span>
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedSyllabusId(isExpanded ? null : course.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 pt-1"
                        >
                          {isExpanded ? 'সিলেবাস লুকান' : 'কারিকুলাম দেখুন'}
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isExpanded && (
                          <ul className="pt-2 space-y-1.5 text-xs text-slate-600 border-t border-slate-100">
                            {course.syllabus.map((mod, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="font-mono-tabular text-slate-400">0{idx + 1}.</span>
                                <span>{mod}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-500">
                          {isScholarshipPaid ? 'বৃত্তিতে কোর্স ফি (৭০% ছাড়)' : 'কোর্স ফি'}
                        </p>
                        {isScholarshipPaid ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-emerald-700 font-mono-tabular">
                              ৳১,৫০০
                            </span>
                            <span className="text-xs text-slate-400 line-through font-mono-tabular">
                              ৳৫,০০০
                            </span>
                          </div>
                        ) : (
                          <p className="text-base font-bold text-emerald-700">
                            {course.fee === 0 ? 'সম্পূর্ণ ফ্রি কোর্স' : formatBDT(course.fee)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectCourseForAdmission(course.id)}
                        className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        {course.fee === 0 ? 'ফ্রি ভর্তি আবেদন' : 'ভর্তি আবেদন'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Live Batch Schedule */}
      <section id="batches" className="bg-white border-t border-b border-slate-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-blue-700">০২. লাইভ ব্যাচ সময়সূচি</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
              ভর্তি চলমান ও আসন্ন ব্যাচের সময়সূচি
            </h2>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3.5 px-4 whitespace-nowrap">ব্যাচ</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">কোর্সের নাম</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">মেন্টর</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">ক্লাসের দিন ও সময়</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">শুরুর তারিখ</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">খালি আসন</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">আবেদন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {openBatches.map((batch) => {
                    const course = state.courses.find((c) => c.id === batch.courseId);
                    const instructor = state.instructors.find((i) => i.id === batch.instructorId);
                    const enrolled =
                      typeof batch.enrolledCount === 'number'
                        ? batch.enrolledCount
                        : state.students.filter((s) => s.batchId === batch.id).length;
                    const remaining = Math.max(0, batch.capacity - enrolled);

                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono-tabular text-xs font-semibold text-blue-700 whitespace-nowrap">
                          {batch.code}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          {course?.title || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {instructor?.name || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700">
                          {batch.schedule} · {batch.room}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                          {batch.startDate}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {remaining}টি আসন
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleSelectCourseForAdmission(batch.courseId)}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
                          >
                            আসন বুক করুন
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Mentorship & Campus Showcase */}
      <section id="leadership" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-5">
            <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <ImageWithFallback
                src={INSTITUTE_IMAGES.mentorship}
                alt="মেন্টর ও শিক্ষার্থীদের সরাসরি প্রজেক্ট রিভিউ সেশন"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-blue-700">০৩. মেন্টর ও ল্যাব পরিবেশ</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                দেশের শীর্ষ সফটওয়্যার ও ডিজাইন টিমের অভিজ্ঞ মেন্টরবৃন্দ
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                প্রতিটি ব্যাচে সীমিত আসন থাকায় মেন্টররা সরাসরি কোড রিভিউ, পোর্টফোলিও গাইডেন্স
                এবং মক ইন্টারভিউয়ের মাধ্যমে শিক্ষার্থীদের প্রস্তুত করেন।
              </p>
            </div>

            {/* Leadership Team Cards (Co-Founder & Chairman + Director) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-20 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <img
                    src="/assets/aistudio/FB_IMG_1795440984722_0b860f21.jpg"
                    alt="Omar Faruk — Co-Founder & Chairman, Dream-71 IT Service Nangalkot"
                    className="w-full h-full object-cover object-[50%_28%] scale-125"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-medium text-blue-700">Co-Founder & Chairman</p>
                  <h3 className="text-base font-bold text-slate-900">Omar Faruk</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট — দক্ষতা উন্নয়ন ও আত্মনির্ভরশীল কর্মসংস্থান গড়ার
                    অন্যতম উদ্যোক্তা।
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-20 h-24 rounded-lg overflow-hidden border border-slate-200 bg-sky-500 shrink-0">
                  <img
                    src="/assets/aistudio/WhatsApp_Image_2024-04-23_at_12.56.15_0aba4665-removebg-preview__1__211055d9.png"
                    alt="Osman Ghani — Director, Dream-71 IT Service Nangalkot"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-medium text-blue-700">Co-Founder & Director</p>
                  <h3 className="text-base font-bold text-slate-900">Osman Ghani</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট — সরকারি স্কিল ট্রেনিং ও ফ্রিল্যান্সিং
                    কার্যক্রম পরিচালনা।
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {state.instructors.map((ins) => (
                <div
                  key={ins.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 space-y-1"
                >
                  <p className="text-sm font-semibold text-slate-900">{ins.name}</p>
                  <p className="text-xs text-slate-500">
                    {ins.designation} · {ins.experienceYears} বছরের অভিজ্ঞতা
                  </p>
                  <p className="text-xs text-blue-700 font-medium pt-1">{ins.specialty}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Digital Institute Management Showcase */}
      <section id="digital-system" className="bg-slate-50 border-t border-slate-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-medium text-blue-700">
                সম্পূর্ণ ডিজিটাল ক্যাম্পাস ব্যবস্থাপনা
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                ব্যাচের হিসাব, শিক্ষার্থীদের হাজিরা, পরীক্ষা ও রেজাল্ট—আর নয় আলাদা আলাদা খাতা, এবারে হবে ডিজিটাল
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={onOpenStudentPortal}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
              >
                স্টুডেন্ট পোর্টাল লগইন
              </button>
              <button
                type="button"
                onClick={onOpenPortal}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                ডিজিটাল অ্যাডমিন প্যানেল
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                num: '০১',
                title: 'শিক্ষার্থী ভর্তি ও তথ্য ব্যবস্থাপনা',
                desc: 'প্রতিটি শিক্ষার্থীর প্রোফাইল, অভিভাবকের যোগাযোগ নম্বর, কোর্স তথ্য এবং ডিজিটাল QR আইডি কার্ড সংরক্ষণ।',
              },
              {
                num: '০২',
                title: 'ক্লাস ও ব্যাচ ব্যবস্থাপনা',
                desc: 'ট্রেডভিত্তিক ব্যাচ, ল্যাব রুম, ক্লাস রুটিন, মেন্টর নির্ধারণ এবং প্রতি ট্রেডে আসন সংখ্যা নিয়ন্ত্রণ।',
              },
              {
                num: '০৩',
                title: 'ডিজিটাল হাজিরা (QR Scan)',
                desc: 'ক্যামেরা বা QR স্ক্যানারের মাধ্যমে দ্রুত চেক-ইন, অনুপস্থিতি শনাক্তকরণ এবং উপস্থিতির শতকরা হিসাব।',
              },
              {
                num: '০৪',
                title: 'মাসিক বেতন ও বকেয়ার হিসাব',
                desc: 'পেড কোর্স ও বৃত্তির ফি, মাসিক আদায়, বকেয়া তালিকা, প্রিন্টযোগ্য রসিদ ও CSV রিপোর্ট।',
              },
              {
                num: '০৫',
                title: 'পরীক্ষা, রেজাল্ট ও পারফরম্যান্স রিপোর্ট',
                desc: 'ব্যাচভিত্তিক পরীক্ষা, নম্বর এন্ট্রি, স্বয়ংক্রিয় গ্রেড (A+ থেকে F) ও প্রিন্টযোগ্য প্রোগ্রেস রিপোর্ট কার্ড।',
              },
              {
                num: '০৬',
                title: 'অভিভাবকদের SMS নোটিফিকেশন',
                desc: 'অনুপস্থিতি অ্যালার্ট, বকেয়া রিমাইন্ডার এবং পরীক্ষার রেজাল্ট সরাসরি অভিভাবকের মোবাইলে SMS ও লগ সংরক্ষণ।',
              },
            ].map((item) => (
              <div
                key={item.num}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono-tabular font-semibold text-blue-700">{item.num}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Certificate Verification + Online Admission Split */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Certificate Verification */}
          <div id="verify" className="lg:col-span-5 space-y-5 scroll-mt-20">
            <div className="space-y-2">
              <p className="text-xs font-medium text-blue-700">০৪. অফিশিয়াল ভেরিফিকেশন</p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                সার্টিফিকেট যাচাই করুন
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                নিয়োগদাতা বা শিক্ষার্থী হিসেবে সার্টিফিকেট আইডি লিখে তাৎক্ষণিক সত্যতা যাচাই
                করুন।
              </p>
            </div>

            <form onSubmit={(e) => handleVerifyCertificate(e)} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={certQuery}
                  onChange={(e) => setCertQuery(e.target.value)}
                  placeholder="যেমন: D71-2026-1042"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
                />
              </div>
              <button
                type="submit"
                disabled={certLoading}
                className="px-4 py-2.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                {certLoading ? 'খুঁজছে...' : 'যাচাই করুন'}
              </button>
            </form>

            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span>নমুনা আইডি:</span>
              {(state.certificates.length > 0
                ? state.certificates.slice(0, 2).map((c) => c.certificateId)
                : ['D71-2026-1042', 'D71-2026-1039']
              ).map((certId) => (
                <button
                  key={certId}
                  type="button"
                  onClick={(e) => handleVerifyCertificate(e, certId)}
                  className="font-mono-tabular text-blue-700 hover:underline"
                >
                  {certId}
                </button>
              ))}
            </div>

            {certSearched && (
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/70">
                {certResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                      <Award className="w-4 h-4" />
                      যাচাইকৃত অফিশিয়াল সার্টিফিকেট
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900">{certResult.studentName}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{certResult.courseTitle}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-400 block">ব্যাচ</span>
                        <span className="font-mono-tabular font-medium text-slate-900">
                          {certResult.batchCode}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">গ্রেড</span>
                        <span className="font-mono-tabular font-medium text-slate-900">
                          {certResult.grade}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">ইস্যুর তারিখ</span>
                        <span className="font-mono-tabular font-medium text-slate-900">
                          {certResult.issueDate}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-rose-700 font-medium">
                    দুঃখিত, এই আইডির কোনো সার্টিফিকেট রেকর্ড খুঁজে পাওয়া যায়নি।
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Admission Inquiry Form */}
          <div
            id="admission"
            className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8 scroll-mt-20"
          >
            <div className="space-y-1.5 mb-6">
              <p className="text-xs font-medium text-blue-700">
                ০৫. ASSET Project, NSDA ও বৃত্তি অনলাইন ভর্তি
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                ভর্তি আবেদন ফর্ম (ফ্রি ও পেড কোর্স)
              </h2>
              <p className="text-sm text-slate-600">
                ফ্রি সরকারি ট্রেনিং (নারী, পুরুষ ও তৃতীয় লিঙ্গ · ন্যূনতম এসএসসি/দাখিল · বয়স ১৮–৪৫ ·
                ২৪ আসন) অথবা ৭০% মেধা ও আর্থিক সহায়তা বৃত্তি সহ পেড কোর্সে ভর্তির জন্য আবেদন করুন।
              </p>
            </div>

            {submittedRef ? (
              <div className="bg-white border border-emerald-200 rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  আপনার ভর্তি আবেদন সফলভাবে গৃহীত হয়েছে!
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  রেফারেন্স নম্বর:{' '}
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {submittedRef}
                  </span>
                  । আপনার আবেদনটি সরাসরি ম্যানেজমেন্ট প্যানেলের ভর্তি কিউতে যুক্ত হয়েছে।
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubmittedRef(null)}
                    className="px-4 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50"
                  >
                    আরেকটি আবেদন করুন
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPortal}
                    className="px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                  >
                    ম্যানেজমেন্ট প্যানেলে দেখুন
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitAdmission} className="space-y-4">
                {formError && (
                  <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      আপনার পূর্ণ নাম *
                    </label>
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="যেমন: মাহফুজুর রহমান"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      মোবাইল নম্বর *
                    </label>
                    <input
                      type="tel"
                      value={appPhone}
                      onChange={(e) => setAppPhone(e.target.value)}
                      placeholder="01712345678"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg font-mono-tabular focus:outline-none focus:border-blue-700"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">ইমেইল</label>
                    <input
                      type="email"
                      value={appEmail}
                      onChange={(e) => setAppEmail(e.target.value)}
                      placeholder="name@email.com"
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      পছন্দের সময়সূচি
                    </label>
                    <select
                      value={appSlot}
                      onChange={(e) => setAppSlot(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    >
                      <option value="সকাল ১০:০০ (শুক্র ও শনি)">সকাল ১০:০০ (শুক্র ও শনি)</option>
                      <option value="সকাল ১১:০০ (সপ্তাহে ২–৩ দিন)">সকাল ১১:০০ (সপ্তাহে ২–৩ দিন)</option>
                      <option value="বিকাল ৪:৩০ (সাপ্তাহিক)">বিকাল ৪:৩০ (সাপ্তাহিক)</option>
                      <option value="সন্ধ্যা ৭:০০ (সাপ্তাহিক)">সন্ধ্যা ৭:০০ (সাপ্তাহিক)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    কোর্স নির্বাচন করুন *
                  </label>
                  <select
                    value={appCourseId}
                    onChange={(e) => setAppCourseId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                    required
                  >
                    {allCoursesWithPaidFallback.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} —{' '}
                        {c.fee === 0
                          ? 'সম্পূর্ণ ফ্রি'
                          : c.category === 'paid' && c.fee === 5000
                            ? 'নিয়মিত ৳৫,০০০ · বৃত্তিতে ৳১,৫০০ (৭০% ছাড়)'
                            : formatBDT(c.fee)}{' '}
                        ({c.durationWeeks} সপ্তাহ)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    অতিরিক্ত জিজ্ঞাসা (ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={2}
                    value={appMessage}
                    onChange={(e) => setAppMessage(e.target.value)}
                    placeholder="শিক্ষাগত যোগ্যতা, পছন্দের ট্রেড বা ব্যাচের সময়সূচি বিষয়ে কিছু জানাতে চাইলে লিখুন..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-sm font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'আবেদন জমা হচ্ছে...' : 'আবেদন জমা দিন'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="bg-white p-1.5 rounded-lg shrink-0">
              <img
                src="/assets/aistudio/dream71_it_logo__2__e39bbd51.png"
                alt="Dream 71 IT Service Nangalkot লোগো"
                className="w-12 h-12 object-contain"
              />
            </div>
            <div>
              <p className="text-base font-bold text-white">ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট</p>
              <p className="text-xs text-slate-400 mt-1">
                আয়োজক: ড্রিম-৭১ আইটি সার্ভিস, নাঙ্গলকোট, কুমিল্লা · Co-Founder & Chairman: Omar Faruk
                · Co-Founder & Director: Osman Ghani · ASSET Project · NSDA বাংলাদেশ
              </p>
              <p className="text-xs text-blue-300 mt-1.5">
                দক্ষতা অর্জন করুন, স্বপ্ন পূরণ করুন — স্মার্ট বাংলাদেশ গড়ার লক্ষ্যে দক্ষ জনশক্তি
                তৈরিতে আপনার পাশে
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <a href="#courses" className="hover:text-white transition-colors">
              কোর্সসমূহ
            </a>
            <a href="#batches" className="hover:text-white transition-colors">
              ব্যাচ সূচি
            </a>
            <a href="#verify" className="hover:text-white transition-colors">
              সার্টিফিকেট যাচাই
            </a>
            <button
              type="button"
              onClick={onOpenStudentPortal}
              className="text-blue-300 hover:text-white transition-colors"
            >
              স্টুডেন্ট লগইন
            </button>
            <button
              type="button"
              onClick={onOpenPortal}
              className="text-slate-200 hover:text-white transition-colors"
            >
              অ্যাডমিন প্যানেল
            </button>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>© ২০২৬ ড্রিম-৭১ আইটি সার্ভিস নাঙ্গলকোট। সর্বস্বত্ব সংরক্ষিত।</span>
            <span>গণপ্রজাতন্ত্রী বাংলাদেশ সরকার · NSDA অনুমোদিত ASSET Project প্রশিক্ষণ</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
