export type SubscriptionPlan = 'free' | 'weekly' | 'monthly' | 'yearly';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  accountStatus: 'active' | 'disabled';
  subscriptionType: SubscriptionPlan;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  gems: number;
  dailyVideosUsed: number;
  lastUsageDate: string; // YYYY-MM-DD
  maxFPS: number;
  dailyLimit: number;
  hasWatermark?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reciter {
  id: string;
  name: string;
  arabicName: string;
  style: string;
  serverUrl: string;
  fallbackServerUrl?: string;
  everyAyahFolder?: string;
  quranComId?: number; // for fetching verse timings
}

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export interface VerseTiming {
  verseNumber: number;
  text: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
}

export interface BackgroundItem {
  id: string;
  name: string;
  category: 'kaaba' | 'madinah' | 'mosques' | 'nature' | 'patterns' | 'minimal' | 'sky';
  url: string;
  thumbnail: string;
  isPremium: boolean;
  type?: 'image' | 'gradient';
}

export interface TextSettings {
  font: string;
  fontSize: number; // in px on canvas
  textColor: string;
  textShadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  stroke: boolean;
  strokeColor: string;
  strokeWidth: number;
  position: 'center' | 'bottom' | 'top';
  alignment: 'center' | 'right' | 'left';
  showAyahNumber: boolean;
  showSurahHeader: boolean;
  animation: 'fade' | 'slide' | 'zoom' | 'none';
  overlayOpacity: number; // 0 to 0.8
  blurBackground: number; // 0 to 20
  showTranslation?: boolean;
  syncOffset?: number; // synchronization offset in seconds (-3.0 to +3.0)
}

export interface ReelProject {
  id: string;
  userId: string;
  title: string;
  surah: number;
  reciterId: string;
  backgroundId: string;
  settings: TextSettings;
  duration: number;
  fps: number;
  status: 'draft' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface ExportedVideo {
  id: string;
  userId: string;
  projectId?: string;
  surah: number;
  surahName?: string;
  reciter: string;
  reciterName?: string;
  duration: number;
  fps: number;
  status: 'completed' | 'failed';
  videoUrl: string;
  thumbnailUrl?: string;
  hasWatermark: boolean;
  createdAt: string;
}

export interface GemTransaction {
  id: string;
  userId: string;
  type: 'ADD' | 'DEDUCT' | 'SUBSCRIPTION_PURCHASE' | 'CODE_REDEEM';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
  adminId?: string;
}

export interface GemCode {
  id: string;
  code: string;
  amount: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  createdBy?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  reply?: string;
  adminReply?: string;
  category?: string;
  status: 'open' | 'replied' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminUid: string;
  action: string;
  targetUserUid?: string;
  value?: any;
  details: string;
  timestamp: string;
}

export interface ErrorLog {
  id: string;
  type: 'Audio' | 'Rendering' | 'Encoding' | 'Firebase' | 'Storage' | 'Auth';
  userId?: string;
  message: string;
  page?: string;
  timestamp: string;
}
