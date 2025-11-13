import { Button } from "@/components/ui/button";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface CategoryNavigationProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryNavigation = ({ categories, selectedCategory, onSelectCategory }: CategoryNavigationProps) => {
  const [focusedIndex, setFocusedIndex] = useState(categories.indexOf(selectedCategory));
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Garante que o foco inicial esteja na categoria selecionada
  useEffect(() => {
    setFocusedIndex(categories.indexOf(selectedCategory));
  }, [selectedCategory, categories]);

  const { playNavigationSound } = useKeyboardNavigation({
    enabled: true, // Sempre ativo para navegação horizontal
    onArrowLeft: () => {
      setFocusedIndex(prev => {
        const newIndex = Math.max(prev - 1, 0);
        buttonRefs.current[newIndex]?.focus();
        return newIndex;
      });
    },
    onArrowRight: () => {
      setFocusedIndex(prev => {
        const newIndex = Math.min(prev + 1, categories.length - 1);
        buttonRefs.current[newIndex]?.focus();
        return newIndex;
      });
    },
    onEnter: () => {
      if (categories[focusedIndex]) {
        onSelectCategory(categories[focusedIndex]);
        playNavigationSound('select');
      }
    }
  });

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
    playNavigationSound('focus');
  };

  return (
    <div className="flex flex-wrap justify-center gap-3 p-4">
      {categories.map((category, index) => (
        <Button
          key={category}
          ref={(el) => (buttonRefs.current[index] = el)}
          variant={selectedCategory === category ? "default" : "outline"}
          size="sm" // Alterado para tamanho pequeno
          onClick={() => onSelectCategory(category)}
          onFocus={() => handleFocus(index)}
          className={cn(
            "capitalize transition-all duration-200",
            selectedCategory === category 
              ? "bg-primary text-primary-foreground glow-effect" // Adicionado glow-effect
              : "border-primary/50 hover:border-primary hover:bg-primary/10"
          )}
          tabIndex={0}
        >
          {category}
        </Button>
      ))}
    </div>
  );
};