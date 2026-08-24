(function (global) {
  var MAIN_CATEGORIES = [
    { id: "restauration", label: "Restauration & Bar", desc: "Bar, Restaurant, Snack, Boîte de nuit..." },
    { id: "boutique", label: "Boutique", desc: "Friperie, Vêtements, Électronique, Accessoires..." },
    { id: "commerce", label: "Commerce", desc: "Alimentation, Cosmétique, Marché..." },
    { id: "services", label: "Services & Entreprise", desc: "Imprimerie, Startup, Prestation..." }
  ];

  var ESTABLISHMENT_TYPES = [
    { value: "bar", label: "Bar", main: "restauration" },
    { value: "restaurant", label: "Restaurant", main: "restauration" },
    { value: "snack", label: "Snack Bar", main: "restauration" },
    { value: "nightclub", label: "Boîte de nuit", main: "restauration" },
    { value: "restaurant-bar", label: "Restaurant-Bar", main: "restauration" },
    { value: "hotel-bar", label: "Bar d'hôtel", main: "restauration" },
    { value: "friperie", label: "Friperie", main: "boutique" },
    { value: "boutique-vetements", label: "Boutique vêtements", main: "boutique" },
    { value: "boutique-chaussures", label: "Boutique chaussures", main: "boutique" },
    { value: "boutique-electronique", label: "Boutique électronique", main: "boutique" },
    { value: "boutique-accessoires", label: "Boutique accessoires", main: "boutique" },
    { value: "boutique-maison", label: "Articles maison & déco", main: "boutique" },
    { value: "boutique", label: "Boutique généraliste", main: "boutique" },
    { value: "commerce-alimentation", label: "Alimentation générale", main: "commerce" },
    { value: "commerce-cosmetique", label: "Cosmétique & beauté", main: "commerce" },
    { value: "commerce-marche", label: "Marché / stand", main: "commerce" },
    { value: "commerce", label: "Commerce général", main: "commerce" },
    { value: "services", label: "Services", main: "services" },
    { value: "other", label: "Autre", main: "services" }
  ];

  function getMainCategory(value) {
    for (var i = 0; i < ESTABLISHMENT_TYPES.length; i++) {
      if (ESTABLISHMENT_TYPES[i].value === value) return ESTABLISHMENT_TYPES[i].main;
    }
    return null;
  }

  function isShopProfile(profile) {
    if (!profile) return false;
    var main = getMainCategory(profile.establishmentType);
    return main === "boutique" || main === "commerce";
  }

  function isBoutiqueProfile(profile) {
    return getMainCategory(profile && profile.establishmentType) === "boutique";
  }

  function applyTheme(profile) {
    try {
      var body = document.body;
      if (!body) return;
      body.className = String(body.className || "").replace(/\blg-theme-\w+/g, "").replace(/\s+/g, " ").trim();
      if (profile && isShopProfile(profile)) body.className += " lg-theme-boutique";
    } catch (e) {}
  }

  function labels(profile) {
    if (isShopProfile(profile)) {
      return {
        business: "boutique",
        businessName: "Nom de la boutique",
        products: "Articles",
        stock: "Stock articles",
        sales: "Ventes",
        team: "Équipe",
        welcome: "Bonjour"
      };
    }
    return {
      business: "établissement",
      businessName: "Nom de l'établissement",
      products: "Produits",
      stock: "Stock",
      sales: "Vente",
      team: "Équipe",
      welcome: "Bonjour"
    };
  }

  global.NACK_LIGHT.establishment = {
    MAIN_CATEGORIES: MAIN_CATEGORIES,
    ESTABLISHMENT_TYPES: ESTABLISHMENT_TYPES,
    getMainCategory: getMainCategory,
    isShopProfile: isShopProfile,
    isBoutiqueProfile: isBoutiqueProfile,
    applyTheme: applyTheme,
    labels: labels
  };
})(window);
