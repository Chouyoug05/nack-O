import { Package, Plus, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  establishment: { establishmentName: string; logoUrl?: string } | null;
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
          <p className="text-xl sm:text-2xl font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} XAF</p>
        </div>
        <Button onClick={onCheckout} className="text-white px-6 sm:px-8 h-12 rounded-full font-bold shadow-lg" style={{ backgroundColor: pc }}>
          <ShoppingBag className="w-4 h-4 mr-2" /> Commander
        </Button>
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
            <span className="text-white font-bold">{total.toLocaleString("fr-FR")} XAF</span>
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
                  <span className="text-xl font-bold" style={{ color: sc }}>{getPrice(product).toLocaleString("fr-FR")} XAF</span>
                  {isFoodBusiness && (
                    <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform"
                      style={{ backgroundColor: pc }}>
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
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
            <span className="font-bold text-white">{total.toLocaleString("fr-FR")} XAF</span>
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
                  <span className="font-bold" style={{ color: sc }}>{getPrice(product).toLocaleString("fr-FR")} XAF</span>
                  {isFoodBusiness && (
                    <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform"
                      style={{ backgroundColor: sc }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
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
              <p className="text-xl font-bold" style={{ color: sc }}>{total.toLocaleString("fr-FR")} XAF</p>
            </div>
            <Button onClick={onCheckout} className="px-6 h-12 rounded-full font-bold text-black" style={{ backgroundColor: sc }}>
              <ShoppingBag className="w-4 h-4 mr-2" /> Commander
            </Button>
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
                  <span className="font-bold text-base" style={{ color: sc }}>{getPrice(product).toLocaleString("fr-FR")} XAF</span>
                  {isFoodBusiness && (
                    <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                      style={{ backgroundColor: pc }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
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
                  <span className="font-bold text-sm" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} XAF</span>
                  {isFoodBusiness && (
                    <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: pc }}>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
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
              <p className="text-lg font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} XAF</p>
            </div>
            <Button onClick={onCheckout} className="text-white px-6 h-10 rounded-lg font-medium text-sm" style={{ backgroundColor: pc }}>
              <ShoppingBag className="w-4 h-4 mr-2" /> Panier
            </Button>
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
                <span className="font-bold" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} XAF</span>
                {isFoodBusiness && (
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                    className="text-xs uppercase tracking-wider px-3 py-1 border hover:bg-white/10 transition-colors"
                    style={{ borderColor: pc, color: pc }}>
                    Ajouter
                  </button>
                )}
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
              <p className="text-xl font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} XAF</p>
            </div>
            <Button onClick={onCheckout} className="px-8 h-12 font-medium tracking-wider text-black border-0" style={{ backgroundColor: pc }}>
              COMMANDER
            </Button>
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
                  <span className="font-bold text-sm" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} XAF</span>
                  {isFoodBusiness && (
                    <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: sc }}>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
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
                  <span className="font-bold text-xs" style={{ color: pc }}>{getPrice(product).toLocaleString("fr-FR")} XAF</span>
                  {isFoodBusiness && (
                    <button onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                      className="w-6 h-6 rounded flex items-center justify-center text-white"
                      style={{ backgroundColor: sc }}>
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
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
              <p className="text-lg font-bold" style={{ color: pc }}>{total.toLocaleString("fr-FR")} XAF</p>
            </div>
            <Button onClick={onCheckout} className="text-white px-6 h-10 rounded-md font-medium text-sm" style={{ backgroundColor: pc }}>
              <ShoppingBag className="w-4 h-4 mr-2" /> Commander
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
