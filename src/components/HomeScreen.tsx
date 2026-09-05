import React, { useEffect, useState } from 'react';
import { UserProfile, ReelProject, ExportedVideo, Announcement } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { 
  Sparkles, 
  Gem, 
  Video, 
  Zap, 
  Clock, 
  PlusCircle, 
  Play, 
  FolderHeart, 
  CheckCircle2, 
  Layers, 
  BellRing,
  Download,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { SURAHS } from '../data/quranData';
import { RECITERS } from '../data/reciters';

interface HomeScreenProps {
  user: UserProfile;
  onCreateReel: () => void;
  onOpenProjects: () => void;
  onOpenSubscriptions: () => void;
  onSelectProject?: (proj: ReelProject) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  onCreateReel,
  onOpenProjects,
  onOpenSubscriptions,
  onSelectProject
}) => {
  const [projects, setProjects] = useState<ReelProject[]>([]);
  const [videos, setVideos] = useState<ExportedVideo[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<ExportedVideo | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Load recent projects
        const projQuery = query(
          collection(db, 'projects'),
          where('userId', '==', user.uid),
          orderBy('updatedAt', 'desc'),
          limit(4)
        );
        const projSnap = await getDocs(projQuery);
        const projs = projSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReelProject));
        setProjects(projs);

        // Load recent videos
        const vidQuery = query(
          collection(db, 'videos'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(4)
        );
        const vidSnap = await getDocs(vidQuery);
        const vids = vidSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExportedVideo));
        setVideos(vids);

        // Load active announcements
        const annQuery = query(
          collection(db, 'announcements'),
          where('isActive', '==', true),
          limit(2)
        );
        const annSnap = await getDocs(annQuery);
        const anns = annSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
        setAnnouncements(anns);
      } catch (err) {
        console.warn('Non-blocking load error on Home:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user.uid]);

  const videosRemaining = Math.max(0, (user.dailyLimit || 3) - (user.dailyVideosUsed || 0));

  const planTitles: Record<string, { label: string; color: string }> = {
    free: { label: 'مجاني (Free)', color: 'bg-stone-800 text-stone-300 border-stone-700' },
    weekly: { label: 'أسبوعي (Weekly)', color: 'bg-blue-900/60 text-blue-300 border-blue-600/40' },
    monthly: { label: 'شهري (Monthly)', color: 'bg-emerald-900/60 text-emerald-300 border-emerald-600/40' },
    yearly: { label: 'سنوي (Yearly)', color: 'bg-amber-900/60 text-amber-300 border-amber-600/40' },
  };

  const planInfo = planTitles[user.subscriptionType] || planTitles.free;

  return (
    <div className="space-y-6 pb-24">
      {/* Top User Header */}
      <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
            alt={user.name}
            className="w-12 h-12 rounded-2xl border-2 border-amber-500/40 shadow-md object-cover bg-stone-950"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-stone-50">{user.name}</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${planInfo.color}`}>
                {planInfo.label}
              </span>
            </div>
            <p className="text-xs text-stone-400 font-mono mt-0.5" dir="ltr">
              {user.email}
            </p>
          </div>
        </div>

        {/* Gems Button / Balance */}
        <button
          onClick={onOpenSubscriptions}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600/20 to-amber-500/10 border border-amber-500/30 hover:border-amber-500/60 transition group cursor-pointer shadow-sm"
        >
          <Gem className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <div className="text-right">
            <span className="text-xs text-stone-400 block leading-tight">رصيد الجواهر</span>
            <span className="text-sm font-bold text-amber-400 leading-tight">
              {user.gems.toLocaleString()} جوهرة
            </span>
          </div>
        </button>
      </div>

      {/* Announcements Banner */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((ann) => (
            <div key={ann.id} className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 flex items-start gap-3 text-xs sm:text-sm">
              <BellRing className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-amber-300 mb-0.5">{ann.title}</strong>
                <p className="text-stone-300 leading-relaxed">{ann.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-3 text-center flex flex-col justify-center">
          <span className="text-[11px] text-stone-400 mb-1">فيديوهات اليوم</span>
          <div className="flex items-center justify-center gap-1.5">
            <Video className="w-4 h-4 text-amber-400" />
            <span className="text-lg font-bold text-stone-100">{user.dailyVideosUsed}</span>
            <span className="text-xs text-stone-500">/ {user.dailyLimit}</span>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-3 text-center flex flex-col justify-center">
          <span className="text-[11px] text-stone-400 mb-1">المتبقي اليوم</span>
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-lg font-bold text-emerald-400">{videosRemaining}</span>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-3 text-center flex flex-col justify-center">
          <span className="text-[11px] text-stone-400 mb-1">أقصى سرعة إطارات</span>
          <div className="flex items-center justify-center gap-1.5">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-lg font-bold text-stone-100">{user.maxFPS} FPS</span>
          </div>
        </div>

        <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-3 text-center flex flex-col justify-center">
          <span className="text-[11px] text-stone-400 mb-1">العلامة المائية</span>
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className={`w-4 h-4 ${user.subscriptionType === 'free' ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="text-xs font-bold text-stone-200">
              {user.subscriptionType === 'free' ? 'مفعلة (GM)' : 'بدون علامة'}
            </span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-stone-900/60 border border-stone-800 rounded-xl p-3 text-center flex flex-col justify-center">
          <span className="text-[11px] text-stone-400 mb-1">انتهاء الاشتراك</span>
          <div className="flex items-center justify-center gap-1.5 text-xs text-stone-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>
              {user.subscriptionType === 'free' 
                ? 'دائم' 
                : user.subscriptionEnd ? new Date(user.subscriptionEnd).toLocaleDateString('ar-EG') : 'غير محدد'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Big Call To Action Button */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 via-emerald-600 to-amber-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300" />
        <button
          onClick={onCreateReel}
          className="relative w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 text-stone-950 font-black text-lg sm:text-xl shadow-2xl flex items-center justify-center gap-3 transition transform group-hover:scale-[1.01] cursor-pointer"
        >
          <PlusCircle className="w-7 h-7 stroke-[2.5]" />
          <span>+ إنشاء ريل قرآني احترافي</span>
        </button>
      </div>

      {/* Recent Projects Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
            <FolderHeart className="w-4 h-4 text-amber-400" />
            <span>آخر المشاريع</span>
          </h3>
          <button
            onClick={onOpenProjects}
            className="text-xs text-amber-400 hover:text-amber-300 transition flex items-center gap-1 cursor-pointer"
          >
            <span>عرض الكل</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="p-6 rounded-2xl bg-stone-900/40 border border-stone-800/80 text-center text-stone-400 text-xs">
            لا توجد مشاريع سابقة حالياً. اضغط على الزر أعلاه للبدء في إنشاء أول ريل قرآني!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => {
              const surah = SURAHS.find(s => s.number === p.surah);
              const reciter = RECITERS.find(r => r.id === p.reciterId);
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProject && onSelectProject(p)}
                  className="p-3.5 rounded-xl bg-stone-900/70 border border-stone-800 hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <h4 className="font-bold text-sm text-stone-100 group-hover:text-amber-400 transition">
                      {p.title || `سورة ${surah?.name || p.surah}`}
                    </h4>
                    <p className="text-xs text-stone-400 mt-0.5">
                      القارئ: {reciter?.arabicName || p.reciterId}
                    </p>
                  </div>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {new Date(p.updatedAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Videos Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2">
            <Video className="w-4 h-4 text-emerald-400" />
            <span>آخر الفيديوهات المصدرة</span>
          </h3>
        </div>

        {videos.length === 0 ? (
          <div className="p-6 rounded-2xl bg-stone-900/40 border border-stone-800/80 text-center text-stone-400 text-xs">
            لم يتم تصدير فيديوهات حتى الآن. أنشئ فيديو جديد ليتم حفظه هنا.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {videos.map((vid) => {
              const surah = SURAHS.find(s => s.number === vid.surah);
              return (
                <div
                  key={vid.id}
                  className="bg-stone-900/80 border border-stone-800 rounded-xl p-3 space-y-2 hover:border-emerald-500/40 transition flex flex-col justify-between"
                >
                  <div className="aspect-[9/16] max-h-48 bg-stone-950 rounded-lg overflow-hidden relative flex items-center justify-center border border-stone-800">
                    <div className="text-center p-2">
                      <span className="text-xs font-bold text-amber-400 block">سورة {surah?.name || vid.surah}</span>
                      <span className="text-[10px] text-stone-400 block mt-1">{vid.reciterName || vid.reciter}</span>
                    </div>
                    <button
                      onClick={() => setPlayingVideo(vid)}
                      className="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center transition group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500/90 text-stone-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-800/80">
                    <span className="text-stone-400">{vid.fps} FPS</span>
                    <a
                      href={vid.videoUrl}
                      download={`quran_reel_${vid.surah}.webm`}
                      className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تحميل
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Video Modal Player */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-stone-900 border border-stone-700 rounded-2xl overflow-hidden shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-stone-100">
                سورة {SURAHS.find(s => s.number === playingVideo.surah)?.name || playingVideo.surah}
              </h4>
              <button
                onClick={() => setPlayingVideo(null)}
                className="text-xs text-stone-400 hover:text-stone-200 px-2 py-1 rounded-lg bg-stone-800 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
              <video
                src={playingVideo.videoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
