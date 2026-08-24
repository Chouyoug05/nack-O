/** Miroir de src/utils/subscription.ts pour le mode léger */
(function (global) {
  var PLANS = {
    free: {
      name: "Gratuit", price: 0,
      features: { products: true, productLimit: 10, sales: true, stock: true, reports: true, team: false, disbursementRequest: false, events: true, eventsLimit: 0, eventsExtraPrice: 1000 }
    },
    transition: {
      name: "Standard", price: 3000,
      features: { products: true, sales: true, stock: true, reports: true, team: false, disbursementRequest: false, events: true, eventsLimit: 5, eventsExtraPrice: 1000 }
    },
    "transition-pro-max": {
      name: "Premium", price: 7500,
      features: { products: true, sales: true, stock: true, reports: true, team: true, disbursementRequest: true, events: true, eventsExtraPrice: 1000 }
    }
  };

  var DURATIONS = [
    { value: "month", label: "1 mois" },
    { value: "quarter", label: "3 mois" },
    { value: "semester", label: "6 mois (-10%)" },
    { value: "year", label: "12 mois (2 mois offerts)" }
  ];

  function getCurrentPlan(profile) {
    if (!profile) return "expired";
    var now = Date.now();
    if (profile.plan === "trial" || profile.plan === "expired" || profile.plan === "free") return "free";
    if ((profile.plan === "active" || profile.subscriptionType) && profile.subscriptionEndsAt && profile.subscriptionEndsAt > now) {
      return profile.subscriptionType || "transition";
    }
    return "free";
  }

  function hasFeature(profile, feature) {
    var plan = getCurrentPlan(profile);
    var pf = PLANS[plan];
    if (!pf) pf = PLANS.free;
    if (plan === "free" || plan === "trial" || plan === "expired") pf = PLANS.free;
    return pf.features[feature] === true;
  }

  function calcPrice(planKey, duration) {
    var base = (PLANS[planKey] && PLANS[planKey].price) || 3000;
    if (duration === "quarter") return base * 3;
    if (duration === "semester") return Math.round(base * 6 * 0.9);
    if (duration === "year") return base * 10;
    return base;
  }

  function canCreateEvent(profile) {
    var plan = getCurrentPlan(profile);
    var limit = 0, extra = 1000;
    if (plan === "transition") limit = 5;
    else if (plan === "transition-pro-max") limit = Infinity;
    var count = profile && profile.eventsCount || 0;
    if (limit === Infinity) return { allowed: true };
    if (count >= limit) return { allowed: true, needsPayment: true, extraPrice: extra };
    return { allowed: true };
  }

  function getEventsCount(profile) {
    if (!profile) return 0;
    return profile.eventsCount || 0;
  }

  function isDashboardBlocked(profile) {
    if (!profile) return true;
    var plan = getCurrentPlan(profile);
    if (plan !== "free") return false;
    if (profile.plan === "trial" && profile.trialEndsAt && profile.trialEndsAt > Date.now()) return false;
    return profile.plan === "expired";
  }

  function planLabel(profile) {
    var p = getCurrentPlan(profile);
    if (p === "free" && profile && profile.plan === "trial") return "Essai (7 jours)";
    return (PLANS[p] && PLANS[p].name) || "Expiré";
  }

  global.NACK_LIGHT.subscription = {
    PLANS: PLANS, DURATIONS: DURATIONS,
    getCurrentPlan: getCurrentPlan, hasFeature: hasFeature,
    calcPrice: calcPrice, canCreateEvent: canCreateEvent,
    getEventsCount: getEventsCount, isDashboardBlocked: isDashboardBlocked,
    planLabel: planLabel
  };
})(window);
