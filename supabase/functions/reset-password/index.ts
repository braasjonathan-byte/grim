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
    const { nickname, action, answers } = body;

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
      .select("user_id, email")
      .ilike("nickname", nickname.trim())
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: true, message: "Kontot hittades inte.", hasQuestions: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get security questions for user
    if (action === "get-questions") {
      const { data: secData } = await supabaseAdmin
        .from("security_answers")
        .select("question_index, answer_hash")
        .eq("user_id", profile.user_id)
        .order("question_index", { ascending: true });

      if (!secData || secData.length < 4) {
        if (!profile.email) {
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

    // Helper: generate temp password and store it (without changing the real password)
    const generateAndStoreTempPassword = async (userId: string) => {
      const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
      let tempPassword = "";
      for (let i = 0; i < 12; i++) {
        tempPassword += chars[Math.floor(Math.random() * chars.length)];
      }

      // Invalidate previous temp passwords for this user
      await supabaseAdmin
        .from("temp_passwords")
        .delete()
        .eq("user_id", userId);

      // Store new temp password
      const { error } = await supabaseAdmin
        .from("temp_passwords")
        .insert({
          user_id: userId,
          temp_password: tempPassword,
        });

      if (error) {
        console.error("Failed to store temp password:", error);
        return null;
      }
      return tempPassword;
    };

    // Step 2: Verify answers and generate temp password (don't change real password)
    if (action === "verify-answers") {
      if (!answers || !Array.isArray(answers) || answers.length !== 4) {
        return new Response(
          JSON.stringify({ error: "Alla 4 svar krävs" }),
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

      const tempPassword = await generateAndStoreTempPassword(profile.user_id);
      if (!tempPassword) {
        return new Response(
          JSON.stringify({ error: "Kunde inte skapa tillfälligt lösenord" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, tempPassword, message: "Tillfälligt lösenord skapat! Ditt gamla lösenord fungerar fortfarande." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Email-based reset (also stores temp password without changing real one)
    if (action === "email-reset") {
      if (!profile.email) {
        return new Response(
          JSON.stringify({ error: "Ingen e-post konfigurerad" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tempPassword = await generateAndStoreTempPassword(profile.user_id);
      if (!tempPassword) {
        return new Response(
          JSON.stringify({ error: "Kunde inte skapa tillfälligt lösenord" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        return new Response(
          JSON.stringify({ error: "E-posttjänsten är inte konfigurerad" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const emailHtml = `
        <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; font-size: 20px;">Lösenordsåterställning</h2>
          <p style="color: #444; line-height: 1.5;">Hej! Här är ditt tillfälliga lösenord. Ditt gamla lösenord fungerar fortfarande.</p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; font-family: monospace; font-size: 22px; letter-spacing: 2px; margin: 20px 0; color: #111;">
            ${tempPassword}
          </div>
          <p style="font-size: 14px; color: #666;">Logga in med antingen ditt gamla eller det tillfälliga lösenordet. Byt sedan lösenord i inställningarna.</p>
          <p style="font-size: 12px; color: #999; margin-top: 32px;">Om du inte begärt detta kan du ignorera detta mail.</p>
        </div>
      `;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TRÄNING <onboarding@resend.dev>",
          to: [profile.email],
          subject: "Ditt tillfälliga lösenord",
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errText = await emailResponse.text();
        console.error("Failed to send email:", errText);
        return new Response(
          JSON.stringify({ error: "Kunde inte skicka e-post" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const emailParts = profile.email.split("@");
      const maskedEmail = emailParts[0].substring(0, 2) + "***@" + emailParts[1];

      return new Response(
        JSON.stringify({ success: true, message: `Tillfälligt lösenord skickat till ${maskedEmail}. Ditt gamla lösenord fungerar fortfarande.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Login with temp password
    if (action === "temp-login") {
      const { tempPassword } = body;
      if (!tempPassword) {
        return new Response(
          JSON.stringify({ error: "Lösenord saknas" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check temp_passwords table
      const { data: tempData } = await supabaseAdmin
        .from("temp_passwords")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("temp_password", tempPassword.trim())
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!tempData) {
        return new Response(
          JSON.stringify({ success: false, error: "Ogiltigt eller utgånget tillfälligt lösenord" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Temp password is valid - update the real password to the temp one and mark as used
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        { password: tempPassword.trim() }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Kunde inte uppdatera lösenordet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark temp password as used
      await supabaseAdmin
        .from("temp_passwords")
        .update({ used: true })
        .eq("id", tempData.id);

      return new Response(
        JSON.stringify({ success: true, message: "Lösenordet har uppdaterats. Logga in med det tillfälliga lösenordet." }),
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
