import { Profile } from "@/data/workoutData";
import { User } from "lucide-react";

interface ProfileSwitcherProps {
  profile: Profile;
  onSwitch: (p: Profile) => void;
}

const ProfileSwitcher = ({ profile, onSwitch }: ProfileSwitcherProps) => {
  return (
    <div className="flex gap-2 p-1 bg-secondary rounded-lg">
      {(["J", "W"] as Profile[]).map((p) => (
        <button
          key={p}
          onClick={() => onSwitch(p)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
            profile === p
              ? "bg-primary text-primary-foreground shadow-lg"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="w-4 h-4" />
          {p === "J" ? "J" : "W"}
        </button>
      ))}
    </div>
  );
};

export default ProfileSwitcher;
