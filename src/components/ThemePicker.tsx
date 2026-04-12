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
    if (!isHonorary) return;
    onThemeChange(themeId);
    storeThemeId(themeId);
    applyTheme(themeId);
    await supabase
      .from("profiles")
      .update({ theme: themeId } as any)
      .eq("user_id", userId);
  };

  return (
    <div className="border-t border-border pt-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Färgtema</span>
            {!isHonorary && <Crown className="w-3.5 h-3.5 text-warning" />}
            {isHonorary && currentTheme !== "default" && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5">
                {THEMES.find((t) => t.id === currentTheme)?.name}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-2 space-y-2">
            {!isHonorary && (
              <p className="text-xs text-muted-foreground">
                Bli Supporter för att låsa upp exklusiva färgteman! 👑
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((theme) => {
                const isActive = currentTheme === theme.id;
                const locked = !isHonorary && theme.id !== "default";
                return (
                  <button
                    key={theme.id}
                    onClick={() => !locked && handleSelect(theme.id)}
                    disabled={locked}
                    className={`relative flex flex-col items-center gap-1 p-2 border transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    } ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {/* Color preview */}
                    <div className="flex gap-0.5">
                      <div
                        className="w-4 h-4 border border-border/30"
                        style={{ backgroundColor: theme.preview.bg }}
                      />
                      <div
                        className="w-4 h-4 border border-border/30"
                        style={{ backgroundColor: theme.preview.card }}
                      />
                      <div
                        className="w-4 h-4 border border-border/30"
                        style={{ backgroundColor: theme.preview.accent }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold">
                      {theme.emoji} {theme.name}
                    </span>
                    {isActive && (
                      <Check className="absolute top-1 right-1 w-3 h-3 text-primary" />
                    )}
                    {locked && (
                      <Crown className="absolute top-1 right-1 w-3 h-3 text-warning" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ThemePicker;
