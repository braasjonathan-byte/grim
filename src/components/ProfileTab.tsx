import ProfileSection from "@/components/ProfileSection";
import ArchivedPlans from "@/components/ArchivedPlans";
import IdentityTitleCard from "@/components/IdentityTitleCard";
import SettingsSection from "@/components/SettingsSection";
import { Archive } from "lucide-react";

interface ProfileTabProps {
  userId: string;
  isAdmin?: boolean;
}

const ProfileTab = ({ userId, isAdmin }: ProfileTabProps) => {
  return (
    <div className="py-2 space-y-4">
      {/* Identity title */}
      <IdentityTitleCard userId={userId} />

      {/* Archived plans */}
      <SettingsSection title="Arkiv" icon={Archive} defaultOpen={false}>
        <ArchivedPlans userId={userId} />
      </SettingsSection>

      {/* Profile, body data, socials, anthem, danger zone */}
      <ProfileSection userId={userId} />
    </div>
  );
};

export default ProfileTab;
