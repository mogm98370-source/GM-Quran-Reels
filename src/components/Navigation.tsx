import React from 'react';
import { Home, PlusCircle, FolderHeart, Gem, User, ShieldAlert } from 'lucide-react';
import { isUserSuperAdmin } from '../lib/firebase';
import { UserProfile } from '../types';

export type NavTab = 'home' | 'create' | 'projects' | 'subscriptions' | 'account' | 'admin';

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: UserProfile | null;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, user }) => {
  const isSuper = isUserSuperAdmin(user?.email);

  const navItems = [
    { id: 'home' as NavTab, label: 'الرئيسية', icon: Home },
    { id: 'create' as NavTab, label: 'إنشاء ريل', icon: PlusCircle, isMain: true },
    { id: 'projects' as NavTab, label: 'مشاريعي', icon: FolderHeart },
    { id: 'subscriptions' as NavTab, label: 'الاشتراكات', icon: Gem },
    { id: 'account' as NavTab, label: 'حسابي', icon: User },
  ];

  if (isSuper) {
    navItems.push({ id: 'admin' as NavTab, label: 'لوحة الأدمن', icon: ShieldAlert, isMain: false });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950/90 backdrop-blur-lg border-t border-stone-800/80 px-2 py-1.5 sm:py-2">
      <div className="max-w-xl mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          if (item.isMain) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="relative -top-3 flex flex-col items-center group cursor-pointer"
                title={item.label}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform transform group-hover:scale-105 ${
                  isActive 
                    ? 'bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 shadow-amber-600/30' 
                    : 'bg-gradient-to-tr from-amber-500 to-amber-600 text-stone-950 shadow-amber-500/20'
                }`}>
                  <Icon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className={`text-[11px] font-bold mt-1 ${isActive ? 'text-amber-400' : 'text-stone-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          const isAccount = item.id === 'account';

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
                isActive ? 'text-amber-400 font-bold' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {isAccount && user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="حسابي"
                  className={`w-5 h-5 rounded-full object-cover mb-1 border ${
                    isActive ? 'border-amber-400 ring-1 ring-amber-400' : 'border-stone-700'
                  }`}
                />
              ) : (
                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              )}
              <span className="text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
