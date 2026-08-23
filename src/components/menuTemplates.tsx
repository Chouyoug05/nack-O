import { useState } from "react";
import { Package, Plus, Search, ShoppingBag, X, Minus, Star, Flame, Sparkles, Tag, Clock, MapPin, ChevronRight, Utensils, Wine, Coffee, Pizza, Music, Store, Briefcase, Heart, Shirt, Footprints, Gem, Smartphone, Home, Droplet, Watch, ShoppingBasket, Gift, Glasses, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MenuThemeConfig } from "@/types/menuTheme";

export interface TemplateProduct {
  id: string;
  name: string;
  price: number | string;
  imageUrl?: string;
  category?: string;
  description?: string;
}

export interface TemplateCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface TemplateProps {
  establishment: { establishmentName: string; logoUrl?: string; bannerUrl?: string; slogan?: string } | null;
  filteredProducts: TemplateProduct[];
  cart: TemplateCartItem[];
  total: number;
  searchTerm: string;
  activeCategoryTab: string;
  availableCategories: string[];
  menuTheme: MenuThemeConfig;
  isFoodBusiness: boolean;
  onSearchChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onAddToCart: (p: TemplateProduct) => void;
  onSelectProduct: (p: TemplateProduct) => void;
  onCheckout: () => void;
  onShowCart?: () => void;
  backgroundStyle: React.CSSProperties;
}

const getPrice = (p: TemplateProduct) =>
  typeof p.price === "number" ? p.price : parseFloat(String(p.price)) || 0;

const ProductImage = ({ product, className, isDark }: { product: TemplateProduct; className?: string; isDark?: boolean }) => {
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt={product.name} className={className || "w-full h-full object-cover"} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />;
  }
  return (
    <div className={"w-full h-full flex items-center justify-center " + (isDark ? "bg-gray-800" : "bg-gray-100")}>
      <Package className={"w-12 h-12 " + (isDark ? "text-gray-600" : "text-gray-300")} />
    </div>
  );
};

const CartBar = ({ cart, total, pc, onCheckout }: { cart: TemplateCartItem[]; total: number; pc: string; onCheckout: () => void }) => {
  if (cart.length === 0) return null;
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl p-3 sm:p-4 z-30">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">{count} article(s)</p>
          <p className="text-xl sm:text-2xl font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} FCFA</p>
        </div>
        <button onClick={onCheckout} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 text-white px-6 sm:px-8 h-12 rounded-full font-bold shadow-lg" style={{ backgroundColor: pc }}>
          <ShoppingBag className="w-4 h-4 mr-2" /> Commander
        </button>
      </div>
    </div>
  );
};

const CategoryPills = ({ categories, active, onChange, pc }: { categories: string[]; active: string; onChange: (v: string) => void; pc: string }) => (
  <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
    <button onClick={() => onChange("all")} className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
      style={active === "all" ? { backgroundColor: pc, color: "white" } : { backgroundColor: "rgba(255,255,255,0.8)", color: "#666" }}>
      Tout
    </button>
    {categories.map(cat => (
      <button key={cat} onClick={() => onChange(cat)} className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
        style={active === cat ? { backgroundColor: pc, color: "white" } : { backgroundColor: "rgba(255,255,255,0.8)", color: "#666" }}>
        {cat}
      </button>
    ))}
  </div>
);

// ============================================
// TEMPLATE 1: RESTAURANT CLASSIQUE
// ============================================
export const RestaurantClassicTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, isFoodBusiness, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={backgroundStyle}>
      <header className="relative overflow-hidden" style={{ backgroundColor: pc }}>
        <div className="relative container mx-auto px-4 py-8 sm:py-14 text-center">
          {establishment?.logoUrl && (
            <img src={establishment.logoUrl} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-4 border-4 border-white/30 object-cover shadow-xl" />
          )}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>
            {establishment?.establishmentName || "Notre Menu"}
          </h1>
          <div className="w-16 h-1 mx-auto mb-3 rounded-full" style={{ backgroundColor: sc }} />
          <p className="text-white/70 text-sm sm:text-base italic">Decouvrez nos specialites</p>
        </div>
      </header>

      {cart.length > 0 && (
        <div className="sticky top-0 z-20 shadow-md" style={{ backgroundColor: sc }}>
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <span className="text-white font-medium text-sm">{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</span>
            <span className="text-white font-bold">{total.toLocaleString("fr-FR")} FCFA</span>
          </div>
        </div>
      )}

      <main className="container mx-auto px-3 sm:px-4 py-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input placeholder="Rechercher..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-10 bg-white/90 rounded-full" />
        </div>
        <CategoryPills categories={availableCategories} active={activeCategoryTab} onChange={onCategoryChange} pc={pc} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden border border-gray-100 cursor-pointer">
              <div className="relative h-48 overflow-hidden">
                <ProductImage product={product} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: pc }}>
                  {product.category}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg mb-1" style={{ color: pc, fontFamily: "Georgia, serif" }}>{product.name}</h3>
                {product.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{product.description}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold" style={{ color: sc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform"
                    style={{ backgroundColor: pc }}>
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && <div className="text-center py-12"><p className="text-gray-500">Aucun produit disponible.</p></div>}
      </main>
      <CartBar cart={cart} total={total} pc={pc} onCheckout={onCheckout} />
    </div>
  );
};

// ============================================
// TEMPLATE 2: BAR / LOUNGE (Dark + Neon)
// ============================================
export const BarLoungeTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, isFoodBusiness, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={{ ...backgroundStyle, color: "#fff" }}>
      <header className="border-b border-white/10" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className="container mx-auto px-4 py-6 flex items-center gap-4">
          {establishment?.logoUrl && (
            <img src={establishment.logoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: pc }} />
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{establishment?.establishmentName || "Menu"}</h1>
            <p className="text-xs uppercase tracking-widest" style={{ color: sc }}>Cocktails & Drinks</p>
          </div>
        </div>
      </header>

      {cart.length > 0 && (
        <div className="sticky top-0 z-20 border-b border-white/10 backdrop-blur-md" style={{ backgroundColor: "rgba(26,26,46,0.95)" }}>
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <span className="text-sm" style={{ color: sc }}>{cart.reduce((s, i) => s + i.quantity, 0)} dans le panier</span>
            <span className="font-bold text-white">{total.toLocaleString("fr-FR")} FCFA</span>
          </div>
        </div>
      )}

      <main className="container mx-auto px-3 sm:px-4 py-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <Input placeholder="Rechercher..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-lg" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          <button onClick={() => onCategoryChange("all")} className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-all"
            style={activeCategoryTab === "all" ? { backgroundColor: pc, borderColor: pc, color: "white" } : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)" }}>
            Tout
          </button>
          {availableCategories.map(cat => (
            <button key={cat} onClick={() => onCategoryChange(cat)} className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-all"
              style={activeCategoryTab === cat ? { backgroundColor: pc, borderColor: pc, color: "white" } : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)" }}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer group"
              style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
              <div className="relative h-32 sm:h-40 overflow-hidden">
                <ProductImage product={product} isDark className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="p-3">
                <h3 className="font-bold text-sm text-white mb-1 line-clamp-1">{product.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: sc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform"
                    style={{ backgroundColor: sc }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && <div className="text-center py-12"><p className="text-gray-500">Aucun produit disponible.</p></div>}
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 p-3 sm:p-4 z-30 backdrop-blur-md" style={{ backgroundColor: "rgba(26,26,46,0.98)" }}>
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400">{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</p>
              <p className="text-xl font-bold" style={{ color: sc }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <button onClick={onCheckout} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 px-6 h-12 rounded-full font-bold text-black" style={{ backgroundColor: sc }}>
              <ShoppingBag className="w-4 h-4 mr-2" /> Commander
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// TEMPLATE 3: CAFE COZY
// ============================================
export const CafeCozyTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, isFoodBusiness, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={backgroundStyle}>
      <header className="py-8 text-center border-b-2" style={{ backgroundColor: sc + "20", borderColor: sc }}>
        {establishment?.logoUrl && (
          <img src={establishment.logoUrl} alt="" className="w-16 h-16 rounded-full mx-auto mb-3 border-4 object-cover" style={{ borderColor: pc }} />
        )}
        <h1 className="text-2xl sm:text-3xl font-bold italic" style={{ color: pc, fontFamily: "Georgia, serif" }}>
          {establishment?.establishmentName || "Notre Cafe"}
        </h1>
        <p className="text-sm mt-1" style={{ color: pc + "99" }}>Fait maison avec amour</p>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input placeholder="Rechercher..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-10 rounded-lg" style={{ borderColor: sc }} />
        </div>
        <CategoryPills categories={availableCategories} active={activeCategoryTab} onChange={onCategoryChange} pc={pc} />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="bg-white rounded-lg border-2 overflow-hidden cursor-pointer hover:shadow-lg transition-all" style={{ borderColor: sc + "40" }}>
              <div className="h-32 sm:h-36 overflow-hidden">
                <ProductImage product={product} className="w-full h-full object-cover" />
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm mb-1 line-clamp-2" style={{ color: pc }}>{product.name}</h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-base" style={{ color: sc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                    style={{ backgroundColor: pc }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && <div className="text-center py-12"><p className="text-gray-500">Aucun produit disponible.</p></div>}
      </main>
      <CartBar cart={cart} total={total} pc={pc} onCheckout={onCheckout} />
    </div>
  );
};

// ============================================
// TEMPLATE 4: BOUTIQUE MINIMAL (E-commerce)
// ============================================
export const BoutiqueMinimalTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, isFoodBusiness, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={backgroundStyle}>
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {establishment?.logoUrl && <img src={establishment.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />}
            <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: pc }}>{establishment?.establishmentName || "Boutique"}</h1>
          </div>
          <div className="relative">
            <ShoppingBag className="w-5 h-5" style={{ color: pc }} />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold" style={{ backgroundColor: sc }}>
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input placeholder="Rechercher..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-9 h-9 text-sm rounded-lg" />
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          <button onClick={() => onCategoryChange("all")} className="px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap border"
            style={activeCategoryTab === "all" ? { backgroundColor: pc, borderColor: pc, color: "white" } : { borderColor: "#e5e5e5", color: "#666" }}>
            Tout
          </button>
          {availableCategories.map(cat => (
            <button key={cat} onClick={() => onCategoryChange(cat)} className="px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap border"
              style={activeCategoryTab === cat ? { backgroundColor: pc, borderColor: pc, color: "white" } : { borderColor: "#e5e5e5", color: "#666" }}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="bg-white rounded-lg border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all group">
              <div className="aspect-square overflow-hidden bg-gray-50">
                <ProductImage product={product} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-2.5">
                <p className="text-xs text-gray-400 mb-0.5">{product.category}</p>
                <h3 className="font-medium text-sm line-clamp-2 mb-1 text-gray-900">{product.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: pc }}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && <div className="text-center py-12"><p className="text-gray-500">Aucun produit disponible.</p></div>}
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 z-30">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</p>
              <p className="text-lg font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <button onClick={onCheckout} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 text-white px-6 h-10 rounded-lg font-medium text-sm" style={{ backgroundColor: pc }}>
              <ShoppingBag className="w-4 h-4 mr-2" /> Panier
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// TEMPLATE 5: BOUTIQUE LUXE (Dark + Gold)
// ============================================
export const BoutiqueLuxuryTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, isFoodBusiness, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={{ ...backgroundStyle, color: "#fff" }}>
      <header className="py-10 text-center border-b" style={{ borderColor: pc + "30" }}>
        {establishment?.logoUrl && (
          <img src={establishment.logoUrl} alt="" className="w-16 h-16 rounded-full mx-auto mb-4 border-2 object-cover" style={{ borderColor: pc }} />
        )}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-wider" style={{ color: pc, fontFamily: "Georgia, serif" }}>
          {establishment?.establishmentName || "Collection"}
        </h1>
        <div className="w-24 h-px mx-auto mt-4" style={{ backgroundColor: pc }} />
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <Input placeholder="Rechercher..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-none" />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-hide justify-center">
          <button onClick={() => onCategoryChange("all")} className="px-4 py-2 text-xs uppercase tracking-widest font-medium whitespace-nowrap border-b-2 transition-all"
            style={activeCategoryTab === "all" ? { borderColor: pc, color: pc } : { borderColor: "transparent", color: "rgba(255,255,255,0.4)" }}>
            Tout
          </button>
          {availableCategories.map(cat => (
            <button key={cat} onClick={() => onCategoryChange(cat)} className="px-4 py-2 text-xs uppercase tracking-widest font-medium whitespace-nowrap border-b-2 transition-all"
              style={activeCategoryTab === cat ? { borderColor: pc, color: pc } : { borderColor: "transparent", color: "rgba(255,255,255,0.4)" }}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="cursor-pointer group">
              <div className="aspect-[3/4] overflow-hidden mb-3 bg-white/5 border border-white/10">
                <ProductImage product={product} isDark className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <h3 className="font-medium text-sm tracking-wide text-white mb-1">{product.name}</h3>
              <div className="flex items-center justify-between">
                <span className="font-bold" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                  className="text-xs uppercase tracking-wider px-3 py-1 border hover:bg-white/10 transition-colors"
                  style={{ borderColor: pc, color: pc }}>
                  Ajouter
                </button>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && <div className="text-center py-12"><p className="text-gray-500">Aucun produit disponible.</p></div>}
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t p-4 z-30" style={{ backgroundColor: "#0D0D0D", borderColor: pc + "30" }}>
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</p>
              <p className="text-xl font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <button onClick={onCheckout} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 px-8 h-12 font-medium tracking-wider text-black border-0" style={{ backgroundColor: pc }}>
              COMMANDER
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// TEMPLATE 6: RESTAURANT MODERNE
// ============================================
export const RestaurantModernTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, isFoodBusiness, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={backgroundStyle}>
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {establishment?.logoUrl && <img src={establishment.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
            <div>
              <h1 className="text-lg font-bold" style={{ color: pc }}>{establishment?.establishmentName || "Menu"}</h1>
              <p className="text-xs text-gray-400">Commandez en ligne</p>
            </div>
          </div>
          <div className="relative">
            <ShoppingBag className="w-5 h-5" style={{ color: pc }} />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold" style={{ backgroundColor: sc }}>
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
        </div>
        <div className="container mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button onClick={() => onCategoryChange("all")} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={activeCategoryTab === "all" ? { backgroundColor: pc, color: "white" } : { backgroundColor: "#f3f4f6", color: "#666" }}>
              Tout
            </button>
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => onCategoryChange(cat)} className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={activeCategoryTab === cat ? { backgroundColor: pc, color: "white" } : { backgroundColor: "#f3f4f6", color: "#666" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input placeholder="Rechercher un plat..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-10 bg-gray-50 border-0 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all">
              <div className="h-28 sm:h-32 overflow-hidden">
                <ProductImage product={product} className="w-full h-full object-cover" />
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-1 text-gray-900">{product.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{product.category}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-sm" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: sc }}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && <div className="text-center py-12"><p className="text-gray-500">Aucun produit disponible.</p></div>}
      </main>
      <CartBar cart={cart} total={total} pc={pc} onCheckout={onCheckout} />
    </div>
  );
};

// ============================================
// TEMPLATE 7: BOUTIQUE GRID PRO
// ============================================
export const BoutiqueGridTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, isFoodBusiness, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={backgroundStyle}>
      <header className="sticky top-0 z-20 bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {establishment?.logoUrl && <img src={establishment.logoUrl} alt="" className="w-8 h-8 rounded object-cover" />}
            <h1 className="text-base font-bold" style={{ color: pc }}>{establishment?.establishmentName || "Boutique"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="w-5 h-5" style={{ color: pc }} />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold" style={{ backgroundColor: sc }}>
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input placeholder="Rechercher..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-9 h-9 text-sm rounded-md" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 scrollbar-hide">
          <button onClick={() => onCategoryChange("all")} className="px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
            style={activeCategoryTab === "all" ? { backgroundColor: pc, color: "white" } : { backgroundColor: "#e5e7eb", color: "#374151" }}>
            Tout
          </button>
          {availableCategories.map(cat => (
            <button key={cat} onClick={() => onCategoryChange(cat)} className="px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
              style={activeCategoryTab === cat ? { backgroundColor: pc, color: "white" } : { backgroundColor: "#e5e7eb", color: "#374151" }}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="bg-white rounded-md border border-gray-200 overflow-hidden cursor-pointer hover:border-gray-300 transition-all">
              <div className="aspect-square overflow-hidden bg-gray-50">
                <ProductImage product={product} className="w-full h-full object-cover" />
              </div>
              <div className="p-2">
                <p className="text-xs text-gray-400 truncate">{product.category}</p>
                <h3 className="font-medium text-xs line-clamp-2 text-gray-900 mt-0.5">{product.name}</h3>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-bold text-xs" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-white"
                    style={{ backgroundColor: sc }}>
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && <div className="text-center py-12"><p className="text-gray-500">Aucun produit disponible.</p></div>}
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 z-30">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</p>
              <p className="text-lg font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <button onClick={onCheckout} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 text-white px-6 h-10 rounded-md font-medium text-sm" style={{ backgroundColor: pc }}>
              <ShoppingBag className="w-4 h-4 mr-2" /> Commander
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// TEMPLATE 7: BOUTIQUE (Catalogue produits)
// ============================================
export const BoutiqueTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={backgroundStyle}>
      <header className="relative overflow-hidden" style={{ backgroundColor: pc }}>
        <div className="relative container mx-auto px-4 py-6 sm:py-10 text-center">
          {establishment?.logoUrl && (
            <img src={establishment.logoUrl} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-3 border-4 border-white/30 object-cover shadow-lg" />
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow">{establishment?.establishmentName || "Boutique"}</h1>
          <p className="text-white/80 text-sm mt-1">Notre catalogue</p>
        </div>
      </header>

      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-3 py-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="search" placeholder="Rechercher un produit..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": pc + "40" } as React.CSSProperties} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => onCategoryChange("all")} className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={activeCategoryTab === "all" ? { backgroundColor: pc, color: "white" } : { backgroundColor: "#f3f4f6", color: "#4b5563" }}>
              Tout
            </button>
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => onCategoryChange(cat)} className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={activeCategoryTab === cat ? { backgroundColor: pc, color: "white" } : { backgroundColor: "#f3f4f6", color: "#4b5563" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-3 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="bg-white rounded-lg border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all">
              <div className="aspect-square overflow-hidden bg-gray-50">
                <ProductImage product={product} className="w-full h-full object-cover" />
              </div>
              <div className="p-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{product.category}</p>
                <h3 className="font-medium text-sm line-clamp-2 text-gray-900 mt-0.5">{product.name}</h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-sm" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: sc }}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucun produit disponible.</p>
          </div>
        )}
      </main>

      <CartBar cart={cart} total={total} pc={pc} onCheckout={onCheckout} />
    </div>
  );
};

// ============================================
// TEMPLATE 8: SERVICES (Prestations)
// ============================================
export const ServiceTemplate = (props: TemplateProps) => {
  const { establishment, filteredProducts, cart, total, activeCategoryTab, availableCategories, menuTheme, onSearchChange, onCategoryChange, onAddToCart, onSelectProduct, onCheckout, backgroundStyle } = props;
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;

  return (
    <div className="min-h-screen pb-28" style={backgroundStyle}>
      <header className="relative overflow-hidden" style={{ backgroundColor: pc }}>
        <div className="relative container mx-auto px-4 py-8 sm:py-12 text-center">
          {establishment?.logoUrl && (
            <img src={establishment.logoUrl} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-3 border-4 border-white/30 object-cover shadow-lg" />
          )}
          <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow">{establishment?.establishmentName || "Services"}</h1>
          <p className="text-white/80 text-sm mt-1">Nos prestations</p>
        </div>
      </header>

      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b shadow-sm">
        <div className="container mx-auto px-3 py-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="search" placeholder="Rechercher une prestation..." value={props.searchTerm} onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": pc + "40" } as React.CSSProperties} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => onCategoryChange("all")} className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={activeCategoryTab === "all" ? { backgroundColor: pc, color: "white" } : { backgroundColor: "#f3f4f6", color: "#4b5563" }}>
              Tout
            </button>
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => onCategoryChange(cat)} className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={activeCategoryTab === cat ? { backgroundColor: pc, color: "white" } : { backgroundColor: "#f3f4f6", color: "#4b5563" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-3 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} onClick={() => onSelectProduct(product)} role="button" tabIndex={0}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-lg transition-all">
              {product.imageUrl && (
                <div className="aspect-video overflow-hidden bg-gray-50">
                  <ProductImage product={product} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{product.category}</p>
                    <h3 className="font-semibold text-base text-gray-900 mt-0.5">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="font-bold text-lg" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} FCFA</span>
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="px-4 py-2 rounded-full text-sm font-medium text-white shadow-sm"
                    style={{ backgroundColor: sc }}>
                    Réserver
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune prestation disponible.</p>
          </div>
        )}
      </main>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl p-4 z-30">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">{cart.reduce((s, i) => s + i.quantity, 0)} prestation(s)</p>
              <p className="text-xl font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <button onClick={onCheckout} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 text-white px-6 h-12 rounded-full font-bold shadow-lg" style={{ backgroundColor: pc }}>
              Réserver
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// TEMPLATE 9: NACK MODERN (Default - Adaptive)
// Template moderne et adaptatif pour tous types d'établissement
// Mobile-first, responsive, professionnel
// ============================================

interface NackModernTemplateProps extends TemplateProps {
  establishmentType?: string;
}

const getEstablishmentIcon = (type?: string) => {
  switch (type) {
    case 'restaurant': return Utensils;
    case 'bar': return Wine;
    case 'cafe': return Coffee;
    case 'snack': return Pizza;
    case 'nightclub': return Music;
    case 'boutique': return Store;
    case 'services': return Briefcase;
    default: return Store;
  }
};

const getCategoryIcon = (category: string, type?: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('entrée') || cat.includes('entree')) return Sparkles;
  if (cat.includes('plat') || cat.includes('repas')) return Utensils;
  if (cat.includes('grillade') || cat.includes('braisé')) return Flame;
  if (cat.includes('dessert') || cat.includes('glace')) return Star;
  if (cat.includes('boisson') || cat.includes('bière') || cat.includes('cocktail') || cat.includes('vin')) return Wine;
  if (cat.includes('snack') || cat.includes('burger') || cat.includes('sandwich')) return Pizza;
  if (cat.includes('café') || cat.includes('the') || cat.includes('thé')) return Coffee;
  if (cat.includes('vêtement') || cat.includes('chaussure') || cat.includes('accessoire')) return ShoppingBag;
  if (cat.includes('vip') || cat.includes('bouteille')) return Sparkles;
  if (cat.includes('shot') || cat.includes('spiritueux')) return Wine;
  return Package;
};

export const NackModernTemplate = (props: NackModernTemplateProps) => {
  const { 
    establishment, 
    filteredProducts, 
    cart, 
    total, 
    activeCategoryTab, 
    availableCategories, 
    menuTheme, 
    establishmentType,
    onSearchChange, 
    onCategoryChange, 
    onAddToCart, 
    onSelectProduct, 
    onCheckout,
    onShowCart,
    backgroundStyle 
  } = props;
  
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;
  const bg = menuTheme.backgroundColor;
  const EstIcon = getEstablishmentIcon(establishmentType);
  
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const isDark = bg.startsWith('#1') || bg.startsWith('#0') || bg.startsWith('#2');

  const handleShare = async () => {
    try {
      const shareData = {
        title: establishment?.establishmentName || 'Menu',
        text: `Découvrez le menu de ${establishment?.establishmentName || 'cet établissement'} !`,
        url: window.location.href,
      };
      if ((navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch { /* ignore CSP/sandbox */ }
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: bg }}>
      {/* BANNIÈRE (si disponible) */}
      {establishment?.bannerUrl && (
        <div className="relative h-40 sm:h-52 overflow-hidden">
          <img 
            src={establishment.bannerUrl} 
            alt="" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end gap-3">
            {establishment?.logoUrl ? (
              <img 
                src={establishment.logoUrl} 
                alt="" 
                className="w-14 h-14 rounded-xl object-cover shadow-lg border-2 border-white/30"
              />
            ) : (
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: pc }}
              >
                <EstIcon className="w-7 h-7 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-bold text-lg text-white truncate drop-shadow">
                {establishment?.establishmentName || "Menu"}
              </h1>
              {establishment?.slogan && (
                <p className="text-xs text-white/80 truncate">{establishment.slogan}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER MODERNE */}
      <header className={`sticky ${establishment?.bannerUrl ? 'top-0' : 'top-0'} z-40 backdrop-blur-lg border-b`} style={{ 
        backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
      }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo + Nom (si pas de bannière) */}
            {!establishment?.bannerUrl && (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {establishment?.logoUrl ? (
                  <img 
                    src={establishment.logoUrl} 
                    alt="" 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover shadow-sm flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: pc }}
                  >
                    <EstIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-base sm:text-lg truncate" style={{ color: isDark ? '#fff' : '#1a1a1a' }}>
                    {establishment?.establishmentName || "Menu"}
                  </h1>
                  {establishment?.slogan ? (
                    <p className="text-xs truncate" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}>
                      {establishment.slogan}
                    </p>
                  ) : (
                    <p className="text-xs truncate" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}>
                      {establishmentType === 'restaurant' ? 'Restaurant' : 
                       establishmentType === 'bar' ? 'Bar & Lounge' :
                       establishmentType === 'snack' ? 'Snack Bar' :
                       establishmentType === 'nightclub' ? 'Boîte de nuit' :
                       establishmentType === 'cafe' ? 'Café' :
                       establishmentType === 'boutique' ? 'Boutique' :
                       'Menu digital'}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Si bannière, juste le type */}
            {establishment?.bannerUrl && (
              <div className="flex-1" />
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Bouton partage */}
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                }}
              >
                <Share2 className="w-4 h-4" style={{ color: isDark ? '#fff' : pc }} />
              </button>
              
              {/* Bouton panier */}
              {cartCount > 0 && (
                <button
                  onClick={onShowCart || onCheckout}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-transform active:scale-95"
                  style={{ backgroundColor: pc }}
                >
                  <ShoppingBag className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">{total.toLocaleString("fr-FR")}</span>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: sc }}>
                    {cartCount}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* BARRE DE RECHERCHE */}
      <div className="sticky top-[68px] sm:top-[76px] z-30 px-4 py-3 backdrop-blur-lg" style={{ 
        backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'
      }}>
        <div className="container mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />
            <input
              type="search"
              placeholder="Rechercher un produit..."
              value={props.searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-11 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
              style={{ 
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: isDark ? '#fff' : '#1a1a1a',
              }}
            />
            {props.searchTerm && (
              <button 
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
              >
                <X className="w-3 h-3" style={{ color: isDark ? '#fff' : '#000' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CATÉGORIES SCROLLABLES */}
      {availableCategories.length > 0 && (
        <div className="sticky top-[132px] sm:top-[140px] z-20 py-3 backdrop-blur-lg" style={{ 
          backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'
        }}>
          <div className="container mx-auto">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
              <button
                onClick={() => onCategoryChange("all")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={activeCategoryTab === "all" 
                  ? { backgroundColor: pc, color: "white" }
                  : { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }
                }
              >
                <Sparkles className="w-3.5 h-3.5" />
                Tout
              </button>
              {availableCategories.map(cat => {
                const CatIcon = getCategoryIcon(cat, establishmentType);
                return (
                  <button
                    key={cat}
                    onClick={() => onCategoryChange(cat)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
                    style={activeCategoryTab === cat 
                      ? { backgroundColor: pc, color: "white" }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }
                    }
                  >
                    <CatIcon className="w-3.5 h-3.5" />
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GRILLE PRODUITS */}
      <main className="container mx-auto px-4 py-4">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map((product) => {
              const CatIcon = getCategoryIcon(product.category || '', establishmentType);
              return (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.98]"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                    boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)'
                  }}
                >
                  {/* Image du produit */}
                  <div className="relative aspect-square overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : null}
                    {/* Placeholder si pas d'image ou si image cassée */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        zIndex: product.imageUrl ? -1 : 0
                      }}
                    >
                      <CatIcon className="w-10 h-10 sm:w-12 sm:h-12" style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
                    </div>
                    {/* Badge catégorie */}
                    {product.category && (
                      <div 
                        className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm"
                        style={{ 
                          backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)',
                          color: isDark ? '#fff' : pc
                        }}
                      >
                        {product.category}
                      </div>
                    )}
                  </div>
                  
                  {/* Infos produit */}
                  <div className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-1 mb-0.5" style={{ color: isDark ? '#fff' : '#1a1a1a' }}>
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-xs line-clamp-2 mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-sm" style={{ color: pc }}>
                        {getPrice(product).toLocaleString("fr-FR")} FCFA
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                        style={{ backgroundColor: pc }}
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
            >
              <Search className="w-7 h-7" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }} />
            </div>
            <p className="font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
              {props.searchTerm ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
            </p>
            <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
              {props.searchTerm ? 'Essayez avec d\'autres mots-clés' : 'Les produits apparaîtront ici'}
            </p>
          </div>
        )}
      </main>

      {/* PANIER FLOTTANT */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:w-auto">
          <button
            onClick={onShowCart || onCheckout}
            className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-3 px-6 py-4 rounded-2xl shadow-2xl transition-transform active:scale-[0.98]"
            style={{ backgroundColor: pc }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span 
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: sc }}
                >
                  {cartCount}
                </span>
              </div>
              <span className="text-white font-bold text-base">
                {total.toLocaleString("fr-FR")} FCFA
              </span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// TEMPLATE 10: NACK SHOP (Boutique / Catalogue)
// Template spécialisé pour boutiques, friperies, magasins
// Mobile-first, minimaliste, orienté catalogue
// ============================================

interface NackShopTemplateProps extends TemplateProps {
  establishmentType?: string;
  fullAddress?: string;
}

// Favoris simple en mémoire (pas de localStorage pour éviter les erreurs SSR/hydratation)
const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const toggleFavorite = (productId: string) => {
    setFavorites(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };
  const isFavorite = (productId: string) => favorites.includes(productId);
  return { toggleFavorite, isFavorite };
};

// Icônes pour les catégories boutique
const getShopCategoryIcon = (category: string, type?: string) => {
  const cat = category.toLowerCase();
  
  // Vêtements
  if (cat.includes('t-shirt') || cat.includes('tshirt') || cat.includes('chemise') || cat.includes('haut')) return Shirt;
  if (cat.includes('jean') || cat.includes('pantalon') || cat.includes('bas')) return Shirt;
  if (cat.includes('robe') || cat.includes('jupe')) return Shirt;
  if (cat.includes('veste') || cat.includes('manteau') || cat.includes('blouson')) return Shirt;
  if (cat.includes('vêtement')) return Shirt;
  
  // Chaussures
  if (cat.includes('chaussure') || cat.includes('basket') || cat.includes('sneaker') || cat.includes('botte')) return Footprints;
  
  // Accessoires
  if (cat.includes('sac') || cat.includes('accessoire')) return ShoppingBag;
  if (cat.includes('montre') || cat.includes('bijou')) return Watch;
  if (cat.includes('lunette')) return Glasses;
  if (cat.includes('ceinture')) return Shirt;
  
  // Beauté / Parfums
  if (cat.includes('parfum') || cat.includes('cosmétique') || cat.includes('beauté')) return Droplet;
  
  // Électronique
  if (cat.includes('téléphone') || cat.includes('ordinateur') || cat.includes('audio') || cat.includes('gaming') || cat.includes('électronique')) return Smartphone;
  
  // Maison / Déco
  if (cat.includes('maison') || cat.includes('déco') || cat.includes('meuble')) return Home;
  
  // Cadeaux
  if (cat.includes('cadeau') || cat.includes('gift')) return Gift;
  
  // Bijouterie
  if (cat.includes('bijoux') || cat.includes('bijouterie')) return Gem;
  
  // Par défaut selon le type
  if (type === 'friperie' || type === 'boutique-vetements') return Shirt;
  if (type === 'boutique-chaussures') return Footprints;
  if (type === 'boutique-electronique') return Smartphone;
  if (type === 'boutique-accessoires') return ShoppingBag;
  if (type === 'boutique-maison') return Home;
  
  return Package;
};

// Label du type de boutique
const getShopTypeLabel = (type?: string) => {
  switch (type) {
    case 'friperie': return 'Friperie';
    case 'boutique-vetements': return 'Boutique';
    case 'boutique-chaussures': return 'Chaussures';
    case 'boutique-electronique': return 'Électronique';
    case 'boutique-accessoires': return 'Accessoires';
    case 'boutique-maison': return 'Décoration';
    case 'boutique': return 'Boutique';
    case 'commerce-alimentation': return 'Alimentation';
    case 'commerce-cosmetique': return 'Beauté';
    case 'commerce-marche': return 'Marché';
    case 'commerce': return 'Commerce';
    default: return 'Catalogue';
  }
};

export const NackShopTemplate = (props: NackShopTemplateProps) => {
  const { 
    establishment, 
    filteredProducts, 
    cart, 
    total, 
    activeCategoryTab, 
    availableCategories, 
    menuTheme, 
    establishmentType,
    fullAddress,
    onSearchChange, 
    onCategoryChange, 
    onAddToCart, 
    onSelectProduct, 
    onCheckout,
    onShowCart,
    backgroundStyle 
  } = props;
  
  const pc = menuTheme.primaryColor;
  const sc = menuTheme.secondaryColor;
  const bg = menuTheme.backgroundColor;
  
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const isDark = bg.startsWith('#1') || bg.startsWith('#0') || bg.startsWith('#2');
  
  const { toggleFavorite, isFavorite } = useFavorites();
  
  const shopLabel = getShopTypeLabel(establishmentType);

  const handleShare = async () => {
    try {
      const shareData = {
        title: establishment?.establishmentName || 'Boutique',
        text: `Découvrez ${establishment?.establishmentName || 'cette boutique'} !`,
        url: window.location.href,
      };
      if ((navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: bg }}>
      {/* HEADER BOUTIQUE */}
      <header className="sticky top-0 z-40 backdrop-blur-lg border-b" style={{ 
        backgroundColor: isDark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.96)',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
      }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo + Nom + Localisation */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {establishment?.logoUrl ? (
                <img 
                  src={establishment.logoUrl} 
                  alt="" 
                  className="w-11 h-11 rounded-2xl object-cover flex-shrink-0"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div 
                  className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: pc }}
                >
                  <Store className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-bold text-base truncate" style={{ color: isDark ? '#fff' : '#1a1a1a' }}>
                  {establishment?.establishmentName || "Boutique"}
                </h1>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }} />
                  <p className="text-xs truncate" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                    {fullAddress || shopLabel}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Bouton partage */}
              <button
                onClick={handleShare}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                }}
              >
                <Share2 className="w-4 h-4" style={{ color: isDark ? '#fff' : pc }} />
              </button>
              
              {/* Badge type */}
              <div 
                className="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'
                }}
              >
                {shopLabel}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* BARRE DE RECHERCHE */}
      <div className="sticky top-[68px] z-30 px-4 py-3 backdrop-blur-lg" style={{ 
        backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)'
      }}>
        <div className="container mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }} />
            <input
              type="search"
              placeholder={`Rechercher dans ${shopLabel.toLowerCase()}...`}
              value={props.searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-11 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
              style={{ 
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                color: isDark ? '#fff' : '#1a1a1a',
              }}
            />
            {props.searchTerm && (
              <button 
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }}
              >
                <X className="w-3 h-3" style={{ color: isDark ? '#fff' : '#000' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CATÉGORIES */}
      {availableCategories.length > 0 && (
        <div className="sticky top-[132px] z-20 py-3 backdrop-blur-lg" style={{ 
          backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)'
        }}>
          <div className="container mx-auto">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
              <button
                onClick={() => onCategoryChange("all")}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={activeCategoryTab === "all" 
                  ? { backgroundColor: pc, color: "white" }
                  : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }
                }
              >
                <Sparkles className="w-3.5 h-3.5" />
                Tout
              </button>
              {availableCategories.map(cat => {
                const CatIcon = getShopCategoryIcon(cat, establishmentType);
                return (
                  <button
                    key={cat}
                    onClick={() => onCategoryChange(cat)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
                    style={activeCategoryTab === cat 
                      ? { backgroundColor: pc, color: "white" }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }
                    }
                  >
                    <CatIcon className="w-3.5 h-3.5" />
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GRILLE CATALOGUE */}
      <main className="container mx-auto px-3 py-4">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => {
              const CatIcon = getShopCategoryIcon(product.category || '', establishmentType);
              const fav = isFavorite(product.id);
              return (
                <div
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.98]"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                    boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)'
                  }}
                >
                  {/* Image produit - ratio carré */}
                  <div className="relative aspect-square overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => { 
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            const placeholder = parent.querySelector('.shop-placeholder');
                            if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    
                    {/* Placeholder élégant */}
                    <div 
                      className={`shop-placeholder absolute inset-0 flex flex-col items-center justify-center gap-2 ${product.imageUrl ? 'hidden' : 'flex'}`}
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}
                    >
                      <CatIcon className="w-10 h-10" style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }} />
                    </div>
                    
                    {/* Bouton favori */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform active:scale-90"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)',
                      }}
                    >
                      <Heart 
                        className="w-4 h-4 transition-colors" 
                        style={{ 
                          color: fav ? '#ef4444' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)'),
                          fill: fav ? '#ef4444' : 'transparent'
                        }} 
                      />
                    </button>
                  </div>
                  
                  {/* Infos produit */}
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 mb-1 leading-tight" style={{ color: isDark ? '#fff' : '#1a1a1a' }}>
                      {product.name}
                    </h3>
                    {product.category && (
                      <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)' }}>
                        {product.category}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm" style={{ color: pc }}>
                        {getPrice(product).toLocaleString("fr-FR")} FCFA
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                        style={{ backgroundColor: pc }}
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }}
            >
              <Search className="w-7 h-7" style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }} />
            </div>
            <p className="font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
              {props.searchTerm ? 'Aucun produit trouvé' : 'Catalogue vide'}
            </p>
            <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
              {props.searchTerm ? 'Essayez avec d\'autres mots-clés' : 'Les produits apparaîtront ici'}
            </p>
          </div>
        )}
      </main>

      {/* PANIER FLOTTANT BOUTIQUE */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:w-auto">
          <button
            onClick={onShowCart || onCheckout}
            className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-3 px-6 py-4 rounded-2xl shadow-2xl transition-transform active:scale-[0.98]"
            style={{ backgroundColor: pc }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span 
                  className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: sc }}
                >
                  {cartCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-white/70 text-xs">{cartCount} article{cartCount > 1 ? 's' : ''}</p>
                <p className="text-white font-bold text-base">
                  {total.toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-white/80">
              <span className="text-sm font-medium">Voir panier</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
