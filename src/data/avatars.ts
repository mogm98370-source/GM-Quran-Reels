export interface AvatarItem {
  id: string;
  name: string;
  category: 'islamic' | 'quran' | 'art' | 'characters';
  url: string;
}

export const PRESET_AVATARS: AvatarItem[] = [
  // معالم إسلامية
  {
    id: 'kaaba_gold',
    name: 'الكعبة المشرفة',
    category: 'islamic',
    url: 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'madinah_mosque',
    name: 'المسجد النبوي الشريف',
    category: 'islamic',
    url: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'qubbat_sakhrah',
    name: 'قبة الصخرة المشرفة',
    category: 'islamic',
    url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'minaret_dusk',
    name: 'المئذنة وقت الغروب',
    category: 'islamic',
    url: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=256&q=80'
  },

  // مصحف وزخرفة إسلامية
  {
    id: 'quran_gold',
    name: 'المصحف الشريف المذهب',
    category: 'quran',
    url: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'quran_glow',
    name: 'نور القرآن',
    category: 'quran',
    url: 'https://images.unsplash.com/photo-1585036156171-384164a8c675?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'islamic_geometry',
    name: 'زخرفة هندسية إسلامية',
    category: 'quran',
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=256&q=80'
  },
  {
    id: 'crescent_lantern',
    name: 'الهلال والقنديل',
    category: 'quran',
    url: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=256&q=80'
  },

  // رسوم وشخصيات وقورة إسلامية
  {
    id: 'scholar_emerald',
    name: 'قارئ وقور زمردي',
    category: 'characters',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=quranReader&backgroundColor=065f46'
  },
  {
    id: 'scholar_amber',
    name: 'قارئ وقور عنبري',
    category: 'characters',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=islamicScholar&backgroundColor=78350f'
  },
  {
    id: 'scholar_teal',
    name: 'قارئ وقور فيروزي',
    category: 'characters',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=nurQuran&backgroundColor=0f766e'
  },
  {
    id: 'scholar_stone',
    name: 'قارئ وقور فخامة',
    category: 'characters',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=sheikhNoble&backgroundColor=1c1917'
  },

  // أسلوب الرموز التعبيرية المعبرة
  {
    id: 'persona_calm',
    name: 'سكينة وطمأنينة',
    category: 'art',
    url: 'https://api.dicebear.com/7.x/personas/svg?seed=peaceful&backgroundColor=047857'
  },
  {
    id: 'persona_light',
    name: 'ضياء ونور',
    category: 'art',
    url: 'https://api.dicebear.com/7.x/personas/svg?seed=radiance&backgroundColor=b45309'
  },
  {
    id: 'persona_dawn',
    name: 'فجر القرآن',
    category: 'art',
    url: 'https://api.dicebear.com/7.x/personas/svg?seed=fajrGlow&backgroundColor=0369a1'
  },
  {
    id: 'persona_hope',
    name: 'رجاء ودعاء',
    category: 'art',
    url: 'https://api.dicebear.com/7.x/personas/svg?seed=hopeDua&backgroundColor=4338ca'
  }
];

/**
 * Compresses an uploaded image file into a compact Base64 Data URL (max 256x256, WebP/JPEG)
 */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Export as webp with 0.8 quality or jpeg
        try {
          const compressed = canvas.toDataURL('image/webp', 0.82);
          resolve(compressed);
        } catch {
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
