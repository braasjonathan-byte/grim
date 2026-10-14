import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Report = { id: string; post_id: string | null; reported_user_id: string; reason: string; details: string | null; created_at: string };

export default function AdminReports() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [posts, setPosts] = useState<Record<string, { caption: string | null; image_url: string | null }>>({});
  const [names, setNames] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("post_reports").select("id,post_id,reported_user_id,reason,details,created_at").eq("resolved", false).order("created_at", { ascending: false }).limit(50);
    const rs = (data || []) as Report[];
    setReports(rs);
    const postIds = rs.map((r) => r.post_id).filter(Boolean) as string[];
    const userIds = [...new Set(rs.map((r) => r.reported_user_id))];
    const [{ data: p }, { data: u }] = await Promise.all([
      postIds.length ? supabase.from("social_posts").select("id,caption,image_url").in("id", postIds) : Promise.resolve({ data: [] as any[] }),
      userIds.length ? supabase.from("profiles").select("user_id,nickname").in("user_id", userIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    setPosts(Object.fromEntries((p || []).map((x: any) => [x.id, x])));
    setNames(Object.fromEntries((u || []).map((x: any) => [x.user_id, x.nickname])));
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    const { error } = await supabase.from("post_reports").update({ resolved: true }).eq("id", id);
    if (error) return toast.error(error.message);
    setReports((r) => r?.filter((x) => x.id !== id) ?? null);
  };
  const removePost = async (r: Report) => {
    if (r.post_id) {
      const { error } = await supabase.from("social_posts").delete().eq("id", r.post_id);
      if (error) return toast.error(error.message);
    }
    await resolve(r.id);
    toast.success("Inlägget är borttaget");
  };

  if (!reports) return <Loader2 className="w-4 h-4 animate-spin mx-auto" />;
  if (!reports.length) return <p className="text-xs text-muted-foreground">Inga obehandlade rapporter.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {reports.map((r) => {
        const post = r.post_id ? posts[r.post_id] : null;
        return (
          <li key={r.id} className="rounded-xl bg-muted p-2 space-y-1">
            <p className="font-medium">{names[r.reported_user_id] || "Okänd"} · {r.reason}</p>
            {r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}
            {post?.image_url && <img src={post.image_url} alt="Rapporterat inlägg" className="w-full max-h-40 object-cover rounded-lg" />}
            {post?.caption && <p className="text-xs">"{post.caption}"</p>}
            {r.post_id && !post && <p className="text-xs text-muted-foreground">Inlägget finns inte längre.</p>}
            <div className="flex gap-2">
              {post && <Button size="sm" variant="destructive" onClick={() => removePost(r)}>Ta bort inlägget</Button>}
              <Button size="sm" variant="outline" onClick={() => resolve(r.id)}>Markera som hanterad</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
