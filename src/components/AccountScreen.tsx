import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GemTransaction, SupportTicket } from '../types';
import { db, auth, updateUserProfileData } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { 
  User, 
  Mail, 
  Copy, 
  Check, 
  Gem, 
  Crown, 
  History, 
  Headphones, 
  LogOut, 
  MessageSquarePlus, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Clock, 
  Send,
  Edit3,
  Camera,
  Upload,
  Image as ImageIcon,
  Sparkles,
  X,
  RefreshCw
} from 'lucide-react';
import { RECITERS } from '../data/reciters';
import { PRESET_AVATARS, compressImageFile } from '../data/avatars';

interface AccountScreenProps {
  user: UserProfile;
  onLogout: () => void;
  onRefreshUser: () => Promise<void>;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ user, onLogout, onRefreshUser }) => {
  const [copiedUid, setCopiedUid] = useState(false);
  const [transactions, setTransactions] = useState<GemTransaction[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // New ticket state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketCategory, setTicketCategory] = useState<'billing' | 'technical' | 'reciter_audio' | 'feature' | 'other'>('technical');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState('');

  // Profile editing states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editAvatar, setEditAvatar] = useState(user.avatar || '');
  const [avatarTab, setAvatarTab] = useState<'islamic' | 'quran' | 'characters' | 'custom'>('islamic');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEditName(user.name);
    setEditAvatar(user.avatar || '');
  }, [user.name, user.avatar]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setProfileErrorMsg('');
    try {
      const compressedDataUrl = await compressImageFile(file);
      setEditAvatar(compressedDataUrl);
    } catch (err) {
      console.error('File compression error:', err);
      setProfileErrorMsg('تعذر معالجة الصورة، يرجى اختيار صورة أصغر أو صيغة أخرى.');
    } finally {
      setUploadingImage(false);
    }
  };

  const generateInitialsAvatar = () => {
    const seed = editName.trim() || user.name || 'User';
    const bgColors = ['065f46', '78350f', '0f766e', '1e3a8a', '4c1d95'];
    const randomBg = bgColors[Math.floor(Math.random() * bgColors.length)];
    const url = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${randomBg}`;
    setEditAvatar(url);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setProfileErrorMsg('يرجى كتابة الاسم الكريم');
      return;
    }

    setSavingProfile(true);
    setProfileErrorMsg('');
    try {
      const finalAvatar = editAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editName.trim())}&backgroundColor=065f46`;
      await updateUserProfileData(user.uid, {
        name: editName.trim(),
        avatar: finalAvatar
      });
      await onRefreshUser();
      setProfileSuccessMsg('تم تحديث الاسم والصورة الشخصية بنجاح!');
      setTimeout(() => {
        setProfileSuccessMsg('');
        setShowEditProfileModal(false);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setProfileErrorMsg('حدث خطأ أثناء حفظ التعديلات: ' + (err.message || ''));
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    async function loadAccountData() {
      setLoadingHistory(true);
      try {
        // Transactions
        const txQuery = query(
          collection(db, 'gemTransactions'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const txSnap = await getDocs(txQuery);
        setTransactions(txSnap.docs.map(d => ({ id: d.id, ...d.data() } as GemTransaction)));

        // Tickets
        const tkQuery = query(
          collection(db, 'supportTickets'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const tkSnap = await getDocs(tkQuery);
        setTickets(tkSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket)));
      } catch (err) {
        console.warn('Account load error:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadAccountData();
  }, [user.uid]);

  const copyUidToClipboard = () => {
    navigator.clipboard.writeText(user.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    setSubmittingTicket(true);
    try {
      const newTicket = {
        userId: user.uid,
        userEmail: user.email,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        status: 'open',
        category: ticketCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'supportTickets'), newTicket);
      setTickets(prev => [{ id: docRef.id, ...newTicket } as SupportTicket, ...prev]);
      setTicketSuccess('تم إرسال تذكرة الدعم بنجاح! سيتم الرد عليك قريباً.');
      setTicketSubject('');
      setTicketMessage('');
      setShowNewTicketModal(false);
    } catch (err) {
      console.error('Failed to create ticket:', err);
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleUpdateDefaultReciter = async (reciterId: string) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        defaultReciter: reciterId,
        updatedAt: new Date().toISOString()
      });
      await onRefreshUser();
    } catch (err) {
      console.error('Update reciter error:', err);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Profile Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div 
              onClick={() => setShowEditProfileModal(true)}
              className="relative group cursor-pointer"
              title="انقر لتغيير الصورة الشخصية"
            >
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                alt={user.name}
                className="w-16 h-16 rounded-2xl border-2 border-amber-500/40 shadow-md bg-stone-950 object-cover group-hover:opacity-80 transition"
              />
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-amber-300">
                <Camera className="w-5 h-5 drop-shadow" />
              </div>
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-stone-950 p-1 rounded-full shadow">
                <Edit3 className="w-2.5 h-2.5" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-stone-100">{user.name}</h3>
                <button
                  onClick={() => setShowEditProfileModal(true)}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs flex items-center gap-1 border border-amber-500/30 transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>تعديل</span>
                </button>
              </div>
              <p className="text-xs text-stone-400 font-mono" dir="ltr">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  خطة: {user.subscriptionType.toUpperCase()}
                </span>
                <span className="text-[10px] text-stone-400">
                  {user.dailyVideosUsed} / {user.dailyLimit} فيديو اليوم
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditProfileModal(true)}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              <span>تغيير الاسم والصورة</span>
            </button>
            <div className="text-left bg-stone-950 px-3.5 py-2 rounded-xl border border-stone-800">
              <span className="text-[10px] text-stone-400 block text-right">رصيد الجواهر</span>
              <span className="text-sm font-bold text-amber-400 flex items-center gap-1">
                <Gem className="w-3.5 h-3.5" />
                {user.gems.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* UID Copy Bar */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-2 font-mono truncate">
            <span>UID:</span>
            <span className="text-stone-300 truncate max-w-[200px] sm:max-w-none">{user.uid}</span>
          </div>
          <button
            onClick={copyUidToClipboard}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-sans cursor-pointer px-2 py-1 rounded bg-stone-800"
          >
            {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUid ? 'تم النسخ!' : 'نسخ المعرف'}</span>
          </button>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-stone-200">الإعدادات والتفضيلات الافتراضية</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-stone-400 mb-1">القارئ الافتراضي عند فتح التطبيق</label>
            <select
              value={user.defaultReciter || 'alafasy'}
              onChange={(e) => handleUpdateDefaultReciter(e.target.value)}
              className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {RECITERS.map(r => (
                <option key={r.id} value={r.id}>
                  {r.arabicName} ({r.style})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-stone-400 mb-1">حالة الحساب</label>
            <div className="p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-emerald-400 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>حساب نشط ومفعل (Active)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gem Transactions History */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-stone-200 flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <span>سجل معاملات الجواهر</span>
        </h4>

        {loadingHistory ? (
          <div className="text-center py-4 text-xs text-stone-500">جاري التحميل...</div>
        ) : transactions.length === 0 ? (
          <p className="text-xs text-stone-500 text-center py-3">لا توجد حركات سابقة على رصيد الجواهر</p>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-850 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-stone-200 block">{tx.reason || tx.type}</span>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {new Date(tx.createdAt).toLocaleString('ar-EG')}
                  </span>
                </div>
                <div className="text-left font-mono">
                  <span className={`font-bold block ${tx.amount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} جوهرة
                  </span>
                  <span className="text-[10px] text-stone-500">
                    الرصيد: {tx.balanceAfter}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support Center & Tickets */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-stone-200 flex items-center gap-2">
            <Headphones className="w-4 h-4 text-emerald-400" />
            <span>مركز الدعم الفني والمساعدة</span>
          </h4>

          <button
            onClick={() => setShowNewTicketModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>تذكرة جديدة</span>
          </button>
        </div>

        {ticketSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{ticketSuccess}</span>
          </div>
        )}

        {tickets.length === 0 ? (
          <p className="text-xs text-stone-500 text-center py-3">
            لا توجد تذاكر دعم مفتوحة. إذا واجهت أي مشكلة يمكنك فتح تذكرة وسيتواصل معك الأدمن.
          </p>
        ) : (
          <div className="space-y-2.5">
            {tickets.map(t => (
              <div key={t.id} className="p-3 bg-stone-950 border border-stone-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-100">{t.subject}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    t.status === 'open' ? 'bg-amber-900/60 text-amber-300' : 'bg-emerald-900/60 text-emerald-300'
                  }`}>
                    {t.status === 'open' ? 'قيد المراجعة' : 'تم الرد والإغلاق'}
                  </span>
                </div>
                <p className="text-stone-400 text-[11px]">{t.message}</p>
                {t.adminReply && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-[11px]">
                    <strong className="block text-emerald-400 font-bold mb-0.5">رد الإدارة:</strong>
                    <span>{t.adminReply}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-5 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-amber-400" />
              <span>إنشاء تذكرة دعم جديدة</span>
            </h4>

            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="block text-xs text-stone-300 mb-1">قسم التذكرة</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value as any)}
                  className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-200 text-xs"
                >
                  <option value="technical">مشكلة تقنية أو في تصدير الفيديو</option>
                  <option value="reciter_audio">مشكلة في صوت قارئ محدد</option>
                  <option value="billing">الاشتراكات والجواهر</option>
                  <option value="feature">اقتراح ميزة جديدة</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-stone-300 mb-1">موضوع التذكرة</label>
                <input
                  type="text"
                  required
                  placeholder="عنوان المشكلة باختصار..."
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-stone-300 mb-1">تفاصيل الرسالة</label>
                <textarea
                  required
                  rows={4}
                  placeholder="اشرح المشكلة بالتفصيل (السورة، القارئ، نوع المتصفح)..."
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>إرسال التذكرة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-stone-900 border border-amber-500/40 rounded-3xl p-5 md:p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm md:text-base font-bold text-stone-100">تعديل الملف الشخصي والصورة</h4>
                  <p className="text-[11px] text-stone-400">خصص اسمك وصورتك الرمزية في تطبيق GM Quran Reels</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notifications */}
            {profileSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            {/* Live Preview Box */}
            <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-3.5 flex items-center gap-3.5">
              <img
                src={editAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editName || 'User')}`}
                alt="معاينة الصورة"
                className="w-14 h-14 rounded-2xl border-2 border-amber-500 shadow-lg object-cover bg-stone-900"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-stone-400 block">معاينة الملف الشخصي:</span>
                <p className="text-sm font-bold text-amber-300 truncate">{editName || 'الاسم الكريم'}</p>
                <p className="text-[11px] text-stone-400 font-mono truncate" dir="ltr">{user.email}</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Name Field */}
              <div>
                <label className="block text-xs font-bold text-stone-200 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>الاسم الكريم / اسم العرض</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="أدخل اسمك هنا..."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              {/* Avatar Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>اختر الصورة الشخصية الرمزية</span>
                  </label>
                  <span className="text-[10px] text-stone-400">مكتبة صور إسلامية راقية أو صورتك الخاصة</span>
                </div>

                {/* Categories Tabs */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-stone-950 rounded-xl border border-stone-800 text-[11px]">
                  {[
                    { id: 'islamic', label: 'معالم إسلامية' },
                    { id: 'quran', label: 'مصاحف ونقوش' },
                    { id: 'characters', label: 'شخصيات وقورة' },
                    { id: 'custom', label: 'رفع صورة' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAvatarTab(tab.id as any)}
                      className={`py-1.5 px-1 rounded-lg font-bold transition text-center cursor-pointer truncate ${
                        avatarTab === tab.id
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Category: Islamic Landmarks */}
                {avatarTab === 'islamic' && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 bg-stone-950/60 rounded-xl border border-stone-800">
                    {PRESET_AVATARS.filter(a => a.category === 'islamic').map(av => {
                      const isSelected = editAvatar === av.url;
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setEditAvatar(av.url)}
                          className={`relative p-1 rounded-xl border-2 transition cursor-pointer flex flex-col items-center group ${
                            isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-stone-800 hover:border-stone-600 bg-stone-900'
                          }`}
                        >
                          <img src={av.url} alt={av.name} className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-[9px] text-stone-300 mt-1 truncate w-full text-center">{av.name}</span>
                          {isSelected && (
                            <span className="absolute top-1 right-1 bg-amber-500 text-stone-950 rounded-full p-0.5">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Category: Quran & Art */}
                {avatarTab === 'quran' && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 bg-stone-950/60 rounded-xl border border-stone-800">
                    {PRESET_AVATARS.filter(a => a.category === 'quran').map(av => {
                      const isSelected = editAvatar === av.url;
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setEditAvatar(av.url)}
                          className={`relative p-1 rounded-xl border-2 transition cursor-pointer flex flex-col items-center group ${
                            isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-stone-800 hover:border-stone-600 bg-stone-900'
                          }`}
                        >
                          <img src={av.url} alt={av.name} className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-[9px] text-stone-300 mt-1 truncate w-full text-center">{av.name}</span>
                          {isSelected && (
                            <span className="absolute top-1 right-1 bg-amber-500 text-stone-950 rounded-full p-0.5">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Category: Characters */}
                {avatarTab === 'characters' && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 bg-stone-950/60 rounded-xl border border-stone-800">
                    {PRESET_AVATARS.filter(a => a.category === 'characters').map(av => {
                      const isSelected = editAvatar === av.url;
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setEditAvatar(av.url)}
                          className={`relative p-1 rounded-xl border-2 transition cursor-pointer flex flex-col items-center group ${
                            isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-stone-800 hover:border-stone-600 bg-stone-900'
                          }`}
                        >
                          <img src={av.url} alt={av.name} className="w-12 h-12 rounded-lg object-cover" />
                          <span className="text-[9px] text-stone-300 mt-1 truncate w-full text-center">{av.name}</span>
                          {isSelected && (
                            <span className="absolute top-1 right-1 bg-amber-500 text-stone-950 rounded-full p-0.5">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Category: Custom Upload & URL */}
                {avatarTab === 'custom' && (
                  <div className="space-y-3 p-3 bg-stone-950/80 rounded-xl border border-stone-800">
                    {/* File upload button */}
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 border-2 border-dashed border-amber-500/40 hover:border-amber-500 rounded-xl text-xs font-bold text-amber-300 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span>جارٍ معالجة وضغط الصورة...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-amber-400" />
                            <span>رفع صورة من جهازك / هاتفك (PNG, JPG, WebP)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Image URL input */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-stone-400 block">أو ضع رابط صورة مباشرة (URL):</span>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://example.com/avatar.jpg"
                          value={customAvatarUrl}
                          onChange={(e) => setCustomAvatarUrl(e.target.value)}
                          className="flex-1 p-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-amber-500 font-mono"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customAvatarUrl.trim()) {
                              setEditAvatar(customAvatarUrl.trim());
                              setCustomAvatarUrl('');
                            }
                          }}
                          className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-xl border border-stone-700 font-bold transition cursor-pointer"
                        >
                          تطبيق
                        </button>
                      </div>
                    </div>

                    {/* Initials avatar button */}
                    <div className="pt-1 border-t border-stone-800 flex items-center justify-between">
                      <span className="text-[11px] text-stone-400">توليد صورة رمزية بالأحرف:</span>
                      <button
                        type="button"
                        onClick={generateInitialsAvatar}
                        className="px-3 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>توليد بأحرف الاسم</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  disabled={savingProfile}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-lg shadow-amber-500/20"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جارٍ الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Button */}
      <div className="pt-2">
        <button
          onClick={async () => {
            await signOut(auth);
            onLogout();
          }}
          className="w-full py-3 px-4 bg-red-950/40 hover:bg-red-950/70 border border-red-500/30 text-red-300 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج من الحساب</span>
        </button>
      </div>
    </div>
  );
};
