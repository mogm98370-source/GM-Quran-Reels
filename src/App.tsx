import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, getUserProfile, createUserProfile, db } from './lib/firebase';
import { UserProfile, ReelProject } from './types';
import { doc, updateDoc } from 'firebase/firestore';

// Components
import { AuthModal } from './components/AuthModal';
import { Navigation, NavTab } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { CreateReelWizard } from './components/CreateReelWizard';
import { ProjectsScreen } from './components/ProjectsScreen';
import { SubscriptionsScreen } from './components/SubscriptionsScreen';
import { AccountScreen } from './components/AccountScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { Sparkles, Gem, Loader2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [editingProject, setEditingProject] = useState<ReelProject | null>(null);

  // Refresh user profile helper
  const refreshUserProfile = async () => {
    if (!auth.currentUser) return;
    const profile = await getUserProfile(auth.currentUser.uid);
    if (profile) {
      // Check if day changed to reset daily video limit
      const lastResetDate = (profile as any).lastDailyReset;
      const today = new Date().toISOString().split('T')[0];
      if (lastResetDate !== today) {
        try {
          await updateDoc(doc(db, 'users', profile.uid), {
            dailyVideosUsed: 0,
            lastDailyReset: today
          });
          profile.dailyVideosUsed = 0;
        } catch (e) {
          console.warn('Daily reset check error:', e);
        }
      }
      setCurrentUser(profile);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          let profile = await getUserProfile(firebaseUser.uid);
          if (!profile) {
            profile = await createUserProfile(
              firebaseUser.uid,
              firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستخدم',
              firebaseUser.email || ''
            );
          }
          setCurrentUser(profile);
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Profile load error:', err);
        if (firebaseUser) {
          setCurrentUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستخدم',
            email: firebaseUser.email || '',
            avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(firebaseUser.displayName || 'User')}&backgroundColor=065f46`,
            accountStatus: 'active',
            subscriptionType: 'free',
            subscriptionStart: new Date().toISOString(),
            subscriptionEnd: '',
            gems: 0,
            dailyVideosUsed: 0,
            lastUsageDate: new Date().toISOString().split('T')[0],
            maxFPS: 20,
            dailyLimit: 3,
            hasWatermark: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Loading initial auth state
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-amber-400 gap-3">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-sm font-bold text-stone-200">جاري تحميل GM Quran Reels...</span>
      </div>
    );
  }

  // Not logged in: Show real Firebase Auth Modal
  if (!currentUser) {
    return <AuthModal onSuccess={(profile) => setCurrentUser(profile)} />;
  }

  // Account disabled check
  if (currentUser.accountStatus === 'disabled') {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-stone-900 border border-red-500/40 rounded-2xl p-6 text-center space-y-4">
          <h2 className="text-lg font-bold text-red-400">الحساب معطل حالياً</h2>
          <p className="text-xs text-stone-300 leading-relaxed">
            تم تعطيل هذا الحساب من قِبل إدارة التطبيق. إذا كنت تعتقد أن هذا تم عن طريق الخطأ، يرجى التواصل مع المشرف.
          </p>
          <button
            onClick={() => auth.signOut()}
            className="px-4 py-2 bg-stone-800 text-stone-200 text-xs font-bold rounded-xl"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Top Global Bar */}
      <header className="sticky top-0 z-30 bg-stone-950/85 backdrop-blur-md border-b border-stone-800/80 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => { setEditingProject(null); setActiveTab('home'); }} 
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-stone-950 shadow-md group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base font-black text-stone-100 leading-none tracking-tight">
                GM Quran Reels
              </h1>
              <span className="text-[10px] text-amber-400 font-semibold leading-tight block mt-0.5">
                تطبيق صناعة الريلز القرآنية
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Gems counter pill */}
            <button
              onClick={() => setActiveTab('subscriptions')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900 hover:bg-stone-850 border border-amber-500/30 text-xs font-bold text-amber-400 cursor-pointer transition shadow-inner"
            >
              <Gem className="w-3.5 h-3.5" />
              <span>{currentUser.gems.toLocaleString()}</span>
            </button>

            {/* Profile Avatar Button */}
            <button
              onClick={() => setActiveTab('account')}
              className="relative p-0.5 rounded-full border border-amber-500/40 hover:border-amber-400 transition cursor-pointer group"
              title="الملف الشخصي والحساب"
            >
              <img
                src={currentUser.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}`}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover bg-stone-900"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 pt-5">
        {activeTab === 'home' && (
          <HomeScreen
            user={currentUser}
            onCreateReel={() => {
              setEditingProject(null);
              setActiveTab('create');
            }}
            onOpenProjects={() => setActiveTab('projects')}
            onOpenSubscriptions={() => setActiveTab('subscriptions')}
            onSelectProject={(proj) => {
              setEditingProject(proj);
              setActiveTab('create');
            }}
          />
        )}

        {activeTab === 'create' && (
          <CreateReelWizard
            user={currentUser}
            initialProject={editingProject}
            onFinished={() => {
              setEditingProject(null);
              setActiveTab('projects');
              refreshUserProfile();
            }}
            onRefreshUser={refreshUserProfile}
            onOpenSubscriptions={() => setActiveTab('subscriptions')}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsScreen
            user={currentUser}
            onOpenProject={(proj) => {
              setEditingProject(proj);
              setActiveTab('create');
            }}
            onCreateNew={() => {
              setEditingProject(null);
              setActiveTab('create');
            }}
          />
        )}

        {activeTab === 'subscriptions' && (
          <SubscriptionsScreen
            user={currentUser}
            onRefreshUser={refreshUserProfile}
          />
        )}

        {activeTab === 'account' && (
          <AccountScreen
            user={currentUser}
            onLogout={() => setCurrentUser(null)}
            onRefreshUser={refreshUserProfile}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            user={currentUser}
            onRefreshUser={refreshUserProfile}
          />
        )}
      </main>

      {/* Persistent Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'create' && activeTab !== 'create') {
            setEditingProject(null);
          }
          setActiveTab(tab);
        }}
        user={currentUser}
      />
    </div>
  );
}
