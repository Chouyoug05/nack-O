import { getMainCategory, isFoodBusiness, isBoutique, isServiceBusiness } from "@/constants/establishmentTypes";

export type DashboardActionKey =
  | "sales"
  | "stock"
  | "reports"
  | "profile"
  | "team"
  | "bar-connectee"
  | "events"
  | "customers"
  | "logout";

export type DashboardCopy = {
  kpiSales: string;
  kpiStock: string;
  kpiTeam: string;
  tiles: Record<
    DashboardActionKey,
    { title: string; hint?: string; description?: string }
  >;
  catalogPageTitle: string;
  catalogPageSubtitle: string;
};

const restoCopy: DashboardCopy = {
  kpiSales: "Vente du jour",
  kpiStock: "Produits en stock",
  kpiTeam: "Équipe active",
  catalogPageTitle: "Menu Digital",
  catalogPageSubtitle: "Gérez les commandes QR de vos clients",
  tiles: {
    stock: { title: "Stock" },
    sales: { title: "Vente" },
    reports: { title: "Rapport" },
    team: { title: "Équipe", hint: "Gérer" },
    "bar-connectee": { title: "Menu Digital", hint: "QR" },
    events: { title: "Événements" },
    customers: { title: "Clients", description: "Favoris & Fidélité" },
    profile: { title: "Mon Profil" },
    logout: { title: "Déconnexion" },
  },
};

const commerceCopy: DashboardCopy = {
  kpiSales: "Ventes du jour",
  kpiStock: "Articles en stock",
  kpiTeam: "Équipe active",
  catalogPageTitle: "Catalogue QR",
  catalogPageSubtitle: "Partagez votre catalogue et recevez les commandes clients",
  tiles: {
    stock: { title: "Stock", hint: "Rayons" },
    sales: { title: "Caisse" },
    reports: { title: "Rapport" },
    team: { title: "Équipe", hint: "Gérer" },
    "bar-connectee": { title: "Catalogue QR", hint: "QR" },
    events: { title: "Événements" },
    customers: { title: "Clients", description: "Fidélité" },
    profile: { title: "Mon Profil" },
    logout: { title: "Déconnexion" },
  },
};

const boutiqueCopy: DashboardCopy = {
  kpiSales: "Ventes du jour",
  kpiStock: "Articles en stock",
  kpiTeam: "Équipe active",
  catalogPageTitle: "Catalogue QR",
  catalogPageSubtitle: "Présentez vos articles et recevez les commandes",
  tiles: {
    stock: { title: "Articles" },
    sales: { title: "Vente" },
    reports: { title: "Rapport" },
    team: { title: "Équipe", hint: "Gérer" },
    "bar-connectee": { title: "Catalogue QR", hint: "QR" },
    events: { title: "Événements" },
    customers: { title: "Clients", description: "Fidélité" },
    profile: { title: "Mon Profil" },
    logout: { title: "Déconnexion" },
  },
};

const servicesCopy: DashboardCopy = {
  kpiSales: "Recettes du jour",
  kpiStock: "Prestations",
  kpiTeam: "Équipe active",
  catalogPageTitle: "Catalogue QR",
  catalogPageSubtitle: "Présentez vos prestations",
  tiles: {
    stock: { title: "Prestations" },
    sales: { title: "Vente" },
    reports: { title: "Rapport" },
    team: { title: "Équipe", hint: "Gérer" },
    "bar-connectee": { title: "Catalogue QR", hint: "QR" },
    events: { title: "Événements" },
    customers: { title: "Clients" },
    profile: { title: "Mon Profil" },
    logout: { title: "Déconnexion" },
  },
};

function applySubtypeHints(copy: DashboardCopy, establishmentType: string): DashboardCopy {
  const tiles = { ...copy.tiles };
  if (establishmentType === "commerce-cosmetique") {
    tiles.stock = { title: "Stock", hint: "Beauté" };
    tiles["bar-connectee"] = { title: "Catalogue QR", hint: "Beauté" };
  } else if (establishmentType === "commerce-alimentation") {
    tiles.stock = { title: "Stock", hint: "Alimentation" };
  } else if (establishmentType === "commerce-marche") {
    tiles.stock = { title: "Stock", hint: "Marché" };
    tiles.sales = { title: "Caisse", hint: "Stand" };
  } else if (establishmentType === "boutique-vetements" || establishmentType === "friperie") {
    tiles.stock = { title: "Articles", hint: "Mode" };
  } else if (establishmentType === "boutique-electronique") {
    tiles.stock = { title: "Articles", hint: "Électro" };
  }
  return { ...copy, tiles };
}

export function getDashboardCopy(establishmentType?: string | null): DashboardCopy {
  const type = establishmentType || "";
  const main = getMainCategory(type)?.id;

  let base: DashboardCopy;
  if (main === "restauration" || (!type && isFoodBusiness(type))) {
    base = restoCopy;
  } else if (main === "commerce") {
    base = commerceCopy;
  } else if (main === "boutique") {
    base = boutiqueCopy;
  } else if (main === "services" || isServiceBusiness(type)) {
    base = servicesCopy;
  } else if (isBoutique(type)) {
    base = commerceCopy;
  } else {
    base = restoCopy;
  }

  return applySubtypeHints(base, type);
}

/** Tuiles visibles selon le domaine — uniquement ce qui existe vraiment */
export function getVisibleDashboardKeys(establishmentType?: string | null): DashboardActionKey[] {
  const type = establishmentType || "";
  const food = isFoodBusiness(type);
  const boutiqueOrCommerce = isBoutique(type);
  const service = isServiceBusiness(type);

  if (service && !boutiqueOrCommerce && !food) {
    return ["stock", "sales", "reports", "team", "customers", "profile", "logout"];
  }

  const keys: DashboardActionKey[] = ["stock", "sales", "reports", "team"];

  if (food || boutiqueOrCommerce) {
    keys.push("bar-connectee");
  }
  if (food) {
    keys.push("events");
  }

  keys.push("customers", "profile", "logout");
  return keys;
}
