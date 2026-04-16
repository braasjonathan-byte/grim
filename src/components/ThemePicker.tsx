import { useState } from "react";
import { Crown, Palette, ChevronDown, Check } from "lucide-react";
import { THEMES, applyTheme, storeThemeId } from "@/lib/themes";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ThemePickerProps {
  userId: string;
  isHonorary: boolean;
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
}

const ThemePicker = ({ userId, isHonorary, currentTheme, onThemeChange }: ThemePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = async (themeId: string) => {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) return;
    // Non-honorary can only pick non-premium themes
    if (theme.premium && !isHonorary) return;

    onThemeChange(themeId);
    storeThemeId(themeId);
    applyTheme(themeId);
    await supabase
      .from("profiles")
      .update({ theme: themeId } as any)
      .eq("user_id", userId);
  };

  const currentThemeDef = THEMES.find((t) => t.id === currentTheme);

  return (
    <div className="border-t border-border pt-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Tema</span>
            {currentThemeDef && currentTheme !== "default" && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5">
                {currentThemeDef.emoji} {currentThemeDef.name}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-2 space-y-3">
            {/* Base themes – available to all */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-semibold">Bas</p>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.filter((t) => !t.premium).map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={currentTheme === theme.id}
                    locked={false}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>

            {/* Premium themes */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-semibold flex items-center gap-1">
                <Crown className="w-3 h-3 text-warning" /> Exklusivt för hedersmedlemmar
              </p>
              {!isHonorary && (
                <p className="text-xs text-muted-foreground mb-2">
                  🔒 Exklusivt för hedersmedlemmar
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {THEMES.filter((t) => t.premium).map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={currentTheme === theme.id}
                    locked={!isHonorary}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

interface ThemeCardProps {
  theme: (typeof THEMES)[number];
  isActive: boolean;
  locked: boolean;
  onSelect: (id: string) => void;
}

const ThemeCard = ({ theme, isActive, locked, onSelect }: ThemeCardProps) => (
  <button
    onClick={() => !locked && onSelect(theme.id)}
    disabled={locked}
    className={`relative flex flex-col items-center gap-1 p-2 border transition-colors ${
      isActive
        ? "border-primary bg-primary/10"
        : "border-border hover:border-primary/50"
    } ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <div className="flex gap-0.5">
      <div className="w-4 h-4 border border-border/30" style={{ backgroundColor: theme.preview.bg }} />
      <div className="w-4 h-4 border border-border/30" style={{ backgroundColor: theme.preview.card }} />
      <div className="w-4 h-4 border border-border/30" style={{ backgroundColor: theme.preview.accent }} />
    </div>
    <span className="text-[10px] font-semibold">
      {theme.emoji} {theme.name}
    </span>
    {isActive && <Check className="absolute top-1 right-1 w-3 h-3 text-primary" />}
    {locked && <Crown className="absolute top-1 right-1 w-3 h-3 text-warning" />}
  </button>
);

export default ThemePicker;
