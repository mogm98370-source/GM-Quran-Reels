import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, createUserProfile, getUserProfile, signInWithGoogle } from '../lib/firebase';
import { UserProfile } from '../types';
import { Lock, Mail, User, AlertCircle, CheckCircle2, Loader2, Sparkles, HelpCircle } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (profile: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // States
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showFirebaseGuide, setShowFirebaseGuide] = useState(false);

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setShowFirebaseGuide(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    clearMessages();

    try {
      const user = await signInWithGoogle();
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        profile = await createUserProfile(
          user.uid,
          user.displayName || user.email?.split('@')[0] || 'مستخدم',
          user.email || ''
        );
      }

      if (profile.accountStatus === 'disabled') {
        setErrorMessage('هذا الحساب معطل حالياً من قِبل الإدارة. يرجى التواصل مع الدعم الفني.');
        setGoogleLoading(false);
        return;
      }

      onSuccess(profile);
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      const code = err?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User closed the popup window
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMessage('طريقة تسجيل الدخول عبر Google غير مفعلة في لوحة تحكم Firebase.');
        setShowFirebaseGuide(true);
      } else {
        setErrorMessage(err?.message || 'تعذر إتمام الدخول بحساب Google، يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim() || !password) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      let profile = await getUserProfile(userCredential.user.uid);
      if (!profile) {
        // Create initial profile if missing
        profile = await createUserProfile(
          userCredential.user.uid,
          userCredential.user.displayName || email.split('@')[0],
          userCredential.user.email || email
        );
      }

      if (profile.accountStatus === 'disabled') {
        setErrorMessage('هذا الحساب معطل حالياً من قِبل الإدارة. يرجى التواصل مع الدعم الفني.');
        setLoading(false);
        return;
      }

      onSuccess(profile);
    } catch (err: any) {
      console.error('Login error:', err);
      const code = err?.code;
      if (code === 'auth/operation-not-allowed') {
        setErrorMessage('تسجيل الدخول بالبريد الإلكتروني وكلمة المرور غير مفعّل حالياً في مشروع Firebase. يمكنك الدخول فوراً بضغطة زر عبر حساب Google أعلاه، أو تفعيل مزوّد Email/Password من لوحة Firebase Console.');
        setShowFirebaseGuide(true);
      } else if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setErrorMessage('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('محاولات دخول كثيرة خاطئة، يرجى المحاولة لاحقاً');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('خطأ في الاتصال بالإنترنت');
      } else {
        setErrorMessage(err.message || 'فشل تسجيل الدخول، تحقق من البيانات');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!name.trim()) {
      setErrorMessage('يرجى كتابة الاسم بالكامل');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const profile = await createUserProfile(
        userCredential.user.uid,
        name.trim(),
        email.trim()
      );

      setSuccessMessage('تم إنشاء الحساب بنجاح! جاري الدخول...');
      setTimeout(() => {
        onSuccess(profile);
      }, 700);
    } catch (err: any) {
      console.error('Register error:', err);
      const code = err?.code;
      if (code === 'auth/operation-not-allowed') {
        setErrorMessage('إنشاء الحساب بالبريد وكلمة المرور غير مفعّل في Firebase. يمكنك الدخول المباشر السريع عبر Google بضغطة واحدة من الزر أعلاه.');
        setShowFirebaseGuide(true);
      } else if (code === 'auth/email-already-in-use') {
        setErrorMessage('هذا البريد الإلكتروني مسجل مسبقاً، يرجى تسجيل الدخول');
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('البريد الإلكتروني غير صالح');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('كلمة المرور ضعيفة جداً');
      } else {
        setErrorMessage(err.message || 'تعذر إنشاء الحساب');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني لإرسال الرابط');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني (Email Sent)');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      const code = err?.code;
      if (code === 'auth/operation-not-allowed') {
        setErrorMessage('خدمة استعادة كلمة المرور غير متاحة لأن موفر البريد غير مفعل في Firebase. يمكنك الدخول المباشر بحساب Google.');
        setShowFirebaseGuide(true);
      } else if (code === 'auth/user-not-found') {
        setErrorMessage('البريد غير مسجل لدينا (User Not Found)');
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('صيغة البريد الإلكتروني غير صحيحة (Invalid Email)');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('طلبات كثيرة متتالية، انتظر قليلاً (Too Many Requests)');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('خطأ في الشبكة (Network Error)');
      } else {
        setErrorMessage(err.message || 'تعذر إرسال رسالة الاستعادة');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-stone-900 border border-amber-500/20 rounded-2xl shadow-2xl p-6 sm:p-8 text-stone-100 relative overflow-hidden">
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-emerald-600/20 border border-amber-500/30 mb-3 shadow-inner">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-stone-50 tracking-wide font-sans">
            GM Quran Reels
          </h1>
          <p className="text-xs text-stone-400 mt-1 font-sans">
            منصة صناعة الريلز والفيديوهات القرآنية الاحترافية
          </p>
        </div>

        {/* Quick Google Sign-In Button */}
        {mode !== 'forgot' && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 bg-white hover:bg-stone-100 active:scale-[0.99] text-stone-900 font-bold rounded-xl text-sm transition flex items-center justify-center gap-3 cursor-pointer shadow-md disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-stone-700" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>
                {mode === 'login' ? 'المتابعة السريعة بحساب Google' : 'التسجيل الفوري بحساب Google'}
              </span>
            </button>

            <div className="relative flex py-3 items-center">
              <div className="flex-grow border-t border-stone-800"></div>
              <span className="flex-shrink mx-3 text-xs text-stone-500 font-medium">أو بالبريد الإلكتروني</span>
              <div className="flex-grow border-t border-stone-800"></div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/30 text-red-200 text-xs leading-relaxed flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {showFirebaseGuide && (
          <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>كيفية تفعيل تسجيل الدخول بالبريد (Email/Password)؟</span>
            </div>
            <p className="text-stone-300 leading-relaxed text-[11px]">
              1. افتح مشروعك في <strong>Firebase Console</strong>.
              <br />
              2. توجه إلى <strong>Authentication</strong> ثم تبويب <strong>Sign-in method</strong>.
              <br />
              3. فعّل مزوّد <strong>Email/Password</strong> واضغط Save.
            </p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-sm flex items-start gap-2 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-3 w-5 h-5 text-stone-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-11 pl-3 py-2.5 bg-stone-950/80 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-stone-300">كلمة المرور</label>
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('forgot'); }}
                  className="text-xs text-amber-400 hover:text-amber-300 transition"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute right-3.5 top-3 w-5 h-5 text-stone-500 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-11 pl-3 py-2.5 bg-stone-950/80 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-900/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تسجيل الدخول'}
            </button>

            <div className="pt-4 border-t border-stone-800/80 text-center">
              <span className="text-xs text-stone-400">ليس لديك حساب؟ </span>
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('register'); }}
                className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
              >
                إنشاء حساب جديد
              </button>
            </div>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                الاسم بالكامل
              </label>
              <div className="relative">
                <User className="absolute right-3.5 top-3 w-5 h-5 text-stone-500 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="مثال: محمد أحمد"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pr-11 pl-3 py-2.5 bg-stone-950/80 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-3 w-5 h-5 text-stone-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-11 pl-3 py-2.5 bg-stone-950/80 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-3 w-5 h-5 text-stone-500 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="6 أحرف على الأقل"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-11 pl-3 py-2.5 bg-stone-950/80 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-3 w-5 h-5 text-stone-500 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="أعد كتابة كلمة المرور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pr-11 pl-3 py-2.5 bg-stone-950/80 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-stone-50 font-bold rounded-xl text-sm shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إنشاء حساب جديد'}
            </button>

            <div className="pt-3 border-t border-stone-800/80 text-center">
              <span className="text-xs text-stone-400">لديك حساب بالفعل؟ </span>
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('login'); }}
                className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
              >
                تسجيل الدخول
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-stone-300 leading-relaxed">
              أدخل بريدك الإلكتروني المسجل، وسيقوم النظام بإرسال رابط رسمي لإعادة تعيين كلمة المرور عبر Firebase.
            </p>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-3 w-5 h-5 text-stone-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-11 pl-3 py-2.5 bg-stone-950/80 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال رابط الاستعادة'}
            </button>

            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('login'); }}
                className="text-xs font-medium text-stone-400 hover:text-stone-200 transition"
              >
                العودة إلى تسجيل الدخول
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
