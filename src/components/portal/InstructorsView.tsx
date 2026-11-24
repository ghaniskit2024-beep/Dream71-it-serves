import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { InstituteState, Instructor } from '../../types/institute';
import { generateId } from '../../utils/storage';

interface InstructorsViewProps {
  state: InstituteState;
  onAddInstructor: (instructor: Instructor) => void;
  onUpdateInstructor: (instructor: Instructor) => void;
  onDeleteInstructor: (id: string) => void;
}

export function InstructorsView({
  state,
  onAddInstructor,
  onUpdateInstructor,
  onDeleteInstructor,
}: InstructorsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [experienceYears, setExperienceYears] = useState(5);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [active, setActive] = useState(true);

  const openModal = (ins?: Instructor) => {
    if (ins) {
      setEditing(ins);
      setName(ins.name);
      setDesignation(ins.designation);
      setSpecialty(ins.specialty);
      setExperienceYears(ins.experienceYears);
      setPhone(ins.phone);
      setEmail(ins.email);
      setActive(ins.active);
    } else {
      setEditing(null);
      setName('');
      setDesignation('');
      setSpecialty('');
      setExperienceYears(5);
      setPhone('');
      setEmail('');
      setActive(true);
    }
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !specialty.trim()) return;

    const payload: Instructor = {
      id: editing ? editing.id : generateId('ins'),
      name: name.trim(),
      designation: designation.trim() || 'ইন্ডাস্ট্রি মেন্টর',
      specialty: specialty.trim(),
      experienceYears: Math.max(1, Number(experienceYears) || 1),
      phone: phone.trim(),
      email: email.trim(),
      active,
    };

    if (editing) {
      onUpdateInstructor(payload);
    } else {
      onAddInstructor(payload);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">মেন্টর ও প্রশিক্ষক প্যানেল</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ব্যাচ পরিচালনাকারী প্রশিক্ষকদের প্রোফাইল ও দায়িত্বপ্রাপ্ত ব্যাচ সংখ্যা
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          নতুন মেন্টর যোগ করুন
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.instructors.map((ins) => {
          const assignedBatches = state.batches.filter((b) => b.instructorId === ins.id);
          return (
            <div
              key={ins.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500">
                    {ins.designation} · {ins.experienceYears} বছরের অভিজ্ঞতা
                  </p>
                  <h3 className="text-base font-semibold text-slate-900 mt-1">{ins.name}</h3>
                  <p className="text-xs text-blue-700 font-medium mt-1">{ins.specialty}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openModal(ins)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                    title="সম্পাদনা"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteInstructor(ins.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span className="font-mono-tabular">
                  {ins.phone} · {ins.email}
                </span>
                <span className="font-mono-tabular font-medium text-slate-900">
                  দায়িত্বপ্রাপ্ত ব্যাচ: {assignedBatches.length}টি
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'মেন্টর তথ্য সম্পাদনা' : 'নতুন মেন্টর যোগ'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">পূর্ণ নাম *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">পদবি</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="সিনিয়র মেন্টর"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    অভিজ্ঞতা (বছর)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  দক্ষতার ক্ষেত্র *
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="React, TypeScript, Cloud"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ফোন</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ইমেইল</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
