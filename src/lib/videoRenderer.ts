import { VerseTiming, TextSettings, BackgroundItem, Reciter, Surah } from '../types';

export interface RenderProgressUpdate {
  stage: 
    | 'Preparing'
    | 'Loading Audio'
    | 'Loading Background'
    | 'Preparing Quran Text'
    | 'Preparing Verse Timing'
    | 'Synchronizing'
    | 'Rendering'
    | 'Encoding'
    | 'Finalizing'
    | 'Saving'
    | 'Video Ready';
  percent: number;
  message: string;
}

export interface RenderOptions {
  surah: Surah;
  reciter: Reciter;
  audioUrl: string;
  background: BackgroundItem;
  verses: VerseTiming[];
  settings: TextSettings;
  fps: number;
  hasWatermark: boolean;
  maxDuration?: number; // optional cut for short reel if whole surah is long
  onProgress: (update: RenderProgressUpdate) => void;
}

/**
 * Loads an image from URL into an HTMLImageElement
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => {
      console.warn('Image load error for', url, e);
      // Create fallback canvas
      const c = document.createElement('canvas');
      c.width = 720;
      c.height = 1280;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, 720, 1280);
      const fallbackImg = new Image();
      fallbackImg.src = c.toDataURL();
      fallbackImg.onload = () => resolve(fallbackImg);
    };
    img.src = url;
  });
}

/**
 * Fetches and decodes audio data into an AudioBuffer
 */
async function fetchAndDecodeAudio(audioContext: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio from ${url} (status ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Executes the complete real video rendering pipeline
 */
export async function renderQuranReel(options: RenderOptions): Promise<{ blob: Blob; url: string; duration: number }> {
  const { surah, reciter, audioUrl, background, verses, settings, fps, hasWatermark, onProgress } = options;

  // 1. Preparing
  onProgress({ stage: 'Preparing', percent: 5, message: 'تهيئة محرك تصدير الفيديو...' });
  await new Promise(r => setTimeout(r, 200));

  // 2. Loading Audio
  onProgress({ stage: 'Loading Audio', percent: 12, message: `جاري تحميل التلاوة بصوت ${reciter.arabicName}...` });
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await fetchAndDecodeAudio(audioContext, audioUrl);
  } catch (err) {
    // If primary failed, try fallback
    console.warn('Primary audio failed, trying fallback...', err);
    onProgress({ stage: 'Loading Audio', percent: 15, message: 'المصدر الأساسي بطيء، جاري الاتصال بالمصدر الاحتياطي...' });
    const fallbackUrl = reciter.fallbackServerUrl 
      ? `${reciter.fallbackServerUrl}/${String(surah.number).padStart(3, '0')}.mp3`
      : `https://server8.mp3quran.net/afs/${String(surah.number).padStart(3, '0')}.mp3`;
    audioBuffer = await fetchAndDecodeAudio(audioContext, fallbackUrl);
  }

  // 3. Loading Background
  onProgress({ stage: 'Loading Background', percent: 22, message: 'جاري تحميل خلفية الفيديو المحددة...' });
  const bgImage = await loadImage(background.url);

  // 4. Preparing Quran Text & Verse Timing
  onProgress({ stage: 'Preparing Quran Text', percent: 28, message: 'تنسيق النص القرآني بالخط العثماني...' });
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 150));

  onProgress({ stage: 'Preparing Verse Timing', percent: 34, message: 'مطابقة التوقيت الزمني الدقيق للآيات...' });

  // Determine total duration
  const maxVerseEnd = verses.length > 0 ? verses[verses.length - 1].endTime : audioBuffer.duration;
  // If whole surah is very long (e.g. Al-Baqarah), cap reel to either maxVerseEnd or reasonable duration (max 120s)
  const renderDuration = Math.min(maxVerseEnd > 0 ? maxVerseEnd : audioBuffer.duration, audioBuffer.duration, 120);

  // 5. Synchronizing
  onProgress({ stage: 'Synchronizing', percent: 40, message: 'مزامنة طبقات الصوت والآيات والأطر...' });

  // 6. Setup Canvas 9:16 (720x1280)
  const width = 720;
  const height = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // Setup Audio routing
  const audioDestination = audioContext.createMediaStreamDestination();
  const sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = audioBuffer;
  sourceNode.connect(audioDestination);

  // Combine Canvas Stream + Audio Stream
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks()
  ]);

  // Select supported MIME type
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  let selectedMimeType = 'video/webm';
  for (const mt of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mt)) {
      selectedMimeType = mt;
      break;
    }
  }

  const recordedChunks: Blob[] = [];
  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMimeType,
    videoBitsPerSecond: 4500000 // 4.5 Mbps crisp high quality
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  // 7. Start Rendering & Encoding Loop
  onProgress({ stage: 'Rendering', percent: 42, message: `بدء المعالجة والترميز بمعدل ${fps} FPS...` });

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      onProgress({ stage: 'Finalizing', percent: 95, message: 'تجميع الحزم وإنشاء ملف الفيديو النهائي...' });
      const finalBlob = new Blob(recordedChunks, { type: selectedMimeType });
      const videoUrl = URL.createObjectURL(finalBlob);

      onProgress({ stage: 'Video Ready', percent: 100, message: 'تم إنجاز الفيديو بنجاح وجاهز للمشاهدة والتحميل!' });
      resolve({
        blob: finalBlob,
        url: videoUrl,
        duration: renderDuration
      });
      // Clean up audio context
      try { audioContext.close(); } catch(e){}
    };

    recorder.onerror = (e) => {
      reject(new Error(`MediaRecorder failed: ${e}`));
      try { audioContext.close(); } catch(e){}
    };

    // Helper to draw single frame at time t
    const drawFrame = (currentTime: number) => {
      // Draw background image scaled cover
      const bgRatio = bgImage.width / bgImage.height;
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
      ctx.drawImage(bgImage, offX, offY, drawW, drawH);
      ctx.restore();

      // Draw dark aesthetic overlay
      ctx.fillStyle = `rgba(0, 0, 0, ${settings.overlayOpacity || 0.45})`;
      ctx.fillRect(0, 0, width, height);

      // Top decorative header: Surah Name & Reciter
      if (settings.showSurahHeader !== false) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f59e0b'; // Amber gold
        ctx.font = 'bold 36px "Tajawal", "Amiri", sans-serif';
        ctx.fillText(`سورة ${surah.name}`, width / 2, 110);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '22px "Tajawal", sans-serif';
        ctx.fillText(`القارئ: ${reciter.arabicName}`, width / 2, 145);

        // Gold divider line
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 120, 170);
        ctx.lineTo(width / 2 + 120, 170);
        ctx.stroke();
        ctx.restore();
      }

      // Apply user syncOffset (-3.0s to +3.0s)
      const effectiveTime = Math.max(0, currentTime + (settings.syncOffset || 0));

      // Find active verse for this timestamp with smooth inter-verse pause bridging
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
          // In pause between verse i and verse i+1: hold verse i on screen until verse i+1 starts!
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

        const fontSize = settings.fontSize || 42;
        ctx.font = `600 ${fontSize}px "${settings.font || 'Amiri Quran'}", "Scheherazade New", serif`;

        // Calculate Y position
        let yPos = height / 2;
        if (settings.position === 'top') yPos = height * 0.32;
        if (settings.position === 'bottom') yPos = height * 0.68;

        const xPos = settings.alignment === 'right' ? width - 60 : settings.alignment === 'left' ? 60 : width / 2;

        // Shadow
        if (settings.textShadow) {
          ctx.shadowColor = settings.shadowColor || 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = settings.shadowBlur || 15;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 4;
        }

        // Stroke
        if (settings.stroke) {
          ctx.strokeStyle = settings.strokeColor || '#000000';
          ctx.lineWidth = settings.strokeWidth || 4;
        }

        ctx.fillStyle = settings.textColor || '#ffffff';

        // Wrap Arabic text cleanly on canvas
        const verseText = `${activeVerse.text} ${settings.showAyahNumber ? `﴿${activeVerse.verseNumber}﴾` : ''}`;
        const words = verseText.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        const maxLineWidth = width - 120;

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxLineWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        // Render lines centered around yPos
        const lineHeight = fontSize * 1.65;
        const totalBlockHeight = lines.length * lineHeight;
        let startY = yPos - totalBlockHeight / 2 + lineHeight / 2;

        for (const line of lines) {
          if (settings.stroke) {
            ctx.strokeText(line, xPos, startY);
          }
          ctx.fillText(line, xPos, startY);
          startY += lineHeight;
        }

        ctx.restore();
      }

      // Watermark for Free tier (RENDERED DIRECTLY ONTO VIDEO CANVAS)
      if (hasWatermark) {
        ctx.save();
        ctx.direction = 'ltr';
        // Elegant pill badge at bottom right
        const wmX = width - 170;
        const wmY = height - 80;
        const wmW = 140;
        const wmH = 40;
        const radius = 8;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.roundRect(wmX, wmY, wmW, wmH, radius);
        ctx.fill();

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 16px "Tajawal", sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.fillText('GM Quran Reels', wmX + wmW / 2, wmY + 25);
        ctx.restore();
      }

      // Audio progress wave / bar indicator at bottom
      ctx.save();
      const progressRatio = Math.min(currentTime / renderDuration, 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(40, height - 25, width - 80, 4);
      ctx.fillStyle = '#10b981'; // Emerald green
      ctx.fillRect(40, height - 25, (width - 80) * progressRatio, 4);
      ctx.restore();
    };

    // Start MediaRecorder and Audio playback
    recorder.start(500); // 500ms chunks
    const audioStartTime = audioContext.currentTime;
    sourceNode.start(0);

    const startTime = performance.now();
    let isFinished = false;

    const frameInterval = 1000 / fps;
    let lastFrameTime = performance.now();

    const loop = (now: number) => {
      if (isFinished) return;

      const audioElapsed = audioContext.currentTime - audioStartTime;
      const perfElapsed = (now - startTime) / 1000;
      const elapsedSec = audioElapsed > 0.05 ? audioElapsed : perfElapsed;

      if (now - lastFrameTime >= frameInterval) {
        drawFrame(elapsedSec);
        lastFrameTime = now;

        // Calculate genuine encoding progress between 40% and 92%
        const renderPercent = Math.min(
          92,
          Math.floor(40 + (elapsedSec / renderDuration) * 52)
        );
        onProgress({
          stage: 'Rendering',
          percent: renderPercent,
          message: `جاري معالجة الإطارات (${Math.floor(elapsedSec)}s / ${Math.floor(renderDuration)}s)...`
        });
      }

      if (elapsedSec >= renderDuration) {
        isFinished = true;
        onProgress({ stage: 'Encoding', percent: 94, message: 'إنهاء ترميز الفيديو والصوت...' });
        try { sourceNode.stop(); } catch(e){}
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, 300);
        return;
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  });
}
