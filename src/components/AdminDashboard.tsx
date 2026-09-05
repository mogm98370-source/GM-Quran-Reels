import React, { useState, useEffect } from 'react';
import { UserProfile, GemCode, SupportTicket, Announcement, Reciter, Surah } from '../types';
import { 
  db, 
  isUserSuperAdmin, 
  SUPER_ADMIN_EMAIL, 
  PLAN_LIMITS, 
  logAdminAction 
} from '../lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  increment, 
  orderBy, 
  limit, 
  where 
} from 'firebase/firestore';
import { 
  ShieldAlert, 
  Users, 
  Video, 
  Gem, 
  Search, 
  Play, 
  Pause, 
  Volume2, 
  CheckCircle2, 
  AlertCircle, 
  PlusCircle, 
  Gift, 
  BellRing, 
  Headphones, 
  FileText, 
  Send, 
  Loader2, 
  Lock, 
  RefreshCw 
} from 'lucide-react';
import { RECITERS, getSurahAudioUrl, getSurahAudioFallbackUrl } from '../data/reciters';
import { SURAHS } from '../data/quranData';

interface AdminDashboardProps {
  user: UserProfile;
  onRefreshUser: () => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onRefreshUser }) => {
  const isSuper = isUserSuperAdmin(user.email);

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'audio_tester' | 'codes' | 'tickets' | 'announcements' | 'logs'>('overview');

  // Stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    freeUsers: 0,
    weeklyUsers: 0,
    monthlyUsers: 0,
    yearlyUsers: 0,
    totalGems: 0,
    totalVideos: 0,
    todayVideos: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Users management state
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [gemAdjustment, setGemAdjustment] = useState<number>(1000);
  const [gemReason, setGemReason] = useState('مكافأة من الإدارة');
  const [updatingUser, setUpdatingUser] = useState(false);

  // Audio Source Tester state
  const [testReciter, setTestReciter] = useState<Reciter>(RECITERS[13]); // Al-Hussary
  const [testSurah, setTestSurah] = useState<Surah>(SURAHS[0]); // Al-Fatihah
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState('');
  const [testDuration, setTestDuration] = useState(0);
  const [testIsPlaying, setTestIsPlaying] = useState(false);
  const testAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Codes state
  const [codesList, setCodesList] = useState<GemCode[]>([]);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeAmount, setNewCodeAmount] = useState(1000);
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(10);
  const [creatingCode, setCreatingCode] = useState(false);

  // Support Tickets state
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Load Overview Data
  const loadOverview = async () => {
    setLoadingStats(true);
    try {
      // 1. Users
      const userSnap = await getDocs(collection(db, 'users'));
      const uList = userSnap.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UserProfile));
      setUsersList(uList);

      let totalG = 0;
      let freeCount = 0;
      let weeklyCount = 0;
      let monthlyCount = 0;
      let yearlyCount = 0;

      uList.forEach(u => {
        totalG += u.gems || 0;
        if (u.subscriptionType === 'weekly') weeklyCount++;
        else if (u.subscriptionType === 'monthly') monthlyCount++;
        else if (u.subscriptionType === 'yearly') yearlyCount++;
        else freeCount++;
      });

      // 2. Videos
      const vidSnap = await getDocs(collection(db, 'videos'));
      const todayStr = new Date().toISOString().split('T')[0];
      let todayCount = 0;
      vidSnap.docs.forEach(d => {
        const data = d.data();
        if (data.createdAt && data.createdAt.startsWith(todayStr)) {
          todayCount++;
        }
      });

      setStats({
        totalUsers: uList.length,
        freeUsers: freeCount,
        weeklyUsers: weeklyCount,
        monthlyUsers: monthlyCount,
        yearlyUsers: yearlyCount,
        totalGems: totalG,
        totalVideos: vidSnap.size,
        todayVideos: todayCount
      });

      // 3. Codes
      const codeSnap = await getDocs(collection(db, 'gemCodes'));
      setCodesList(codeSnap.docs.map(d => ({ id: d.id, ...d.data() } as GemCode)));

      // 4. Tickets
      const tkSnap = await getDocs(query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')));
      setAllTickets(tkSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket)));

      // 5. Announcements
      const annSnap = await getDocs(collection(db, 'announcements'));
      setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));

      // 6. Logs
      const logSnap = await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(20)));
      setAuditLogs(logSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn('Admin load error:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isSuper) {
      loadOverview();
    }
  }, [isSuper]);

  // If NOT Super Admin: Access Denied
  if (!isSuper) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 bg-stone-900 border border-red-500/30 rounded-2xl text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-stone-100">غير مصرح بالدخول (Access Denied)</h3>
        <p className="text-xs text-stone-400 leading-relaxed">
          هذه الصفحة مخصصة للمشرف العام فقط ({SUPER_ADMIN_EMAIL}). حسابك الحالي غير مخول للوصول إلى لوحة التحكم.
        </p>
      </div>
    );
  }

  // Admin Actions: Modify Gems
  const handleAdjustGems = async (targetUser: UserProfile, delta: number) => {
    setUpdatingUser(true);
    try {
      const balanceBefore = targetUser.gems || 0;
      const balanceAfter = Math.max(0, balanceBefore + delta);

      await updateDoc(doc(db, 'users', targetUser.uid), {
        gems: balanceAfter,
        updatedAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'gemTransactions'), {
        userId: targetUser.uid,
        type: 'ADMIN_GRANT',
        amount: delta,
        balanceBefore,
        balanceAfter,
        reason: gemReason || 'تعديل يدوي من الأدمن',
        createdAt: new Date().toISOString()
      });

      await logAdminAction(user.uid, 'ADJUST_GEMS', targetUser.uid, { delta, balanceBefore, balanceAfter });

      // Update state
      setUsersList(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, gems: balanceAfter } : u));
      if (selectedUser?.uid === targetUser.uid) {
        setSelectedUser({ ...targetUser, gems: balanceAfter });
      }
      alert('تم تعديل رصيد الجواهر بنجاح!');
    } catch (err) {
      console.error('Failed to adjust gems:', err);
    } finally {
      setUpdatingUser(false);
    }
  };

  // Admin Actions: Change Plan
  const handleChangeUserPlan = async (targetUser: UserProfile, newPlan: any) => {
    setUpdatingUser(true);
    try {
      const planLimits = PLAN_LIMITS[newPlan as keyof typeof PLAN_LIMITS];
      const now = new Date();
      const end = new Date();
      end.setDate(end.getDate() + planLimits.durationDays);

      await updateDoc(doc(db, 'users', targetUser.uid), {
        subscriptionType: newPlan,
        maxFPS: planLimits.fps,
        dailyLimit: planLimits.dailyVideos,
        subscriptionStart: now.toISOString(),
        subscriptionEnd: newPlan === 'free' ? null : end.toISOString(),
        updatedAt: new Date().toISOString()
      });

      await logAdminAction(user.uid, 'CHANGE_SUBSCRIPTION', targetUser.uid, { newPlan });

      setUsersList(prev => prev.map(u => u.uid === targetUser.uid ? { 
        ...u, 
        subscriptionType: newPlan, 
        maxFPS: planLimits.fps, 
        dailyLimit: planLimits.dailyVideos 
      } : u));
      alert(`تم تغيير باقة المستخدم إلى ${newPlan.toUpperCase()}`);
    } catch (err) {
      console.error('Change plan error:', err);
    } finally {
      setUpdatingUser(false);
    }
  };

  // Admin Actions: Toggle Ban
  const handleToggleBan = async (targetUser: UserProfile) => {
    const newStatus = targetUser.accountStatus === 'disabled' ? 'active' : 'disabled';
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        accountStatus: newStatus,
        updatedAt: new Date().toISOString()
      });
      await logAdminAction(user.uid, 'TOGGLE_BAN', targetUser.uid, { status: newStatus });
      setUsersList(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, accountStatus: newStatus } : u));
      if (selectedUser?.uid === targetUser.uid) {
        setSelectedUser({ ...selectedUser, accountStatus: newStatus });
      }
    } catch (err) {
      console.error('Ban toggle error:', err);
    }
  };

  // Test Reciter Audio in Real Time
  const handleTestAudio = async () => {
    setTestStatus('testing');
    setTestError('');
    setTestIsPlaying(false);

    const primaryUrl = getSurahAudioUrl(testReciter, testSurah.number);
    const fallbackUrl = getSurahAudioFallbackUrl(testReciter, testSurah.number);

    if (testAudioRef.current) {
      testAudioRef.current.pause();
      testAudioRef.current.src = primaryUrl;
      testAudioRef.current.load();

      testAudioRef.current.oncanplay = () => {
        setTestStatus('success');
        setTestDuration(testAudioRef.current?.duration || 0);
      };

      testAudioRef.current.onerror = () => {
        // Try fallback
        if (testAudioRef.current) {
          testAudioRef.current.src = fallbackUrl;
          testAudioRef.current.load();
          testAudioRef.current.oncanplay = () => {
            setTestStatus('success');
            setTestDuration(testAudioRef.current?.duration || 0);
          };
          testAudioRef.current.onerror = () => {
            setTestStatus('failed');
            setTestError('تعذر تشغيل الصوت من المصدر الأساسي والاحتياطي');
          };
        }
      };
    }
  };

  // Create Gem Code
  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeName.trim()) return;

    setCreatingCode(true);
    try {
      const codeUpper = newCodeName.trim().toUpperCase();
      const newCodeObj: Omit<GemCode, 'id'> = {
        code: codeUpper,
        amount: Number(newCodeAmount),
        maxUses: Number(newCodeMaxUses),
        usedCount: 0,
        isActive: true,
        createdBy: user.email,
        createdAt: new Date().toISOString()
      };

      const ref = await addDoc(collection(db, 'gemCodes'), newCodeObj);
      setCodesList(prev => [{ id: ref.id, ...newCodeObj }, ...prev]);
      setNewCodeName('');
      alert(`تم إنشاء كود ${codeUpper} بنجاح!`);
    } catch (err) {
      console.error('Create code error:', err);
    } finally {
      setCreatingCode(false);
    }
  };

  // Reply to Ticket
  const handleReplyTicket = async (ticketId: string) => {
    if (!replyText.trim()) return;
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        adminReply: replyText.trim(),
        status: 'resolved',
        updatedAt: new Date().toISOString()
      });
      setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, adminReply: replyText.trim(), status: 'resolved' } : t));
      setReplyText('');
      setReplyingTicketId(null);
      alert('تم إرسال الرد وإغلاق التذكرة بنجاح!');
    } catch (err) {
      console.error('Reply ticket error:', err);
    }
  };

  // Filter users
  const filteredUsers = usersList.filter(u => 
    u.email.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
    u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
    u.uid.toLowerCase().includes(searchUserQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-28">
      {/* Hidden audio element for audio testing */}
      <audio ref={testAudioRef} />

      {/* Admin Header */}
      <div className="bg-stone-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-50">لوحة الإدارة والتحكم العليا (Super Admin)</h2>
            <p className="text-xs text-stone-400 font-mono" dir="ltr">{SUPER_ADMIN_EMAIL}</p>
          </div>
        </div>

        <button
          onClick={loadOverview}
          className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'overview', label: 'الإحصائيات العامة', icon: Users },
          { id: 'users', label: 'إدارة المستخدمين', icon: Users },
          { id: 'audio_tester', label: 'فاحص الصوتيات (Audio Tester)', icon: Headphones },
          { id: 'codes', label: 'أكواد الجواهر', icon: Gift },
          { id: 'tickets', label: 'تذاكر الدعم', icon: Headphones },
          { id: 'announcements', label: 'الإعلانات', icon: BellRing },
          { id: 'logs', label: 'سجل العمليات (Audit Logs)', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isActive 
                  ? 'bg-amber-600 text-stone-950 shadow-md' 
                  : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-xs text-stone-400 block mb-1">إجمالي المستخدمين</span>
              <span className="text-2xl font-bold text-stone-100">{stats.totalUsers}</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-xs text-stone-400 block mb-1">فيديوهات الريلز المنتجة</span>
              <span className="text-2xl font-bold text-emerald-400">{stats.totalVideos}</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-xs text-stone-400 block mb-1">فيديوهات اليوم</span>
              <span className="text-2xl font-bold text-amber-400">{stats.todayVideos}</span>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
              <span className="text-xs text-stone-400 block mb-1">إجمالي الجواهر بالنظام</span>
              <span className="text-2xl font-bold text-blue-400">{stats.totalGems.toLocaleString()}</span>
            </div>
          </div>

          {/* Subscriptions Breakdown */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-stone-200">توزيع اشتراكات المستخدمين</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-800">
                <span className="text-stone-400 block">مجاني (Free)</span>
                <span className="text-lg font-bold text-stone-200">{stats.freeUsers}</span>
              </div>
              <div className="p-3 bg-stone-950 rounded-xl border border-blue-900/40">
                <span className="text-blue-300 block">أسبوعي (Weekly)</span>
                <span className="text-lg font-bold text-blue-400">{stats.weeklyUsers}</span>
              </div>
              <div className="p-3 bg-stone-950 rounded-xl border border-emerald-900/40">
                <span className="text-emerald-300 block">شهري (Monthly)</span>
                <span className="text-lg font-bold text-emerald-400">{stats.monthlyUsers}</span>
              </div>
              <div className="p-3 bg-stone-950 rounded-xl border border-amber-900/40">
                <span className="text-amber-300 block">سنوي (Yearly)</span>
                <span className="text-lg font-bold text-amber-400">{stats.yearlyUsers}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو البريد الإلكتروني أو UID..."
              value={searchUserQuery}
              onChange={(e) => setSearchUserQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Users List */}
            <div className="md:col-span-2 bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredUsers.map(u => (
                <div
                  key={u.uid}
                  onClick={() => setSelectedUser(u)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    selectedUser?.uid === u.uid 
                      ? 'bg-amber-600/20 border-amber-500 text-amber-200' 
                      : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-100">{u.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-amber-400 uppercase">
                        {u.subscriptionType}
                      </span>
                      {u.accountStatus === 'disabled' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900 text-red-300">
                          معطل
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400 font-mono mt-0.5" dir="ltr">{u.email}</p>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-bold text-amber-400 block">{u.gems} 💎</span>
                    <span className="text-[10px] text-stone-500">{u.dailyVideosUsed}/{u.dailyLimit} فيديو</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected User Details & Admin Actions */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 space-y-4">
              {selectedUser ? (
                <>
                  <div className="border-b border-stone-800 pb-3">
                    <h4 className="font-bold text-sm text-stone-100">{selectedUser.name}</h4>
                    <p className="text-xs text-stone-400 font-mono" dir="ltr">{selectedUser.email}</p>
                    <p className="text-[10px] text-stone-500 font-mono mt-1">UID: {selectedUser.uid}</p>
                  </div>

                  {/* Add / Deduct Gems */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-300 block">إضافة / خصم جواهر</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={gemAdjustment}
                        onChange={(e) => setGemAdjustment(parseInt(e.target.value) || 0)}
                        className="w-24 p-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-100"
                      />
                      <button
                        onClick={() => handleAdjustGems(selectedUser, Math.abs(gemAdjustment))}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        + إضافة
                      </button>
                      <button
                        onClick={() => handleAdjustGems(selectedUser, -Math.abs(gemAdjustment))}
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-stone-50 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        - خصم
                      </button>
                    </div>
                  </div>

                  {/* Change Subscription Plan */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-300 block">تعديل باقة الاشتراك</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['free', 'weekly', 'monthly', 'yearly'].map(p => (
                        <button
                          key={p}
                          onClick={() => handleChangeUserPlan(selectedUser, p)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                            selectedUser.subscriptionType === p 
                              ? 'bg-amber-600 text-stone-950' 
                              : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ban / Disable Account */}
                  <div className="pt-2 border-t border-stone-800">
                    <button
                      onClick={() => handleToggleBan(selectedUser)}
                      className={`w-full py-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                        selectedUser.accountStatus === 'disabled'
                          ? 'bg-emerald-600 text-stone-950'
                          : 'bg-red-950 border border-red-500/40 text-red-300'
                      }`}
                    >
                      {selectedUser.accountStatus === 'disabled' ? 'تفعيل الحساب (Unban)' : 'تعطيل الحساب (Ban User)'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-stone-500 text-center py-8">
                  اختر مستخدماً من القائمة لعرض بياناته وتعديل رصيده واشتراكه
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIO SOURCE TESTER (CRITICAL AS REQUESTED) */}
      {activeTab === 'audio_tester' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <Headphones className="w-4 h-4 text-amber-400" />
              <span>فاحص مصادر التلاوات الصوتية (Live Audio Source Tester)</span>
            </h4>
            <p className="text-xs text-stone-400 mt-1">
              أداة خاصة للإدارة للتأكد من عمل روابط CDN لجميع القراء الـ 19 وخاصة: الحصري، الرفاعي، الحذيفي.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-300 mb-1">اختر القارئ للفحص:</label>
              <select
                value={testReciter.id}
                onChange={(e) => {
                  const r = RECITERS.find(x => x.id === e.target.value);
                  if (r) setTestReciter(r);
                  setTestStatus('idle');
                }}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-200 text-xs"
              >
                {RECITERS.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.arabicName} ({r.style})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-stone-300 mb-1">اختر السورة للفحص:</label>
              <select
                value={testSurah.number}
                onChange={(e) => {
                  const s = SURAHS.find(x => x.number === parseInt(e.target.value));
                  if (s) setTestSurah(s);
                  setTestStatus('idle');
                }}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-200 text-xs"
              >
                {SURAHS.map(s => (
                  <option key={s.number} value={s.number}>
                    {s.number}. سورة {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Test Buttons & Status */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleTestAudio}
              disabled={testStatus === 'testing'}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>فحص مباشر وتشغيل التلاوة</span>
            </button>

            {testStatus === 'success' && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
                <span>المصدر يعمل بنجاح! المدة: {Math.round(testDuration)} ثانية</span>
              </div>
            )}

            {testStatus === 'failed' && (
              <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-950/40 border border-red-500/30 px-3 py-1.5 rounded-xl">
                <AlertCircle className="w-4 h-4" />
                <span>{testError}</span>
              </div>
            )}
          </div>

          {/* Source URLs inspection */}
          <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 text-xs font-mono space-y-1 text-stone-400 overflow-x-auto">
            <div>
              <span className="text-amber-400 font-sans font-bold">المصدر الأساسي: </span>
              <span>{getSurahAudioUrl(testReciter, testSurah.number)}</span>
            </div>
            <div>
              <span className="text-emerald-400 font-sans font-bold">المصدر الاحتياطي: </span>
              <span>{getSurahAudioFallbackUrl(testReciter, testSurah.number)}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GEM CODES */}
      {activeTab === 'codes' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateCode} className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-400" />
              <span>إنشاء كود هدية جديد</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-stone-300 mb-1">اسم الكود (Code)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: EID2025"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value)}
                  className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs text-stone-300 mb-1">عدد الجواهر</label>
                <input
                  type="number"
                  required
                  value={newCodeAmount}
                  onChange={(e) => setNewCodeAmount(parseInt(e.target.value) || 0)}
                  className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-stone-300 mb-1">الحد الأقصى للمرات</label>
                <input
                  type="number"
                  required
                  value={newCodeMaxUses}
                  onChange={(e) => setNewCodeMaxUses(parseInt(e.target.value) || 1)}
                  className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingCode}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>حفظ وتفعيل الكود</span>
            </button>
          </form>

          {/* Codes List */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-stone-200">الأكواد المنشأة</h4>
            <div className="space-y-2">
              {codesList.map(c => (
                <div key={c.id} className="p-3 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="font-bold text-amber-400 text-sm block">{c.code}</span>
                    <span className="text-stone-400 font-sans">
                      {c.amount} جوهرة • استُخدم {c.usedCount} من {c.maxUses}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    c.isActive ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                  }`}>
                    {c.isActive ? 'مفعل' : 'معطل'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SUPPORT TICKETS */}
      {activeTab === 'tickets' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-stone-100">تذاكر الدعم الفني الواردة من المستخدمين</h4>

          {allTickets.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-6">لا توجد تذاكر دعم حالياً</p>
          ) : (
            <div className="space-y-3">
              {allTickets.map(t => (
                <div key={t.id} className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <h5 className="font-bold text-stone-100 text-sm">{t.subject}</h5>
                      <span className="text-[11px] text-stone-400 font-mono" dir="ltr">{t.userEmail}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.status === 'open' ? 'bg-amber-900/60 text-amber-300' : 'bg-emerald-900/60 text-emerald-300'
                    }`}>
                      {t.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                    </span>
                  </div>

                  <p className="text-stone-300 leading-relaxed bg-stone-900 p-2.5 rounded-lg">
                    {t.message}
                  </p>

                  {t.adminReply && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200">
                      <strong className="block text-emerald-400 mb-0.5 font-bold">ردك السابق:</strong>
                      <span>{t.adminReply}</span>
                    </div>
                  )}

                  {t.status === 'open' && (
                    <div className="pt-2 space-y-2">
                      <textarea
                        rows={2}
                        placeholder="اكتب ردك للمستخدم هنا..."
                        value={replyingTicketId === t.id ? replyText : ''}
                        onFocus={() => setReplyingTicketId(t.id)}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg text-stone-100 text-xs focus:outline-none focus:border-amber-500"
                      />
                      {replyingTicketId === t.id && (
                        <button
                          onClick={() => handleReplyTicket(t.id)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs rounded-lg cursor-pointer"
                        >
                          إرسال الرد وإغلاق التذكرة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-stone-200">سجل عمليات المشرفين (Audit Trail)</h4>
          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id} className="p-2.5 bg-stone-950 rounded-xl border border-stone-800 text-xs font-mono flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-400">{log.action}</span>
                  <span className="text-stone-400 mr-2">Target: {log.targetUserId}</span>
                </div>
                <span className="text-[10px] text-stone-500">{new Date(log.createdAt).toLocaleString('ar-EG')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
