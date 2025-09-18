import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Product, CartItem } from "@/types/order";
import { products as mockProducts } from "@/data/products";
import { 
  ShoppingCart, 
  Search,
  Coffee,
  Wine,
  Utensils,
  Sandwich,
  MenuSquare
} from "lucide-react";

interface ProductGridProps {
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  productsOverride?: Product[];
}

const ProductGrid = ({ cart, onAddToCart, onUpdateQuantity, productsOverride }: ProductGridProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const baseProducts = productsOverride ?? mockProducts;
  const filteredProducts = baseProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        onUpdateQuantity(product.id, existingItem.quantity + 1);
      } else {
        toast({
          title: "Stock insuffisant",
          description: `Il ne reste que ${product.stock} unités en stock`,
          variant: "destructive"
        });
      }
    } else {
      onAddToCart(product);
    }
  };

  const getProductIcon = (imageType: string) => {
    const iconMap = {
      beer: Wine,
      soda: Coffee,
      plate: Utensils,
      wine: Wine,
      coffee: Coffee,
      sandwich: Sandwich,
      juice: Coffee,
      rice: Utensils,
      menu: MenuSquare
    };
    const IconComponent = iconMap[imageType as keyof typeof iconMap] || Utensils;
    return <IconComponent size={32} className="text-nack-red" />;
  };

  const renderProductVisual = (p: Product) => {
    if (p.imageUrl) {
      return (
        <div className="w-20 h-20 mx-auto mb-2 rounded-md overflow-hidden bg-nack-beige-light">
          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      );
    }
    return <div className="mb-2">{getProductIcon(p.image || 'menu')}</div>;
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Produits disponibles</CardTitle>
            <CardDescription>Sélectionnez les produits pour la commande</CardDescription>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full md:w-[300px]"
            />
          </div>
        </div>
      </CardHeader>
              <CardContent>
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {['Tous', 'Boissons', 'Plats', 'Formules', 'Alcools', 'Snacks'].map((category) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm(category === 'Tous' ? '' : category)}
                className={searchTerm === category || (category === 'Tous' && !searchTerm) ? 'bg-primary text-primary-foreground' : ''}
              >
                {category}
              </Button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id} 
              className="shadow-card border-0 hover:shadow-elegant transition-shadow cursor-pointer"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-3 text-center">
                  {renderProductVisual(product)}
                  <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                  <div className="text-xs text-muted-foreground mb-1">{product.category}</div>
                  <p className="text-lg font-bold text-nack-red mb-1">{product.price.toLocaleString()} XAF</p>
                <p className="text-xs text-muted-foreground mb-2">Stock: {product.stock}</p>
                <Button 
                  className="w-full bg-gradient-primary text-white shadow-button text-xs h-8"
                  disabled={product.stock === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(product);
                  }}
                >
                  <ShoppingCart size={12} className="mr-1" />
                  Ajouter
                </Button>
              </CardContent>
            </Card>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductGrid;