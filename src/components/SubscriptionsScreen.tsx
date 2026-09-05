import React, { useState } from 'react';
import { UserProfile, SubscriptionPlan } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  increment 
} from 'firebase/firestore';
import { 
  Gem, 
  Check, 
  Sparkles, 
  Crown, 
  Zap, 
  ShieldCheck, 
  Gift, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  X,
  Info,
  Calendar,
  Film,
  SlidersHorizontal,
  Flame,
  ArrowRight
} from 'lucide-react';

export interface SubscriptionPlanConfig {
  planId: SubscriptionPlan;
  title: string;
  englishTitle: string;
  badge?: string;
  gems: number;
  duration: string;
  durationDays: number;
  dailyVideos: number;
  fps: number;
  watermark: boolean;
  watermarkLabel: string;
  description: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    planId: 'free',
    title: 'الباقة المجانية (Free)',
    englishTitle: 'Free Plan',
    gems: 0,
    duration: 'دائم',
    durationDays: 9999,
    dailyVideos: 3,
    fps: 20,
    watermark: true,
    watermarkLabel: 'مفعلة (تظهر علامة GM)',
    description: 'الخطة الأساسية للتجربة واستكشاف مميزات صناعة الفيديوهات القرآنية.',
    features: [
      '3 فيديوهات ريلز يومياً',
      'معدل إطارات 20 FPS',
      'علامة GM Quran Reels المائية',
      'الخلفيات والتلاوات الأساسية',
      'حفظ ومزامنة المشاريع'
    ]
  },
  {
    planId: 'weekly',
    title: 'الباقة الأسبوعية (Weekly)',
    englishTitle: 'Weekly Plan',
    badge: 'باقة سريعة',
    gems: 1000,
    duration: '7 أيام',
    durationDays: 7,
    dailyVideos: 9,
    fps: 30,
    watermark: false,
    watermarkLabel: 'بدون علامة مائية نهائياً',
    description: 'باقة ممتازة لصناع المحتوى الأسبوعي مع إزالة العلامة المائية وسرعة معالجة عالية.',
    features: [
      '9 فيديوهات ريلز يومياً',
      'معدل إطارات سلس 30 FPS',
      'بدون علامة مائية نهائياً',
      'فتح جميع الخلفيات الحصرية',
      'أولوية التصدير والمعالجة السريعة'
    ]
  },
  {
    planId: 'monthly',
    title: 'الباقة الشهرية (Monthly)',
    englishTitle: 'Monthly Plan',
    badge: 'الأكثر شعبية POPULAR',
    gems: 5000,
    duration: '30 يوماً',
    durationDays: 30,
    dailyVideos: 20,
    fps: 60,
    watermark: false,
    watermarkLabel: 'بدون علامة مائية نهائياً',
    description: 'الخيار المفضل للحسابات النشطة والمصممين المحترفين لإنتاج يومي فائق الجودة.',
    features: [
      '20 فيديو ريلز يومياً',
      'معدل إطارات فائق 60 FPS',
      'بدون علامة مائية إطلاقاً',
      'دقة تصدير عالية ونقاء صوتي فائق',
      'قوالب وخطوط حصرية وتأثيرات سينمائية'
    ]
  },
  {
    planId: 'yearly',
    title: 'الباقة السنوية (Yearly)',
    englishTitle: 'Yearly Plan',
    badge: 'BEST VALUE الأفضل قيمة',
    gems: 10000,
    duration: '365 يوماً',
    durationDays: 365,
    dailyVideos: 50,
    fps: 90,
    watermark: false,
    watermarkLabel: 'بدون علامة مائية نهائياً',
    description: 'القوة القصوى للإنتاج الضخم طوال العام بأعلى معدل إطارات وأفضل سعر وأولوية قصوى.',
    features: [
      '50 فيديو ريلز يومياً',
      'أقصى معدل إطارات 90 FPS فائق النعومة',
      'بدون أي علامة مائية نهائياً',
      'أولوية معالجة فورية فائقة السرعة في السيرفر',
      'وصول دائم لجميع الإضافات والتحديثات المستقبلية'
    ]
  }
];

interface SubscriptionsScreenProps {
  user: UserProfile;
  onRefreshUser: () => Promise<void>;
}

export const SubscriptionsScreen: React.FC<SubscriptionsScreenProps> = ({ user, onRefreshUser }) => {
  // Currently opened plan in details view / modal
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlan | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Plan pending activation confirmation in modal
  const [planToConfirm, setPlanToConfirm] = useState<SubscriptionPlanConfig | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Loading & feedback states
  const [isActivating, setIsActivating] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState('');

  // Redeem code states
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  // Open Details Modal for a specific plan
  const openPlanDetails = (planId: SubscriptionPlan) => {
    setPurchaseError('');
    setSelectedPlanId(planId);
    setShowDetailsModal(true);
  };

  // Close Details Modal
  const closePlanDetails = () => {
    setShowDetailsModal(false);
  };

  // Trigger Plan Activation flow
  const activatePlan = (planIdToActivate: SubscriptionPlan | null) => {
    setPurchaseError('');
    setPurchaseSuccess('');

    // 1. Ensure user is logged in
    if (!user || !user.uid) {
      setPurchaseError('يرجى تسجيل الدخول أولاً لتفعيل أي باقة اشتراك.');
      return;
    }

    if (!planIdToActivate) {
      setPurchaseError('يرجى تحديد خطة الاشتراك أولاً.');
      return;
    }

    // 2. Read selected plan data
    const targetPlan = SUBSCRIPTION_PLANS.find(p => p.planId === planIdToActivate);
    if (!targetPlan) {
      setPurchaseError('بيانات الخطة غير موجودة.');
      return;
    }

    if (targetPlan.planId === 'free') {
      setPurchaseError('الباقة المجانية هي الباقة الافتراضية المفعلة تلقائياً.');
      return;
    }

    // 3. Open Confirmation Modal with the exact plan data
    setPlanToConfirm(targetPlan);
    setShowConfirmModal(true);
  };

  // User confirmed the purchase in Confirmation Modal
  const handleConfirmActivation = async () => {
    if (!planToConfirm) return;

    setPurchaseError('');
    setPurchaseSuccess('');

    // Ensure user is still logged in
    if (!user || !user.uid) {
      setPurchaseError('يرجى تسجيل الدخول أولاً.');
      setShowConfirmModal(false);
      return;
    }

    // Check if user has sufficient gems
    if (user.gems < planToConfirm.gems) {
      setPurchaseError(
        `رصيدك الحالي (${user.gems.toLocaleString()} جوهرة) لا يكفي لتفعيل ${planToConfirm.title} (${planToConfirm.gems.toLocaleString()} جوهرة). يمكنك شحن رصيدك عبر كود هدية أو التواصل مع الدعم.`
      );
      setShowConfirmModal(false);
      return;
    }

    setIsActivating(true);

    try {
      const balanceBefore = user.gems;
      const balanceAfter = balanceBefore - planToConfirm.gems;

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + planToConfirm.durationDays);

      // Deduct gems and update user subscription in Firebase
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        subscriptionType: planToConfirm.planId,
        subscriptionStart: startDate.toISOString(),
        subscriptionEnd: endDate.toISOString(),
        dailyLimit: planToConfirm.dailyVideos,
        maxFPS: planToConfirm.fps,
        hasWatermark: planToConfirm.watermark,
        gems: balanceAfter,
        updatedAt: new Date().toISOString()
      });

      // Create transaction record in gemTransactions
      await addDoc(collection(db, 'gemTransactions'), {
        userId: user.uid,
        type: 'SUBSCRIPTION_PURCHASE',
        planId: planToConfirm.planId,
        amount: -planToConfirm.gems,
        balanceBefore,
        balanceAfter,
        reason: `تفعيل ${planToConfirm.title} (${planToConfirm.planId})`,
        createdAt: new Date().toISOString()
      });

      // Immediate UI update
      setPurchaseSuccess(
        `تهانينا! تم تفعيل ${planToConfirm.title} بنجاح. رصيدك المتبقي: ${balanceAfter.toLocaleString()} جوهرة.`
      );
      setShowConfirmModal(false);
      setShowDetailsModal(false);

      // Refresh user data from Firebase
      await onRefreshUser();
    } catch (err: any) {
      console.error('Subscription activation failed:', err);
      // If Firebase update fails, NO gems are deducted and error is displayed
      setPurchaseError('تعذر تفعيل الاشتراك ولم يتم خصم أي جواهر. خطأ: ' + (err.message || 'خطأ في الاتصال بالخادم'));
    } finally {
      setIsActivating(false);
    }
  };

  // Handle Redeem Code
  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemError('');
    setRedeemSuccess('');

    const cleanCode = redeemCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setRedeemError('يرجى كتابة كود الهدية أو القسيمة');
      return;
    }

    setRedeemLoading(true);
    try {
      const q = query(collection(db, 'gemCodes'), where('code', '==', cleanCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        setRedeemError('كود غير صالح (Invalid Code)');
        setRedeemLoading(false);
        return;
      }

      const codeDoc = snap.docs[0];
      const codeData = codeDoc.data();

      if (!codeData.isActive) {
        setRedeemError('هذا الكود معطل حالياً (Code Disabled)');
        setRedeemLoading(false);
        return;
      }

      if (codeData.usedCount >= codeData.maxUses) {
        setRedeemError('وصل هذا الكود للحد الأقصى للاستخدام (Max Uses Reached)');
        setRedeemLoading(false);
        return;
      }

      if (codeData.expiresAt) {
        const expiry = new Date(codeData.expiresAt);
        if (expiry < new Date()) {
          setRedeemError('انتهت صلاحية هذا الكود (Code Expired)');
          setRedeemLoading(false);
          return;
        }
      }

      // Valid! Add gems to user & update code usage & record transaction
      const amount = codeData.amount || 500;
      const userRef = doc(db, 'users', user.uid);
      const balanceBefore = user.gems || 0;
      const balanceAfter = balanceBefore + amount;

      await updateDoc(userRef, {
        gems: increment(amount),
        updatedAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'gemCodes', codeDoc.id), {
        usedCount: increment(1)
      });

      await addDoc(collection(db, 'gemTransactions'), {
        userId: user.uid,
        type: 'CODE_REDEEM',
        amount,
        balanceBefore,
        balanceAfter,
        reason: `شحن كود الهدية: ${cleanCode}`,
        createdAt: new Date().toISOString()
      });

      setRedeemSuccess(`تهانينا! تم إضافة ${amount.toLocaleString()} جوهرة بنجاح إلى رصيدك.`);
      setRedeemCodeInput('');
      await onRefreshUser();
    } catch (err: any) {
      console.error('Redeem error:', err);
      setRedeemError(err.message || 'حدث خطأ أثناء تفعيل الكود');
    } finally {
      setRedeemLoading(false);
    }
  };

  // Find currently selected plan config for details modal
  const selectedPlanConfig = selectedPlanId 
    ? SUBSCRIPTION_PLANS.find(p => p.planId === selectedPlanId) 
    : null;

  return (
    <div className="space-y-6 pb-24">
      {/* Gems & Current Subscription Header */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/40 border border-amber-500/30 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs text-amber-300 font-bold block mb-1">رصيد حسابك الحالي</span>
          <div className="flex items-center gap-2.5">
            <Gem className="w-8 h-8 text-amber-400 drop-shadow" />
            <span className="text-3xl font-black text-stone-50 font-mono">{user.gems.toLocaleString()}</span>
            <span className="text-sm font-bold text-amber-400">جوهرة</span>
          </div>
        </div>

        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-stone-400">الاشتراك الحالي:</span>
            <strong className="text-amber-400 font-bold text-sm uppercase px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
              {user.subscriptionType}
            </strong>
          </div>
          {user.subscriptionType !== 'free' && user.subscriptionEnd && (
            <div className="text-[11px] text-stone-400 flex items-center gap-1 font-mono">
              <Calendar className="w-3 h-3 text-stone-400" />
              <span>ينتهي في: {new Date(user.subscriptionEnd).toLocaleDateString('ar-EG')}</span>
            </div>
          )}
          <div className="text-[11px] text-stone-400 flex items-center gap-2 pt-1 border-t border-stone-800">
            <span>الحد اليومي: <strong className="text-stone-200">{user.dailyLimit || 3} ريلز</strong></span>
            <span>•</span>
            <span>السرعة: <strong className="text-stone-200">{user.maxFPS || 20} FPS</strong></span>
          </div>
        </div>
      </div>

      {/* Redeem Code Section */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
        <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
          <Gift className="w-4 h-4 text-emerald-400" />
          <span>شحن رصيد الجواهر عبر كود هدية (Gift / Redeem Code)</span>
        </h3>

        {redeemError && (
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{redeemError}</span>
          </div>
        )}

        {redeemSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{redeemSuccess}</span>
          </div>
        )}

        <form onSubmit={handleRedeemCode} className="flex gap-2">
          <input
            type="text"
            placeholder="أدخل كود الشحن هنا (مثال: QURAN1000)..."
            value={redeemCodeInput}
            onChange={(e) => setRedeemCodeInput(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-sm focus:outline-none focus:border-amber-500 uppercase font-mono tracking-wider"
          />
          <button
            type="submit"
            disabled={redeemLoading}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-sm rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {redeemLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'شحن الكود'}
          </button>
        </form>
      </div>

      {/* Global Alerts for Subscriptions */}
      {purchaseError && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 shadow-lg">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{purchaseError}</span>
        </div>
      )}

      {purchaseSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{purchaseSuccess}</span>
        </div>
      )}

      {/* Subscription Plans Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span>خطط الاشتراكات المميزة</span>
          </h3>
          <span className="text-xs text-stone-400">اختر الخطة المناسبة أو استعرض تفاصيلها الكاملة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = user.subscriptionType === plan.planId;
            const isFeatured = plan.planId === 'yearly';
            const isPopular = plan.planId === 'monthly';

            return (
              <div
                key={plan.planId}
                data-plan-id={plan.planId}
                className={`rounded-2xl p-5 border flex flex-col justify-between transition relative shadow-lg ${
                  isCurrent 
                    ? 'bg-amber-950/20 border-amber-500 shadow-amber-500/10' 
                    : isFeatured
                    ? 'bg-gradient-to-b from-stone-900 to-stone-900/90 border-amber-500/60 ring-1 ring-amber-500/30'
                    : isPopular
                    ? 'bg-stone-900 border-amber-500/40'
                    : 'bg-stone-900/80 border-stone-800 hover:border-stone-700'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-black text-[10px] shadow-md flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>{plan.badge}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h4 className="font-bold text-base text-stone-100">{plan.title}</h4>
                  </div>
                  <p className="text-[11px] text-stone-400 mb-3 line-clamp-2">{plan.description}</p>

                  <div className="my-3 p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/80">
                    {plan.gems === 0 ? (
                      <span className="text-2xl font-black text-emerald-400">مجاني</span>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-amber-400 font-mono">{plan.gems.toLocaleString()}</span>
                        <span className="text-xs text-stone-400">جوهرة / {plan.duration}</span>
                      </div>
                    )}
                  </div>

                  {/* Feature Highlights */}
                  <div className="space-y-2 border-t border-stone-800/80 pt-3 mb-5 text-xs text-stone-300">
                    <div className="flex items-center gap-2 text-stone-200 font-bold">
                      <Film className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{plan.dailyVideos} فيديوهات ريلز يومياً</span>
                    </div>
                    <div className="flex items-center gap-2 text-stone-200">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>معدل إطارات: {plan.fps} FPS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${plan.watermark ? 'text-amber-400' : 'text-emerald-400'}`} />
                      <span className={plan.watermark ? 'text-stone-300' : 'text-emerald-300 font-bold'}>
                        {plan.watermarkLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="space-y-2 pt-2 border-t border-stone-800/60">
                  {/* View Details Button: sets selectedPlanId and opens details view */}
                  <button
                    type="button"
                    onClick={() => openPlanDetails(plan.planId)}
                    className="w-full py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-stone-100 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-stone-700"
                  >
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    <span>تفاصيل الخطة الكاملة</span>
                  </button>

                  {/* Card Direct Activation Button: uses plan.planId from this card */}
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 bg-stone-800/90 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                    >
                      <Check className="w-4 h-4" />
                      <span>الخطة الحالية مفعلة</span>
                    </button>
                  ) : plan.planId === 'free' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 bg-stone-800/50 text-stone-400 rounded-xl text-xs font-bold"
                    >
                      الخطة الافتراضية
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => activatePlan(plan.planId)}
                      disabled={isActivating}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Crown className="w-4 h-4" />
                      <span>تفعيل ({plan.gems.toLocaleString()} جوهرة)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Plan Details Modal / View (Bound to selectedPlanId)          */}
      {/* ------------------------------------------------------------- */}
      {showDetailsModal && selectedPlanConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-stone-900 border border-amber-500/40 rounded-3xl p-5 md:p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-stone-100">{selectedPlanConfig.title}</h4>
                  <p className="text-xs text-stone-400 font-mono">{selectedPlanConfig.englishTitle} • {selectedPlanConfig.duration}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePlanDetails}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Plan Badge / Summary */}
            <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400">سعر الاشتراك:</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {selectedPlanConfig.gems === 0 ? 'مجاني' : selectedPlanConfig.gems.toLocaleString()}
                  </span>
                  {selectedPlanConfig.gems > 0 && <span className="text-xs text-amber-400">جوهرة</span>}
                </div>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">{selectedPlanConfig.description}</p>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-stone-400 block text-[11px]">عدد الفيديوهات اليومية:</span>
                <span className="font-bold text-stone-100 flex items-center gap-1.5 text-sm">
                  <Film className="w-4 h-4 text-amber-400" />
                  <span>{selectedPlanConfig.dailyVideos} ريلز / يوم</span>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-stone-400 block text-[11px]">معدل الإطارات (FPS):</span>
                <span className="font-bold text-stone-100 flex items-center gap-1.5 text-sm font-mono">
                  <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                  <span>{selectedPlanConfig.fps} FPS</span>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-stone-400 block text-[11px]">مدة الاشتراك:</span>
                <span className="font-bold text-stone-100 flex items-center gap-1.5 text-sm">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>{selectedPlanConfig.duration}</span>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-stone-400 block text-[11px]">حالة العلامة المائية:</span>
                <span className={`font-bold flex items-center gap-1.5 text-sm ${
                  selectedPlanConfig.watermark ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{selectedPlanConfig.watermarkLabel}</span>
                </span>
              </div>
            </div>

            {/* All Features List */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>المميزات والخدمات المشمولة في الخطة:</span>
              </h5>
              <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-3 space-y-2 text-xs text-stone-300 max-h-40 overflow-y-auto">
                {selectedPlanConfig.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Details Actions */}
            <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closePlanDetails}
                className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                إغلاق
              </button>

              {user.subscriptionType === selectedPlanId ? (
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <Check className="w-4 h-4" />
                  <span>هذه خطتك الحالية</span>
                </div>
              ) : selectedPlanConfig.planId === 'free' ? (
                <span className="text-xs text-stone-400">الخطة الافتراضية المجانية</span>
              ) : (
                /* MANDATORY: Uses selectedPlanId only! */
                <button
                  type="button"
                  onClick={() => activatePlan(selectedPlanId)}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crown className="w-4 h-4" />
                  <span>تفعيل اشتراك ({selectedPlanConfig.gems.toLocaleString()} جوهرة)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Confirmation Modal (نافذة التأكيد قبل الخصم والتفعيل)        */}
      {/* ------------------------------------------------------------- */}
      {showConfirmModal && planToConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-stone-900 border border-amber-500/50 rounded-3xl p-5 md:p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-stone-100">تأكيد تفعيل الاشتراك</h4>
                  <p className="text-[11px] text-stone-400">راجع تفاصيل الخطة بدقة قبل إتمام العملية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isActivating}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mandatory 6 confirmation items */}
            <div className="bg-stone-950 rounded-2xl p-4 border border-stone-800 space-y-3">
              {/* 1. Subscription Name */}
              <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
                <span className="text-xs text-stone-400">اسم الاشتراك:</span>
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  <span>{planToConfirm.title}</span>
                </span>
              </div>

              {/* 2. Price in Gems */}
              <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
                <span className="text-xs text-stone-400">السعر بالجواهر:</span>
                <span className="text-xs font-bold text-stone-100 font-mono flex items-center gap-1.5">
                  <Gem className="w-3.5 h-3.5 text-amber-400" />
                  <span>{planToConfirm.gems.toLocaleString()} جوهرة</span>
                </span>
              </div>

              {/* 3. Duration */}
              <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
                <span className="text-xs text-stone-400">مدة الاشتراك:</span>
                <span className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{planToConfirm.duration} ({planToConfirm.durationDays} يوم)</span>
                </span>
              </div>

              {/* 4. Daily Video Limit */}
              <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
                <span className="text-xs text-stone-400">عدد الفيديوهات اليومية:</span>
                <span className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  <span>{planToConfirm.dailyVideos} فيديوهات يومياً</span>
                </span>
              </div>

              {/* 5. FPS */}
              <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
                <span className="text-xs text-stone-400">معدل الإطارات (FPS):</span>
                <span className="text-xs font-bold text-blue-400 font-mono flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{planToConfirm.fps} FPS</span>
                </span>
              </div>

              {/* 6. Watermark Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400">حالة العلامة المائية:</span>
                <span className={`text-xs font-bold flex items-center gap-1.5 ${
                  planToConfirm.watermark ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{planToConfirm.watermarkLabel}</span>
                </span>
              </div>
            </div>

            {/* Gems Balance Check Section */}
            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-stone-400">
                <span>رصيدك الحالي:</span>
                <span className="font-mono text-stone-200">{user.gems.toLocaleString()} جوهرة</span>
              </div>
              <div className="flex items-center justify-between text-stone-400">
                <span>المبلغ المطلوب خصمه:</span>
                <span className="font-mono text-red-400">-{planToConfirm.gems.toLocaleString()} جوهرة</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-stone-800 font-bold">
                <span className="text-stone-300">الرصيد المتبقي بعد التفعيل:</span>
                <span className={`font-mono ${
                  user.gems >= planToConfirm.gems ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {(user.gems - planToConfirm.gems).toLocaleString()} جوهرة
                </span>
              </div>
            </div>

            {/* Insufficient balance warning */}
            {user.gems < planToConfirm.gems && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>رصيدك غير كافٍ لتفعيل هذه الخطة. يرجى شحن الرصيد أولاً.</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isActivating}
                className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmActivation}
                disabled={isActivating || user.gems < planToConfirm.gems}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black rounded-xl flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ الخصم وتفعيل الخطة...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تأكيد التفعيل والخصم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
