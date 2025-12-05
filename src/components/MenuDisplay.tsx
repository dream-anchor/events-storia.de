import { useMenu, useMenuById, MenuType } from "@/hooks/useMenu";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

interface MenuDisplayProps {
  menuType: MenuType;
  menuId?: string; // Optional: for fetching specific menu by ID (used for special occasions)
}

const MenuDisplay = ({ menuType, menuId }: MenuDisplayProps) => {
  // Use menuId if provided (for special menus), otherwise fetch by type
  const menuByType = useMenu(menuType);
  const menuById = useMenuById(menuId);
  
  const { data: menu, isLoading, error } = menuId ? menuById : menuByType;
  const { language, t } = useLanguage();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-6 w-40 mx-auto" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-secondary/50 p-8 rounded-sm text-center border border-border">
          <p className="text-muted-foreground">
            {t.menuDisplay?.noMenu || "Das aktuelle Menü ist derzeit nicht verfügbar."}
          </p>
          <a 
            href="tel:+498951519696" 
            className="text-primary hover:underline mt-3 inline-block font-medium"
          >
            {t.menuDisplay?.callForMenu || "Rufen Sie uns an: 089 51519696"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Menu Header */}
      {(menu.title || menu.subtitle) && (
        <div className="text-center mb-12">
          {menu.title && (
            <h2 className="text-3xl md:text-4xl font-serif font-semibold tracking-wide mb-2">
              {menu.title}
            </h2>
          )}
          {menu.subtitle && (
            <p className="text-lg text-muted-foreground italic">{menu.subtitle}</p>
          )}
          <div className="w-24 h-px bg-primary/30 mx-auto mt-6" />
        </div>
      )}

      {/* Categories */}
      <div className="space-y-12">
        {menu.categories.map((category) => {
          const categoryName = language === 'en' && category.name_en ? category.name_en : category.name;
          const categoryDescription = language === 'en' && category.description_en ? category.description_en : category.description;

          return (
            <div key={category.id} className="space-y-6">
              {/* Category Header */}
              <div className="text-center">
                <h3 className="text-2xl font-serif font-medium tracking-[0.15em] uppercase text-primary">
                  ~ {categoryName} ~
                </h3>
                {categoryDescription && (
                  <p className="text-base text-muted-foreground mt-2 italic">
                    {categoryDescription}
                  </p>
                )}
              </div>

              {/* Items */}
              <div className="space-y-4">
                {category.items.map((item) => {
                  const itemName = language === 'en' && item.name_en ? item.name_en : item.name;
                  const itemDescription = language === 'en' && item.description_en ? item.description_en : item.description;
                  const priceDisplay = item.price_display || (item.price ? `€${item.price.toFixed(2).replace('.', ',')}` : null);

                  return (
                    <div key={item.id} className="group">
                      <div className="flex justify-between items-baseline gap-4">
                        <span className="font-serif font-medium text-lg text-foreground">
                          {itemName}
                        </span>
                        <span className="flex-shrink-0 border-b border-dotted border-border flex-grow mx-2" />
                        {priceDisplay && (
                          <span className="font-medium text-lg text-foreground whitespace-nowrap">
                            {priceDisplay}
                          </span>
                        )}
                      </div>
                      {itemDescription && (
                        <p className="text-base text-muted-foreground mt-1 leading-relaxed">
                          {itemDescription}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      {menu.categories.length > 0 && (
        <div className="mt-12 pt-8 border-t border-border/50 text-center">
          <p className="text-sm text-muted-foreground italic">
            {t.menuDisplay?.allergenNote || "Allergene und Zusatzstoffe auf Anfrage"}
          </p>
        </div>
      )}
    </div>
  );
};

export default MenuDisplay;
