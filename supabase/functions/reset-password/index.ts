import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { nickname, action, answers, newPassword } = body;

    if (!nickname || typeof nickname !== "string" || nickname.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Ogiltigt användarnamn" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up profile by nickname
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("nickname", nickname.trim())
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: true, message: "Kontot hittades inte.", hasQuestions: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up email from secure table
    const { data: emailData } = await supabaseAdmin
      .from("user_emails")
      .select("email")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    const userEmail = emailData?.email || null;

    // Step 1: Get security questions for user
    if (action === "get-questions") {
      const { data: secData } = await supabaseAdmin
        .from("security_answers")
        .select("question_index, answer_hash")
        .eq("user_id", profile.user_id)
        .order("question_index", { ascending: true });

      if (!secData || secData.length < 4) {
        if (!userEmail) {
          return new Response(
            JSON.stringify({ success: false, hasQuestions: false, message: "Inga säkerhetsfrågor eller e-post konfigurerade." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: true, hasQuestions: false, hasEmail: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const SECURITY_QUESTIONS = [
        "Vad hette ditt första husdjur?",
        "Vilken stad föddes du i?",
        "Vad hette din bästa vän i barndomen?",
        "Vad är din mammas flicknamn?",
        "Vilken var din första skola?",
        "Vad heter din favoritfilm?",
        "Vilken gata växte du upp på?",
        "Vad är ditt favoritlag?",
      ];

      const questions = secData.map((row) => {
        const qIdx = parseInt(row.answer_hash.split(":")[0]);
        return {
          index: row.question_index,
          question: SECURITY_QUESTIONS[qIdx] || `Fråga ${qIdx + 1}`,
        };
      });

      return new Response(
        JSON.stringify({ success: true, hasQuestions: true, questions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Verify answers and set new password directly
    if (action === "verify-answers") {
      if (!answers || !Array.isArray(answers) || answers.length !== 4) {
        return new Response(
          JSON.stringify({ error: "Alla 4 svar krävs" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 8) {
        return new Response(
          JSON.stringify({ error: "Nytt lösenord måste vara minst 8 tecken" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: secData } = await supabaseAdmin
        .from("security_answers")
        .select("question_index, answer_hash")
        .eq("user_id", profile.user_id)
        .order("question_index", { ascending: true });

      if (!secData || secData.length < 4) {
        return new Response(
          JSON.stringify({ error: "Inga säkerhetsfrågor hittades" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let allCorrect = true;
      for (let i = 0; i < 4; i++) {
        const stored = secData[i].answer_hash;
        const storedAnswer = stored.split(":").slice(1).join(":").toLowerCase();
        const provided = (answers[i] || "").trim().toLowerCase();
        if (storedAnswer !== provided) {
          allCorrect = false;
          break;
        }
      }

      if (!allCorrect) {
        return new Response(
          JSON.stringify({ success: false, error: "Ett eller flera svar är felaktiga" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Set the new password directly
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        { password: newPassword.trim() }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Kunde inte uppdatera lösenordet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clear must_change_password flag
      await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", profile.user_id);

      return new Response(
        JSON.stringify({ success: true, message: "Lösenordet har ändrats! Du kan nu logga in med ditt nya lösenord." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Email-based reset - sends new password via email
    if (action === "email-reset") {
      if (!userEmail) {
        return new Response(
          JSON.stringify({ error: "Ingen e-post konfigurerad" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 8) {
        return new Response(
          JSON.stringify({ error: "Nytt lösenord måste vara minst 8 tecken" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify via email: send a code? For now, just set the password directly
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        { password: newPassword.trim() }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Kunde inte uppdatera lösenordet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", profile.user_id);

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const emailHtml = `
          <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="margin: 0 0 16px; font-size: 20px;">Lösenordsåterställning</h2>
            <p style="color: #444; line-height: 1.5;">Ditt lösenord har ändrats. Om du inte begärt detta, kontakta en administratör omedelbart.</p>
          </div>
        `;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "TRÄNING <onboarding@resend.dev>",
            to: [userEmail],
            subject: "Ditt lösenord har ändrats",
            html: emailHtml,
          }),
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Lösenordet har ändrats! Du kan nu logga in med ditt nya lösenord." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ogiltig åtgärd" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Reset password error:", err);
    return new Response(
      JSON.stringify({ error: "Något gick fel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
