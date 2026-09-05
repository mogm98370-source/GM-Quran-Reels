import React, { useState, useEffect } from 'react';
import { UserProfile, ReelProject } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { SURAHS } from '../data/quranData';
import { RECITERS } from '../data/reciters';
import { BACKGROUNDS } from '../data/backgrounds';
import { 
  FolderHeart, 
  Trash2, 
  Copy, 
  Play, 
  Edit3, 
  Calendar, 
  Zap, 
  PlusCircle, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';

interface ProjectsScreenProps {
  user: UserProfile;
  onOpenProject: (project: ReelProject) => void;
  onCreateNew: () => void;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({
  user,
  onOpenProject,
  onCreateNew
}) => {
  const [projects, setProjects] = useState<ReelProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'projects'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc')
      );
      const snap = await getDocs(q);
      const projs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReelProject));
      setProjects(projs);
    } catch (err) {
      console.warn('Load projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user.uid]);

  const handleDelete = async (projId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا المشروع؟')) return;
    setDeletingId(projId);
    try {
      await deleteDoc(doc(db, 'projects', projId));
      setProjects(prev => prev.filter(p => p.id !== projId));
    } catch (err) {
      console.error('Delete project failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (proj: ReelProject) => {
    try {
      const newProj = {
        ...proj,
        title: `${proj.title} (نسخة)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      delete (newProj as any).id;
      const ref = await addDoc(collection(db, 'projects'), newProj);
      setProjects(prev => [{ id: ref.id, ...newProj }, ...prev]);
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
          <FolderHeart className="w-5 h-5 text-amber-400" />
          <span>مشاريع الريلز المحفوظة ({projects.length})</span>
        </h3>

        <button
          onClick={onCreateNew}
          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <PlusCircle className="w-4 h-4" />
          <span>مشروع جديد</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-400 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span className="text-xs">جاري تحميل المشاريع من Firebase...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="p-10 rounded-2xl bg-stone-900/60 border border-stone-800 text-center space-y-3">
          <FolderHeart className="w-10 h-10 text-stone-600 mx-auto" />
          <p className="text-sm text-stone-300 font-bold">لا توجد مشاريع محفوظة حالياً</p>
          <p className="text-xs text-stone-500">
            يمكنك حفظ مسودات الريلز القرآنية والتعديل عليها وتصديرها في أي وقت.
          </p>
          <button
            onClick={onCreateNew}
            className="mt-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl cursor-pointer"
          >
            إنشاء أول ريل الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const surah = SURAHS.find(s => s.number === proj.surah);
            const reciter = RECITERS.find(r => r.id === proj.reciterId);
            const bg = BACKGROUNDS.find(b => b.id === proj.backgroundId);

            return (
              <div
                key={proj.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-800 text-amber-400">
                      سورة {surah?.name || proj.surah}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      {new Date(proj.updatedAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-stone-100 group-hover:text-amber-400 transition">
                    {proj.title}
                  </h4>
                  <p className="text-xs text-stone-400 mt-1">
                    القارئ: {reciter?.arabicName || proj.reciterId}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    الخلفية: {bg?.name || 'افتراضية'}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-1">
                  <button
                    onClick={() => onOpenProject(proj)}
                    className="flex-1 py-1.5 px-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل وتصدير</span>
                  </button>

                  <button
                    onClick={() => handleDuplicate(proj)}
                    title="تكرار المشروع"
                    className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(proj.id)}
                    disabled={deletingId === proj.id}
                    title="حذف المشروع"
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/60 rounded-lg transition cursor-pointer"
                  >
                    {deletingId === proj.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
