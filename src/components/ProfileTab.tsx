import { useState } from "react";
import { ChevronDown, User } from "lucide-react";
import ProfileSection from "@/components/ProfileSection";

interface ProfileTabProps {
  userId: string;
  isAdmin?: boolean;
}

const ProfileTab = ({ userId, isAdmin }: ProfileTabProps) => {
  const [profileOpen, setProfileOpen] = useState(true);

  return (
    <div className="py-2 space-y-4">
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
