import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Post = { id: string; user_id: string; caption: string | null; created_at: string; image_url: string | null };

/** Senaste inläggen i flödet. Borttagning syns direkt, även i webbappen. */
export default function AdminPosts() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("social_posts").select("id,user_id,caption,created_at,image_url").order("created_at", { ascending: false }).limit(40);
    if (error) return toast.error(error.message);
    const list = (data || []) as Post[];
    setPosts(list);
    const ids = [...new Set(list.map((p) => p.user_id))];
    if (!ids.length) return;
    const { data: profiles } = await supabase.from("profiles").select("user_id,nickname").in("user_id", ids);
    setNames(Object.fromEntries((profiles || []).map((p) => [p.user_id, p.nickname || "Okänd"])));
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("social_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPosts((list) => list?.filter((p) => p.id !== id) ?? []);
    setPending(null);
    toast.success("Inlägget är borta ur flödet");
  };

  if (!posts) return null;
  if (posts.length === 0) return <p className="text-[11px] text-muted-foreground">Inga inlägg.</p>;

  return (
    <ul className="divide-y divide-border text-sm">
      {posts.map((p) => (
        <li key={p.id} className="space-y-1 py-2">
          <p className="text-[11px] text-muted-foreground">
            {names[p.user_id] || "…"} · {new Date(p.created_at).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {p.image_url ? " · bild" : ""}
          </p>
          <p className="line-clamp-3">{p.caption?.trim() || "Ingen text"}</p>
          {pending === p.id ? (
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => remove(p.id)}>Ta bort för alla</Button>
              <Button size="sm" variant="outline" onClick={() => setPending(null)}>Avbryt</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setPending(p.id)}>Ta bort</Button>
          )}
        </li>
      ))}
    </ul>
  );
}
