import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, currentWeek } = await req.json();

    // Fetch user's current workout plan
    const { data: plans } = await supabase
      .from("workout_plans")
      .select("id, week, day, session_name, details, tempo")
      .eq("user_id", user.id)
      .order("week")
      .order("day");

    const weekPlans = plans?.filter((p: any) => p.week === currentWeek) || [];

    const planContext = weekPlans.map((p: any) =>
      `${p.day}: ${p.session_name || '(Vila)'}${p.details ? '\n  Övningar: ' + p.details : ''}${p.tempo ? '\n  Tempo: ' + p.tempo : ''}`
    ).join("\n\n");

    const allWeeks = [...new Set((plans || []).map((p: any) => p.week))].sort((a: number, b: number) => a - b);

    const systemPrompt = `Du är en AI-träningsassistent för appen Grim. Du hjälper användaren att redigera sitt träningsschema.

AKTUELLT SCHEMA (Vecka ${currentWeek}):
${planContext || "(Inget schema hittades)"}

Tillgängliga veckor: ${allWeeks.join(", ")}
Veckodagar: Mån, Tis, Ons, Tors, Fre, Lör, Sön

REGLER:
- Svara ALLTID på svenska
- Du kan lägga till övningar, ta bort övningar, ändra sets/reps/vikt, eller föreslå förbättringar
- När användaren ber dig göra en ändring, använd "workout_action" tool-funktionen
- Om användaren frågar om råd/tips, svara normalt utan tool call
- Övningar i details-fältet separeras med radbrytning (\\n)
- Format för styrkeövning: "Övningsnamn 3×10 80kg" eller bara "Övningsnamn 3×10"
- Format för konditionsövning: bara övningsnamnet i session_name
- Vila-dagar har tom session_name och tom details
- Du kan ändra vecka om användaren ber om det, men standard är vecka ${currentWeek}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "workout_action",
          description: "Utför en ändring i användarens träningsschema. Kan lägga till/ta bort övningar eller ändra sets/reps/vikt.",
          parameters: {
            type: "object",
            properties: {
              actions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["add_exercise", "remove_exercise", "update_exercise", "set_session_name"],
                      description: "Typ av ändring"
                    },
                    week: { type: "number", description: "Veckonummer" },
                    day: { type: "string", description: "Dag (Mån, Tis, Ons, Tors, Fre, Lör, Sön)" },
                    exercise: { type: "string", description: "Övningsnamn med sets/reps/vikt, t.ex. 'Bänkpress 3×10 80kg'" },
                    old_exercise: { type: "string", description: "Namn på övningen som ska tas bort/uppdateras (matchar början av raden)" },
                    session_name: { type: "string", description: "Namn på passet, t.ex. 'Styrka Överkropp'" }
                  },
                  required: ["type", "week", "day"]
                }
              }
            },
            required: ["actions"]
          }
        }
      }
    ];

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Förfrågansgränsen nådd, försök igen om en stund." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta administratören." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI-fel" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const choice = aiData.choices?.[0];
    const message = choice?.message;

    // If the AI made a tool call, execute the actions
    if (message?.tool_calls?.length > 0) {
      const toolCall = message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      const results: string[] = [];

      for (const action of args.actions) {
        const targetWeek = action.week || currentWeek;
        const targetDay = action.day;

        // Find the plan row for this day
        const planRow = plans?.find((p: any) => p.week === targetWeek && p.day === targetDay);

        if (!planRow) {
          results.push(`❌ Hittade inget pass för ${targetDay} vecka ${targetWeek}`);
          continue;
        }

        if (action.type === "set_session_name") {
          const { error } = await supabase
            .from("workout_plans")
            .update({ session_name: action.session_name || "" })
            .eq("id", planRow.id);
          if (error) {
            results.push(`❌ Kunde inte ändra passnamn: ${error.message}`);
          } else {
            results.push(`✅ Ändrade passnamn till "${action.session_name}" på ${targetDay}`);
          }
        } else if (action.type === "add_exercise") {
          const currentDetails = planRow.details || "";
          const newDetails = currentDetails
            ? currentDetails + "\n" + action.exercise
            : action.exercise;
          const { error } = await supabase
            .from("workout_plans")
            .update({ details: newDetails })
            .eq("id", planRow.id);
          if (error) {
            results.push(`❌ Kunde inte lägga till: ${error.message}`);
          } else {
            results.push(`✅ La till "${action.exercise}" på ${targetDay}`);
          }
        } else if (action.type === "remove_exercise") {
          const lines = (planRow.details || "").split("\n");
          const target = (action.old_exercise || action.exercise || "").toLowerCase();
          const filtered = lines.filter((l: string) => !l.toLowerCase().startsWith(target));
          if (filtered.length === lines.length) {
            results.push(`⚠️ Hittade inte "${action.old_exercise || action.exercise}" på ${targetDay}`);
          } else {
            const { error } = await supabase
              .from("workout_plans")
              .update({ details: filtered.join("\n") })
              .eq("id", planRow.id);
            if (error) {
              results.push(`❌ Kunde inte ta bort: ${error.message}`);
            } else {
              results.push(`✅ Tog bort "${action.old_exercise || action.exercise}" från ${targetDay}`);
            }
          }
        } else if (action.type === "update_exercise") {
          const lines = (planRow.details || "").split("\n");
          const target = (action.old_exercise || "").toLowerCase();
          const idx = lines.findIndex((l: string) => l.toLowerCase().startsWith(target));
          if (idx === -1) {
            results.push(`⚠️ Hittade inte "${action.old_exercise}" på ${targetDay}`);
          } else {
            lines[idx] = action.exercise;
            const { error } = await supabase
              .from("workout_plans")
              .update({ details: lines.join("\n") })
              .eq("id", planRow.id);
            if (error) {
              results.push(`❌ Kunde inte uppdatera: ${error.message}`);
            } else {
              results.push(`✅ Uppdaterade till "${action.exercise}" på ${targetDay}`);
            }
          }
        }
      }

      // Get AI's text response alongside the tool call
      const textContent = message.content || "";
      const summary = results.join("\n");
      const finalResponse = textContent
        ? `${textContent}\n\n${summary}`
        : `Klart! Här är vad jag gjorde:\n\n${summary}`;

      return new Response(JSON.stringify({
        response: finalResponse,
        actions_executed: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool call - just a text response
    return new Response(JSON.stringify({
      response: message?.content || "Jag förstod inte, kan du omformulera?",
      actions_executed: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internt fel" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
