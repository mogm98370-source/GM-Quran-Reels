import React, { useState, useEffect, useRef } from 'react';
import { 
  Surah, 
  Reciter, 
  BackgroundItem, 
  TextSettings, 
  UserProfile, 
  VerseTiming, 
  ReelProject 
} from '../types';
import { SURAHS } from '../data/quranData';
import { RECITERS, getSurahAudioUrl, getSurahAudioFallbackUrl } from '../data/reciters';
import { BACKGROUNDS } from '../data/backgrounds';
import { getSurahVersesWithTiming } from '../lib/quranService';
import { renderQuranReel, RenderProgressUpdate } from '../lib/videoRenderer';
import { db, logAppError } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { 
  Search, 
  Play, 
  Pause, 
  Volume2, 
  Check, 
  Sparkles, 
  Layers, 
  Type, 
  Eye, 
  Video, 
  Download, 
  RotateCcw, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Sliders, 
  SlidersHorizontal,
  Lock, 
  ShieldCheck,
  Loader2,
  FileVideo
} from 'lucide-react';

interface CreateReelWizardProps {
  user: UserProfile;
  initialProject?: ReelProject | null;
  onFinished: () => void;
  onRefreshUser: () => Promise<void>;
  onOpenSubscriptions: () => void;
}

export const CreateReelWizard: React.FC<CreateReelWizardProps> = ({
  user,
  initialProject,
  onFinished,
  onRefreshUser,
  onOpenSubscriptions
}) => {
  // Wizard steps: 1: Surah, 2: Reciter, 3: Background, 4: Styling, 5: Preview & Render
  const [step, setStep] = useState<number>(1);

  // Selections
  const [selectedSurah, setSelectedSurah] = useState<Surah>(
    SURAHS.find(s => s.number === (initialProject?.surah || 1)) || SURAHS[0]
  );
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(
    RECITERS.find(r => r.id === (initialProject?.reciterId || 'alafasy')) || RECITERS[9]
  );
  const [selectedBackground, setSelectedBackground] = useState<BackgroundItem>(
    BACKGROUNDS.find(b => b.id === (initialProject?.backgroundId || 'kaaba_night')) || BACKGROUNDS[0]
  );

  // Text and visual settings
  const [settings, setSettings] = useState<TextSettings>(initialProject?.settings || {
    font: 'Amiri Quran',
    fontSize: 40,
    textColor: '#ffffff',
    textShadow: true,
    shadowColor: 'rgba(0, 0, 0, 0.95)',
    shadowBlur: 14,
    stroke: true,
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'center',
    alignment: 'center',
    showAyahNumber: true,
    showSurahHeader: true,
    animation: 'fade',
    overlayOpacity: 0.45,
    blurBackground: 0
  });

  // Filters & Search
  const [surahSearch, setSurahSearch] = useState('');
  const [reciterSearch, setReciterSearch] = useState('');
  const [bgCategory, setBgCategory] = useState<string>('all');

  // Real Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0.85);
  const [audioError, setAudioError] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  // Verses & Timings
  const [verses, setVerses] = useState<VerseTiming[]>([]);
  const [versesLoading, setVersesLoading] = useState(false);

  // Render & Export states
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgressUpdate | null>(null);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [directAudioUrl, setDirectAudioUrl] = useState<string | null>(null);

  // Canvas preview ref
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load verses and timings whenever surah or reciter changes
  useEffect(() => {
    let active = true;
    async function fetchTimings() {
      setVersesLoading(true);
      try {
        const data = await getSurahVersesWithTiming(selectedSurah.number, selectedReciter, audioDuration);
        if (active) {
          setVerses(data.verses);
          if (data.matchedAudioUrl) {
            setDirectAudioUrl(data.matchedAudioUrl);
          }
        }
      } catch (err) {
        console.warn('Error fetching timings:', err);
      } finally {
        if (active) setVersesLoading(false);
      }
    }
    fetchTimings();
    return () => { active = false; };
  }, [selectedSurah.number, selectedReciter.id, audioDuration]);

  // Handle real audio playback setup
  const defaultAudioUrl = getSurahAudioUrl(selectedReciter, selectedSurah.number);
  const audioUrl = directAudioUrl || defaultAudioUrl;
  const fallbackAudioUrl = getSurahAudioFallbackUrl(selectedReciter, selectedSurah.number);

  // Reset directAudioUrl when surah or reciter changes
  useEffect(() => {
    setDirectAudioUrl(null);
  }, [selectedSurah.number, selectedReciter.id]);

  useEffect(() => {
    setAudioError(false);
    setAudioLoading(true);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [audioUrl]);

  // Draw real-time Canvas preview in step 5
  useEffect(() => {
    if (step !== 5) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = selectedBackground.url;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Draw background
      if (img.complete && img.naturalWidth > 0) {
        const bgRatio = img.width / img.height;
        const targetRatio = width / height;
        let drawW = width;
        let drawH = height;
        let offX = 0;
        let offY = 0;

        if (bgRatio > targetRatio) {
          drawW = height * bgRatio;
          offX = -(drawW - width) / 2;
        } else {
          drawH = width / bgRatio;
          offY = -(drawH - height) / 2;
        }

        ctx.save();
        if (settings.blurBackground > 0) {
          ctx.filter = `blur(${settings.blurBackground}px)`;
        }
        ctx.drawImage(img, offX, offY, drawW, drawH);
        ctx.restore();
      } else {
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, width, height);
      }

      // Dark overlay
      ctx.fillStyle = `rgba(0, 0, 0, ${settings.overlayOpacity || 0.45})`;
      ctx.fillRect(0, 0, width, height);

      // Header: Surah & Reciter
      if (settings.showSurahHeader !== false) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 18px "Tajawal", "Amiri", sans-serif';
        ctx.fillText(`سورة ${selectedSurah.name}`, width / 2, 55);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '12px "Tajawal", sans-serif';
        ctx.fillText(`القارئ: ${selectedReciter.arabicName}`, width / 2, 75);

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 60, 88);
        ctx.lineTo(width / 2 + 60, 88);
        ctx.stroke();
        ctx.restore();
      }

      // Find active verse with syncOffset and smooth pause bridging
      const currentTime = audioRef.current?.currentTime || 0;
      const effectiveTime = Math.max(0, currentTime + (settings.syncOffset || 0));

      let activeVerseIndex = -1;
      for (let i = 0; i < verses.length; i++) {
        if (effectiveTime >= verses[i].startTime && effectiveTime <= verses[i].endTime) {
          activeVerseIndex = i;
          break;
        }
      }

      if (activeVerseIndex === -1 && verses.length > 0) {
        if (effectiveTime < verses[0].startTime) {
          activeVerseIndex = 0;
        } else if (effectiveTime > verses[verses.length - 1].endTime) {
          activeVerseIndex = verses.length - 1;
        } else {
          for (let i = 0; i < verses.length - 1; i++) {
            if (effectiveTime > verses[i].endTime && effectiveTime < verses[i + 1].startTime) {
              activeVerseIndex = i;
              break;
            }
          }
        }
      }

      const activeVerse = activeVerseIndex >= 0 ? verses[activeVerseIndex] : null;

      if (activeVerse) {
        ctx.save();
        ctx.direction = 'rtl';
        ctx.textAlign = settings.alignment === 'right' ? 'right' : settings.alignment === 'left' ? 'left' : 'center';

        const scaleFactor = width / 720;
        const scaledFontSize = Math.max(16, Math.floor((settings.fontSize || 40) * scaleFactor));
        ctx.font = `600 ${scaledFontSize}px "${settings.font || 'Amiri Quran'}", "Scheherazade New", serif`;

        let yPos = height / 2;
        if (settings.position === 'top') yPos = height * 0.32;
        if (settings.position === 'bottom') yPos = height * 0.68;

        const xPos = settings.alignment === 'right' ? width - 30 : settings.alignment === 'left' ? 30 : width / 2;

        if (settings.textShadow) {
          ctx.shadowColor = settings.shadowColor || 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = settings.shadowBlur || 10;
        }

        if (settings.stroke) {
          ctx.strokeStyle = settings.strokeColor || '#000000';
          ctx.lineWidth = 2;
        }

        ctx.fillStyle = settings.textColor || '#ffffff';

        const verseText = `${activeVerse.text} ${settings.showAyahNumber ? `﴿${activeVerse.verseNumber}﴾` : ''}`;
        const words = verseText.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        const maxLineWidth = width - 50;

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxLineWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const lineHeight = scaledFontSize * 1.6;
        let startY = yPos - (lines.length * lineHeight) / 2 + lineHeight / 2;

        for (const line of lines) {
          if (settings.stroke) ctx.strokeText(line, xPos, startY);
          ctx.fillText(line, xPos, startY);
          startY += lineHeight;
        }
        ctx.restore();
      }

      // Watermark on preview if Free plan or hasWatermark is true
      const shouldShowWatermark = user.hasWatermark !== undefined ? user.hasWatermark : (user.subscriptionType === 'free');
      if (shouldShowWatermark) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(width - 95, height - 42, 85, 24, 6);
        ctx.fill();

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 9px "Tajawal", sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.fillText('GM Quran Reels', width - 95 + 42.5, height - 26);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [step, selectedBackground.url, settings, selectedSurah, selectedReciter, verses, user.subscriptionType]);

  // Toggle Audio Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.warn('Audio play error, trying fallback:', err);
          if (audioRef.current) {
            audioRef.current.src = fallbackAudioUrl;
            audioRef.current.play()
              .then(() => setIsPlaying(true))
              .catch(() => setAudioError(true));
          }
        });
    }
  };

  // Execute Real Video Export
  const handleStartRender = async () => {
    setRenderError(null);

    // Check daily limits
    if ((user.dailyVideosUsed || 0) >= (user.dailyLimit || 3)) {
      setRenderError(`لقد استنفدت حدك اليومي من الفيديوهات (${user.dailyLimit} فيديوهات). يرجى الترقية إلى خطة أعلى أو الانتظار حتى الغد.`);
      return;
    }

    // Stop active audio
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    setIsRendering(true);
    setRenderProgress({ stage: 'Preparing', percent: 5, message: 'بدء خط إنتاج الفيديو...' });

    try {
      // Determine target FPS based on plan
      const targetFPS = Math.min(user.maxFPS || 20, 90);
      const hasWatermark = user.hasWatermark !== undefined ? user.hasWatermark : (user.subscriptionType === 'free');

      const result = await renderQuranReel({
        surah: selectedSurah,
        reciter: selectedReciter,
        audioUrl,
        background: selectedBackground,
        verses,
        settings,
        fps: targetFPS,
        hasWatermark,
        onProgress: (p) => setRenderProgress(p)
      });

      setExportedVideoUrl(result.url);

      // Save to videos collection in Firestore
      await addDoc(collection(db, 'videos'), {
        userId: user.uid,
        projectId: initialProject?.id || null,
        surah: selectedSurah.number,
        surahName: selectedSurah.name,
        reciter: selectedReciter.id,
        reciterName: selectedReciter.arabicName,
        duration: Math.round(result.duration),
        fps: targetFPS,
        status: 'completed',
        videoUrl: result.url,
        hasWatermark,
        createdAt: new Date().toISOString()
      });

      // Increment daily video count ONLY upon success
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        dailyVideosUsed: increment(1),
        updatedAt: new Date().toISOString()
      });

      await onRefreshUser();
    } catch (err: any) {
      console.error('Video creation failed:', err);
      setRenderError(err.message || 'فشلت عملية إنشاء الفيديو، يرجى المحاولة مرة أخرى.');
      await logAppError('Rendering', err.message || 'Unknown render error', 'CreateReelWizard', user.uid);
    } finally {
      setIsRendering(false);
    }
  };

  // Save as project draft
  const handleSaveProject = async () => {
    try {
      await addDoc(collection(db, 'projects'), {
        userId: user.uid,
        title: `ريل سورة ${selectedSurah.name}`,
        surah: selectedSurah.number,
        reciterId: selectedReciter.id,
        backgroundId: selectedBackground.id,
        settings,
        duration: Math.round(audioDuration || 60),
        fps: user.maxFPS || 20,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      alert('تم حفظ المشروع بنجاح في مشاريعك!');
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  };

  // Filtered lists
  const filteredSurahs = SURAHS.filter(s => 
    s.name.includes(surahSearch) || 
    s.englishName.toLowerCase().includes(surahSearch.toLowerCase()) ||
    String(s.number).includes(surahSearch)
  );

  const filteredReciters = RECITERS.filter(r =>
    r.arabicName.includes(reciterSearch) ||
    r.name.toLowerCase().includes(reciterSearch.toLowerCase())
  );

  const filteredBackgrounds = BACKGROUNDS.filter(b =>
    bgCategory === 'all' ? true : b.category === bgCategory
  );

  return (
    <div className="space-y-6 pb-28">
      {/* Hidden Audio element for real playback and sync */}
      <audio
        ref={audioRef}
        onLoadedMetadata={(e) => {
          setAudioDuration(e.currentTarget.duration);
          setAudioLoading(false);
        }}
        onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          if (audioRef.current && audioRef.current.src !== fallbackAudioUrl) {
            audioRef.current.src = fallbackAudioUrl;
            audioRef.current.load();
          } else {
            setAudioError(true);
            setAudioLoading(false);
          }
        }}
      />

      {/* Step Indicator */}
      <div className="bg-stone-900/80 border border-stone-800 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-1 overflow-x-auto text-xs font-bold">
          {[
            { num: 1, title: 'السورة' },
            { num: 2, title: 'القارئ' },
            { num: 3, title: 'الخلفية' },
            { num: 4, title: 'التصميم' },
            { num: 5, title: 'المعاينة والتصدير' }
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer shrink-0 ${
                step === s.num 
                  ? 'bg-amber-600 text-stone-950 font-black shadow-md' 
                  : step > s.num
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                  : 'bg-stone-800/60 text-stone-400 hover:text-stone-200'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === s.num ? 'bg-stone-950 text-amber-400' : 'bg-stone-700 text-stone-300'
              }`}>
                {s.num}
              </span>
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: SELECT SURAH */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">1</span>
              <span>اختر السورة الكريمة (114 سورة)</span>
            </h3>
            <span className="text-xs text-stone-400">
              المحددة حالياً: <strong className="text-amber-400">سورة {selectedSurah.name}</strong>
            </span>
          </div>

          <div className="relative">
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="ابحث برقم السورة أو اسمها (مثال: الفاتحة، الكهف، 18)..."
              value={surahSearch}
              onChange={(e) => setSurahSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {filteredSurahs.map((surah) => {
              const isSelected = selectedSurah.number === surah.number;
              return (
                <button
                  key={surah.number}
                  onClick={() => setSelectedSurah(surah)}
                  className={`p-3 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
                    isSelected 
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-md' 
                      : 'bg-stone-900/60 border-stone-800 hover:border-stone-700 text-stone-300'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">{surah.name}</div>
                    <div className="text-[10px] text-stone-400">{surah.numberOfAyahs} آيات • {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</div>
                  </div>
                  <span className="w-6 h-6 rounded-full bg-stone-800 text-stone-400 text-xs flex items-center justify-center font-mono">
                    {surah.number}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <span>التالي: اختيار القارئ</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SELECT RECITER */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">2</span>
              <span>اختر القارئ المفضل (19 قارئاً كبار)</span>
            </h3>
          </div>

          {/* Active Reciter Audio Player Preview */}
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-stone-400 block">معاينة الصوت المباشر:</span>
                <h4 className="font-bold text-amber-400 text-base">
                  {selectedReciter.arabicName} — سورة {selectedSurah.name}
                </h4>
              </div>

              <button
                onClick={togglePlay}
                disabled={audioLoading}
                className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center shadow-lg transition transform hover:scale-105 cursor-pointer disabled:opacity-50"
              >
                {audioLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>
            </div>

            {/* Seek & Duration Bar */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={audioDuration || 100}
                value={audioCurrentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setAudioCurrentTime(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                <span>{Math.floor(audioCurrentTime / 60)}:{String(Math.floor(audioCurrentTime % 60)).padStart(2, '0')}</span>
                <span>{Math.floor(audioDuration / 60)}:{String(Math.floor(audioDuration % 60)).padStart(2, '0')}</span>
              </div>
            </div>

            {audioError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Audio unavailable — جاري تجربة مصدر بديل للقارئ...</span>
              </p>
            )}
          </div>

          <div className="relative">
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="ابحث عن قارئ..."
              value={reciterSearch}
              onChange={(e) => setReciterSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Reciter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[48vh] overflow-y-auto pr-1">
            {filteredReciters.map((reciter) => {
              const isSelected = selectedReciter.id === reciter.id;
              return (
                <div
                  key={reciter.id}
                  onClick={() => setSelectedReciter(reciter)}
                  className={`p-3 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                    isSelected 
                      ? 'bg-amber-600/20 border-amber-500 text-amber-200' 
                      : 'bg-stone-900/60 border-stone-800 hover:border-stone-700 text-stone-300'
                  }`}
                >
                  <div>
                    <h5 className="font-bold text-sm text-stone-100">{reciter.arabicName}</h5>
                    <p className="text-[10px] text-stone-400">{reciter.style}</p>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-amber-400" />}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <span>التالي: اختيار الخلفية</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SELECT BACKGROUND */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">3</span>
              <span>اختر خلفية الفيديو (عمودية 9:16)</span>
            </h3>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'kaaba', label: 'الكعبة المشرفة' },
              { id: 'madinah', label: 'المدينة المنورة' },
              { id: 'mosques', label: 'المساجد' },
              { id: 'sky', label: 'السماء والغيوم' },
              { id: 'nature', label: 'الطبيعة والجبال' },
              { id: 'patterns', label: 'زخارف إسلامية' },
              { id: 'minimal', label: 'بسيط وهادئ' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setBgCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${
                  bgCategory === cat.id 
                    ? 'bg-amber-600 text-stone-950 font-bold' 
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Background Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-1">
            {filteredBackgrounds.map((bg) => {
              const isSelected = selectedBackground.id === bg.id;
              const isLocked = bg.isPremium && user.subscriptionType === 'free';
              return (
                <div
                  key={bg.id}
                  onClick={() => {
                    if (isLocked) {
                      onOpenSubscriptions();
                    } else {
                      setSelectedBackground(bg);
                    }
                  }}
                  className={`group relative rounded-xl overflow-hidden aspect-[9/16] border-2 transition cursor-pointer ${
                    isSelected ? 'border-amber-500 shadow-xl scale-[1.02]' : 'border-stone-800 hover:border-stone-600'
                  }`}
                >
                  <img
                    src={bg.thumbnail}
                    alt={bg.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2.5">
                    <span className="text-[11px] font-bold text-stone-100">{bg.name}</span>
                    {bg.isPremium && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/90 text-stone-950 mt-1 self-start">
                        <Lock className="w-2.5 h-2.5" />
                        PREMIUM
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <span>التالي: تنسيق النص والخط</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: CUSTOMIZE TEXT & STYLING */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">4</span>
              <span>تخصيص النص القرآني والتأثيرات</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Font Family */}
            <div className="bg-stone-900 p-4 rounded-xl border border-stone-800 space-y-2">
              <label className="text-xs font-bold text-stone-300 block">نوع الخط القرآني</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Amiri Quran', label: 'الأميري العثماني' },
                  { id: 'Scheherazade New', label: 'شهرزاد' },
                  { id: 'Noto Naskh Arabic', label: 'النسخ الحديث' },
                  { id: 'Tajawal', label: 'تجوال الأنيق' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSettings({ ...settings, font: f.id })}
                    className={`p-2.5 rounded-lg border text-sm transition cursor-pointer ${
                      settings.font === f.id 
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300' 
                        : 'bg-stone-950 border-stone-800 text-stone-300'
                    }`}
                    style={{ fontFamily: f.id }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size & Position */}
            <div className="bg-stone-900 p-4 rounded-xl border border-stone-800 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-stone-300 mb-1">
                  <span>حجم خط الآيات</span>
                  <span className="text-amber-400">{settings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={24}
                  max={64}
                  value={settings.fontSize}
                  onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">موضع النص</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'top', label: 'أعلى' },
                    { id: 'center', label: 'وسط' },
                    { id: 'bottom', label: 'أسفل' }
                  ].map(pos => (
                    <button
                      key={pos.id}
                      onClick={() => setSettings({ ...settings, position: pos.id as any })}
                      className={`py-1.5 rounded-lg border text-xs cursor-pointer ${
                        settings.position === pos.id 
                          ? 'bg-amber-600 text-stone-950 font-bold border-amber-500' 
                          : 'bg-stone-950 border-stone-800 text-stone-300'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Colors & Overlay */}
            <div className="bg-stone-900 p-4 rounded-xl border border-stone-800 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-stone-300 mb-1">
                  <span>عتامة الطبقة الداكنة (Overlay)</span>
                  <span className="text-amber-400">{Math.round(settings.overlayOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  value={settings.overlayOpacity}
                  onChange={(e) => setSettings({ ...settings, overlayOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-stone-300 mb-1">
                  <span>تمويه الخلفية (Blur)</span>
                  <span className="text-amber-400">{settings.blurBackground}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  value={settings.blurBackground}
                  onChange={(e) => setSettings({ ...settings, blurBackground: parseInt(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="bg-stone-900 p-4 rounded-xl border border-stone-800 space-y-3 flex flex-col justify-center">
              <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
                <span>إظهار رقم الآية ﴿ ﴾</span>
                <input
                  type="checkbox"
                  checked={settings.showAyahNumber}
                  onChange={(e) => setSettings({ ...settings, showAyahNumber: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
                <span>إظهار ترويسة السورة والقارئ بالأعلى</span>
                <input
                  type="checkbox"
                  checked={settings.showSurahHeader}
                  onChange={(e) => setSettings({ ...settings, showSurahHeader: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
                <span>تفعيل الظل ثلاثي الأبعاد للنص</span>
                <input
                  type="checkbox"
                  checked={settings.textShadow}
                  onChange={(e) => setSettings({ ...settings, textShadow: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </label>
            </div>

            {/* Audio & Ayah Sync Precision Offset */}
            <div className="bg-stone-900/90 border border-amber-500/30 p-4 rounded-xl space-y-2 md:col-span-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-200">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span>ضبط دقة مزامنة الصوت مع الآيات (Sync Offset)</span>
                  <span className="text-[10px] text-stone-400 font-normal hidden sm:inline">
                    (لتقديم أو تأخير ظهور النص مع صوت التلاوة بدقة متناهية)
                  </span>
                </div>
                <span className={`font-mono text-xs px-2.5 py-0.5 rounded-full border ${
                  (settings.syncOffset || 0) === 0 
                    ? 'bg-stone-800 text-stone-400 border-stone-700' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {(settings.syncOffset || 0) > 0 ? `+${(settings.syncOffset || 0).toFixed(1)} ثانية` : `${(settings.syncOffset || 0).toFixed(1)} ثانية`}
                </span>
              </div>
              
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, syncOffset: Math.max(-3, Math.round(((s.syncOffset || 0) - 0.2) * 10) / 10) }))}
                  className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-lg border border-stone-700 transition cursor-pointer"
                  title="تأخير ظهور النص"
                >
                  -0.2s
                </button>
                
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step={0.1}
                  value={settings.syncOffset || 0}
                  onChange={(e) => setSettings({ ...settings, syncOffset: parseFloat(e.target.value) })}
                  className="flex-1 accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg"
                />
                
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, syncOffset: Math.min(3, Math.round(((s.syncOffset || 0) + 0.2) * 10) / 10) }))}
                  className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-lg border border-stone-700 transition cursor-pointer"
                  title="تقديم ظهور النص"
                >
                  +0.2s
                </button>

                {(settings.syncOffset || 0) !== 0 && (
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, syncOffset: 0 }))}
                    className="px-2 py-1 text-[11px] text-stone-400 hover:text-amber-400 underline transition cursor-pointer shrink-0"
                  >
                    إعادة ضبط
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
            <button
              onClick={() => setStep(5)}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <span>التالي: المعاينة الحية والتصدير</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: LIVE PREVIEW & VIDEO RENDERING */}
      {step === 5 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">5</span>
              <span>المعاينة المباشرة وتصدير الريل (9:16)</span>
            </h3>

            <button
              onClick={handleSaveProject}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ كمسودة مشروع</span>
            </button>
          </div>

          {/* Render Error Alert */}
          {renderError && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">تنبيه:</strong>
                <span>{renderError}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Live 9:16 Canvas Frame */}
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-[270px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/40 bg-black flex items-center justify-center">
                <canvas
                  ref={previewCanvasRef}
                  width={360}
                  height={640}
                  className="w-full h-full object-cover"
                />

                {/* Floating Play/Pause overlay */}
                <button
                  onClick={togglePlay}
                  className="absolute bottom-3 left-3 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-amber-400 flex items-center justify-center border border-amber-500/40 transition cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
                </button>
              </div>

              {/* Progress seeker for preview */}
              <div className="w-full max-w-[270px] mt-3 space-y-2">
                <div>
                  <input
                    type="range"
                    min={0}
                    max={audioDuration || 100}
                    value={audioCurrentTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setAudioCurrentTime(val);
                      if (audioRef.current) audioRef.current.currentTime = val;
                    }}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-0.5">
                    <span>{Math.floor(audioCurrentTime)}s</span>
                    <span>{Math.floor(audioDuration)}s</span>
                  </div>
                </div>

                {/* Quick Sync Offset Adjustment during live listening */}
                <div className="bg-stone-900/90 border border-stone-800 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-stone-300">
                    <span className="flex items-center gap-1">
                      <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                      <span>مزامنة الصوت/الآيات:</span>
                    </span>
                    <span className="font-mono text-amber-400 font-bold">
                      {(settings.syncOffset || 0) > 0 ? `+${(settings.syncOffset || 0).toFixed(1)}s` : `${(settings.syncOffset || 0).toFixed(1)}s`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, syncOffset: Math.max(-3, Math.round(((s.syncOffset || 0) - 0.2) * 10) / 10) }))}
                      className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] rounded border border-stone-700 transition"
                      title="تأخير ظهور النص"
                    >
                      -0.2s
                    </button>
                    <input
                      type="range"
                      min={-3}
                      max={3}
                      step={0.1}
                      value={settings.syncOffset || 0}
                      onChange={(e) => setSettings({ ...settings, syncOffset: parseFloat(e.target.value) })}
                      className="flex-1 accent-amber-500 cursor-pointer h-1 bg-stone-800 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, syncOffset: Math.min(3, Math.round(((s.syncOffset || 0) + 0.2) * 10) / 10) }))}
                      className="px-2 py-0.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10px] rounded border border-stone-700 transition"
                      title="تقديم ظهور النص"
                    >
                      +0.2s
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Export Actions & Details */}
            <div className="space-y-4">
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-2.5 text-xs">
                <h4 className="font-bold text-sm text-stone-100 mb-2">تفاصيل الريل النهائي:</h4>
                <div className="flex justify-between py-1 border-b border-stone-800">
                  <span className="text-stone-400">السورة:</span>
                  <span className="font-bold text-amber-400">سورة {selectedSurah.name} ({selectedSurah.numberOfAyahs} آيات)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-800">
                  <span className="text-stone-400">القارئ:</span>
                  <span className="font-bold text-stone-100">{selectedReciter.arabicName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-800">
                  <span className="text-stone-400">الخلفية:</span>
                  <span className="text-stone-200">{selectedBackground.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-800">
                  <span className="text-stone-400">معدل الإطارات:</span>
                  <span className="font-bold text-blue-400">{user.maxFPS} FPS ({user.subscriptionType})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-800">
                  <span className="text-stone-400">العلامة المائية:</span>
                  <span className={`font-bold ${user.subscriptionType === 'free' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {user.subscriptionType === 'free' ? 'تظهر علامة GM (مجاني)' : 'بدون علامة مائية'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-400">الفيديوهات المتبقية اليوم:</span>
                  <span className="font-bold text-emerald-400">{Math.max(0, user.dailyLimit - user.dailyVideosUsed)} من أصل {user.dailyLimit}</span>
                </div>
              </div>

              {/* Rendering Progress Display */}
              {isRendering && renderProgress && (
                <div className="bg-stone-900 border border-amber-500/40 rounded-2xl p-4 space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{renderProgress.stage}</span>
                    </span>
                    <span className="font-mono text-stone-300 font-bold">{renderProgress.percent}%</span>
                  </div>

                  <div className="w-full bg-stone-950 rounded-full h-2.5 overflow-hidden border border-stone-800">
                    <div
                      className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-200"
                      style={{ width: `${renderProgress.percent}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-stone-400 leading-relaxed">
                    {renderProgress.message}
                  </p>
                </div>
              )}

              {/* Ready Video Output */}
              {exportedVideoUrl && (
                <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>تم إنشاء الفيديو بنجاح وجاهز للمشاركة!</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={exportedVideoUrl}
                      download={`quran_reel_${selectedSurah.number}.webm`}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold rounded-xl text-center text-sm shadow-lg flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل الفيديو للموبايل (WebM/MP4)</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Main Export Button */}
              {!isRendering && (
                <button
                  onClick={handleStartRender}
                  className="w-full py-4 px-6 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black rounded-xl text-base shadow-xl flex items-center justify-center gap-3 transition transform hover:scale-[1.01] cursor-pointer"
                >
                  <Video className="w-5 h-5 stroke-[2.5]" />
                  <span>بدء تصدير الفيديو الحقيقي (Export Reel)</span>
                </button>
              )}

              <div className="flex justify-start">
                <button
                  onClick={() => setStep(4)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>تعديل التنسيقات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
