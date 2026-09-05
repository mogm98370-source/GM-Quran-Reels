import { VerseTiming } from '../types';
import { PRESET_VERSES, SURAHS } from '../data/quranData';
import { Reciter } from '../types';

export interface TimingResult {
  verses: VerseTiming[];
  matchedAudioUrl?: string;
}

// Cache for verses & timings
const verseCache = new Map<string, TimingResult>();

/**
 * Fetches real verses and authentic millisecond synchronization timings for a given surah & reciter
 */
export async function getSurahVersesWithTiming(
  surahNumber: number,
  reciter: Reciter,
  audioDuration?: number
): Promise<TimingResult> {
  const cacheKey = `${surahNumber}_${reciter.id}_${Math.round(audioDuration || 0)}`;
  if (verseCache.has(cacheKey)) {
    return verseCache.get(cacheKey)!;
  }

  try {
    // 1. Fetch exact verse timing from Quran.com API with ?segments=true
    let apiTimings: { verseNumber: number; startTime: number; endTime: number }[] = [];
    let matchedAudioUrl: string | undefined = undefined;
    let isDirectReciterMatch = false;
    
    // Priority: use reciter's own quranComId, or fallback to reference reciter (Alafasy = 7)
    const targetComId = reciter.quranComId || 7;
    try {
      const res = await fetch(`https://api.quran.com/api/v4/chapter_recitations/${targetComId}/${surahNumber}?segments=true`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.audio_file) {
          if (reciter.quranComId && json.audio_file.audio_url) {
            matchedAudioUrl = json.audio_file.audio_url;
            isDirectReciterMatch = true;
          }
          const rawTimings = json.audio_file.timestamps || json.audio_file.verse_timings || [];
          if (Array.isArray(rawTimings) && rawTimings.length > 0) {
            apiTimings = rawTimings.map((t: any) => {
              const parts = (t.verse_key || '').split(':');
              const verseNum = parseInt(parts[1], 10) || 1;
              return {
                verseNumber: verseNum,
                startTime: (t.timestamp_from || 0) / 1000,
                endTime: (t.timestamp_to || 0) / 1000
              };
            });
          }
        }
      }
    } catch (e) {
      console.warn('Quran.com timing API non-blocking fallback:', e);
    }

    // 2. Fetch Uthmanic Arabic text for all verses of this Surah
    let versesText: { verseNumber: number; text: string }[] = [];
    try {
      const textRes = await fetch(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${surahNumber}`);
      if (textRes.ok) {
        const textJson = await textRes.json();
        if (Array.isArray(textJson.verses)) {
          versesText = textJson.verses.map((v: any) => {
            const parts = (v.verse_key || '').split(':');
            return {
              verseNumber: parseInt(parts[1], 10) || 1,
              text: v.text_uthmani
            };
          });
        }
      }
    } catch (e) {
      console.warn('Uthmanic text fetch fallback:', e);
    }

    // 3. Fallback to alquran.cloud if quran.com was unreachable
    if (versesText.length === 0) {
      try {
        const fallbackRes = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}`);
        if (fallbackRes.ok) {
          const fbJson = await fallbackRes.json();
          if (fbJson.data && Array.isArray(fbJson.data.ayahs)) {
            versesText = fbJson.data.ayahs.map((a: any) => ({
              verseNumber: a.numberInSurah,
              text: a.text
            }));
          }
        }
      } catch (e) {
        console.warn('Alquran.cloud fallback failed:', e);
      }
    }

    // 4. Fallback to PRESET_VERSES if completely offline
    if (versesText.length === 0 && PRESET_VERSES[surahNumber]) {
      versesText = PRESET_VERSES[surahNumber].map((p, idx) => ({
        verseNumber: idx + 1,
        text: p.text
      }));
    }

    // If still empty (offline for a non-preset surah), build basic placeholder verses with surah name
    if (versesText.length === 0) {
      const surahMeta = SURAHS.find(s => s.number === surahNumber);
      const totalAyahs = surahMeta ? surahMeta.numberOfAyahs : 7;
      versesText = Array.from({ length: totalAyahs }, (_, i) => ({
        verseNumber: i + 1,
        text: `آية رقم ${i + 1} من سورة ${surahMeta?.name || surahNumber}`
      }));
    }

    // 5. Build final VerseTiming array
    const result: VerseTiming[] = [];
    const totalVerses = versesText.length;

    if (apiTimings.length >= totalVerses) {
      // If direct match, use exact millisecond timestamps
      // If reference reciter was used, scale according to actual audio duration
      const refTotalDuration = apiTimings[totalVerses - 1]?.endTime || 1;
      const shouldScale = !isDirectReciterMatch && audioDuration && audioDuration > 5 && refTotalDuration > 0;
      const scale = shouldScale ? (audioDuration / refTotalDuration) : 1;

      for (let i = 0; i < totalVerses; i++) {
        const t = apiTimings[i];
        const v = versesText[i];
        result.push({
          verseNumber: v.verseNumber,
          text: v.text,
          startTime: Math.round(t.startTime * scale * 100) / 100,
          endTime: Math.round(t.endTime * scale * 100) / 100
        });
      }
    } else {
      // Calculate realistic timing proportionally based on audio duration or preset lengths
      let currentStart = 0;
      const totalDuration = audioDuration && audioDuration > 5 ? audioDuration : (
        PRESET_VERSES[surahNumber] 
          ? PRESET_VERSES[surahNumber].reduce((acc, curr) => acc + curr.defaultDuration, 0)
          : totalVerses * 4.5
      );

      // Determine verse weights by text length for realistic cadence
      const lengths = versesText.map(v => Math.max(v.text.length, 10));
      const totalLength = lengths.reduce((acc, l) => acc + l, 0);

      for (let i = 0; i < totalVerses; i++) {
        const v = versesText[i];
        const verseDuration = (lengths[i] / totalLength) * totalDuration;
        const endTime = i === totalVerses - 1 ? totalDuration : currentStart + verseDuration;

        result.push({
          verseNumber: v.verseNumber,
          text: v.text,
          startTime: Math.round(currentStart * 100) / 100,
          endTime: Math.round(endTime * 100) / 100
        });

        currentStart = endTime;
      }
    }

    const output: TimingResult = {
      verses: result,
      matchedAudioUrl: isDirectReciterMatch ? matchedAudioUrl : undefined
    };

    verseCache.set(cacheKey, output);
    return output;
  } catch (err) {
    console.error('getSurahVersesWithTiming error:', err);
    // Return minimum fallback so app never crashes
    const fallback: VerseTiming[] = [
      { verseNumber: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", startTime: 0, endTime: 4.5 },
      { verseNumber: 2, text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", startTime: 4.5, endTime: 9.5 }
    ];
    return { verses: fallback };
  }
}
