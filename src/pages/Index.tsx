import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Users, Edit3, LogOut, Calculator } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import AuthScreen from "@/components/AuthScreen";
import WorkoutView from "@/components/WorkoutView";
import PlanEditor from "@/components/PlanEditor";
import FriendsView from "@/components/FriendsView";
import OneRMCalculator from "@/components/OneRMCalculator";

type Tab = "workout" | "plan" | "friends" | "calc";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("workout");
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          // Fetch nickname
          setTimeout(async () => {
            const { data } = await supabase
              .from("profiles")
              .select("nickname")
              .eq("user_id", session.user.id)
              .single();
            if (data) setNickname(data.nickname);
          }, 0);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("profiles")
          .select("nickname")
          .eq("user_id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setNickname(data.nickname);
          });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setNickname("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Dumbbell className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={() => {}} />;
  }

  const tabs: { key: Tab; icon: typeof Dumbbell; label: string }[] = [
    { key: "workout", icon: Dumbbell, label: "Träning" },
    { key: "plan", icon: Edit3, label: "Schema" },
    { key: "friends", icon: Users, label: "Vänner" },
    { key: "calc", icon: Calculator, label: "1RM" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            <h1 className="text-base font-black tracking-tight">
              TRÄNING<span className="text-primary">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">{nickname}</span>
            <button
              onClick={handleLogout}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Logga ut"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {tab === "workout" && <WorkoutView userId={user.id} />}
        {tab === "plan" && <PlanEditor userId={user.id} />}
        {tab === "friends" && <FriendsView userId={user.id} />}
        {tab === "calc" && (
          <div className="py-2">
            <OneRMCalculator />
          </div>
        )}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border z-50">
        <div className="max-w-lg mx-auto flex">
          {tabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                tab === key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Index;
