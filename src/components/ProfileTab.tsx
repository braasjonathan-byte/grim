import { useState, useRef } from "react";
import { ChevronDown, User, Sparkles, ShoppingBag } from "lucide-react";
import ProfileSection from "@/components/ProfileSection";
import AvatarEditor, { type AvatarEditorRef } from "@/components/AvatarEditor";
import AvatarShop from "@/components/AvatarShop";

interface ProfileTabProps {
  userId: string;
  isAdmin?: boolean;
}

const ProfileTab = ({ userId, isAdmin }: ProfileTabProps) => {
  const [avatarOpen, setAvatarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const editorRef = useRef<AvatarEditorRef>(null);

  return (
    <div className="py-2 space-y-4">
      {/* Avatar editor */}
      <div className="bg-card border border-border rounded-lg p-4">
        <button
          onClick={() => setAvatarOpen(!avatarOpen)}
          className="w-full flex items-center justify-between py-1"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Avatar</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${avatarOpen ? "rotate-180" : ""}`} />
        </button>
        {avatarOpen && (
          <div className="pt-2">
            <AvatarEditor ref={editorRef} userId={userId} />
          </div>
        )}
      </div>

      {/* Shop */}
      <div className="bg-card border border-border rounded-lg p-4">
        <button
          onClick={() => setShopOpen(!shopOpen)}
          className="w-full flex items-center justify-between py-1"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Butik</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${shopOpen ? "rotate-180" : ""}`} />
        </button>
        {shopOpen && (
          <div className="pt-2">
            <AvatarShop userId={userId} isAdmin={isAdmin} onEquipChange={() => editorRef.current?.reloadEquipped()} />
          </div>
        )}
      </div>

      {/* Profile settings */}
      <div className="bg-card border border-border rounded-lg p-4">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center justify-between py-1"
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Profilinställningar</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
        </button>
        {profileOpen && (
          <div className="pt-2">
            <ProfileSection userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileTab;
