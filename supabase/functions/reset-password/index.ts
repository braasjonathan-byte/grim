import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Generic response to prevent user enumeration
const GENERIC_NOT_FOUND = { success: true, hasQuestions: false, message: "Om kontot finns kommer du att kunna återställa lösenordet." };

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
}

async function checkRateLimit(
  supabaseAdmin: any,
  ip: string,
  nickname: string
): Promise<{ allowed: boolean; message?: string }> {
  const key = `${ip}:${nickname.toLowerCase()}`;
  
  const { data: existing } = await supabaseAdmin
    .from("password_reset_attempts")
    .select("*")
    .eq("ip_address", ip)
    .eq("nickname_attempted", nickname.toLowerCase())
    .maybeSingle();

  if (existing) {
    // Check if locked
    if (existing.locked_until && new Date(existing.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(existing.locked_until).getTime() - Date.now()) / 60000);
      return { allowed: false, message: `För många försök. Försök igen om ${minutesLeft} minuter.` };
    }

    // Reset if lockout expired
    if (existing.locked_until && new Date(existing.locked_until) <= new Date()) {
      await supabaseAdmin
        .from("password_reset_attempts")
        .update({ attempt_count: 1, last_attempt_at: new Date().toISOString(), locked_until: null })
        .eq("id", existing.id);
      return { allowed: true };
    }

    // Increment
    const newCount = existing.attempt_count + 1;
    const update: any = { attempt_count: newCount, last_attempt_at: new Date().toISOString() };
    if (newCount >= MAX_ATTEMPTS) {
      update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    }
    await supabaseAdmin
      .from("password_reset_attempts")
      .update(update)
      .eq("id", existing.id);

    if (newCount >= MAX_ATTEMPTS) {
      return { allowed: false, message: `För många försök. Försök igen om ${LOCKOUT_MINUTES} minuter.` };
    }
  } else {
    await supabaseAdmin
      .from("password_reset_attempts")
      .insert({ ip_address: ip, nickname_attempted: nickname.toLowerCase() });
  }

  return { allowed: true };
}

async function resetRateLimit(supabaseAdmin: any, ip: string, nickname: string) {
  await supabaseAdmin
    .from("password_reset_attempts")
    .delete()
    .eq("ip_address", ip)
    .eq("nickname_attempted", nickname.toLowerCase());
}

async function hashAnswer(answer: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(answer.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { nickname, action, answers, newPassword } = body;

    // Admin action: fix auth email + password for a user by nickname
    if (action === "admin-fix-auth") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseAdminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user: caller } } = await supabaseUser.auth.getUser();
      if (!caller) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Check caller is admin
      const { data: isAdmin } = await supabaseAdminClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!nickname || !newPassword || newPassword.length < 8) {
        return new Response(JSON.stringify({ error: "nickname and newPassword (8+ chars) required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: profile } = await supabaseAdminClient.from("profiles").select("user_id").ilike("nickname", nickname.trim()).maybeSingle();
      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const newEmail = `${nickname.trim().toLowerCase()}@trainapp.local`;
      const { error: updateError } = await supabaseAdminClient.auth.admin.updateUserById(profile.user_id, {
        email: newEmail,
        password: newPassword.trim(),
        email_confirm: true,
      });
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabaseAdminClient.from("profiles").update({ must_change_password: false }).eq("user_id", profile.user_id);
      return new Response(JSON.stringify({ success: true, email: newEmail, userId: profile.user_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!nickname || typeof nickname !== "string" || nickname.trim().length < 2 || nickname.trim().length > 50) {
      return new Response(
        JSON.stringify({ error: "Ogiltigt användarnamn" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip = getClientIp(req);

    // Rate limit check
    const rateCheck = await checkRateLimit(supabaseAdmin, ip, nickname.trim());
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateCheck.message }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up profile by nickname
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("nickname", nickname.trim())
      .maybeSingle();

    // Consistent response whether account exists or not (prevent enumeration)
    if (profileError || !profile) {
      return new Response(
        JSON.stringify(GENERIC_NOT_FOUND),
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
            JSON.stringify(GENERIC_NOT_FOUND),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: true, hasQuestions: false, hasEmail: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract question index from answer_hash
      const questions = secData.map((row) => {
        // Support both old format "qIdx:answer" and new format "qIdx:sha256hash"
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

    // Step 2: Verify answers and set new password
    if (action === "verify-answers") {
      if (!answers || !Array.isArray(answers) || answers.length !== 4) {
        return new Response(
          JSON.stringify({ error: "Alla 4 svar krävs" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate answers are strings with reasonable length
      for (const a of answers) {
        if (typeof a !== "string" || a.trim().length === 0 || a.trim().length > 100) {
          return new Response(
            JSON.stringify({ error: "Ogiltigt svar" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 8 || newPassword.trim().length > 128) {
        return new Response(
          JSON.stringify({ error: "Nytt lösenord måste vara 8-128 tecken" }),
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
          JSON.stringify({ error: "Återställning misslyckades" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let allCorrect = true;
      for (let i = 0; i < 4; i++) {
        const stored = secData[i].answer_hash;
        const parts = stored.split(":");
        const storedValue = parts.slice(1).join(":");
        const provided = (answers[i] || "").trim().toLowerCase();

        // Check if stored value is a SHA-256 hash (64 hex chars) or plaintext
        if (storedValue.length === 64 && /^[0-9a-f]+$/.test(storedValue)) {
          // New hashed format
          const providedHash = await hashAnswer(provided);
          if (storedValue !== providedHash) {
            allCorrect = false;
            break;
          }
        } else {
          // Legacy plaintext format
          if (storedValue.toLowerCase() !== provided) {
            allCorrect = false;
            break;
          }
        }
      }

      if (!allCorrect) {
        return new Response(
          JSON.stringify({ success: false, error: "Ett eller flera svar är felaktiga" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Answers correct - reset rate limit and set password
      await resetRateLimit(supabaseAdmin, ip, nickname.trim());

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

      return new Response(
        JSON.stringify({ success: true, message: "Lösenordet har ändrats! Du kan nu logga in med ditt nya lösenord." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Email-based reset - generate temp password and send via email
    if (action === "email-reset") {
      if (!userEmail) {
        return new Response(
          JSON.stringify({ error: "Återställning misslyckades" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate a random temporary password
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let tempPassword = "";
      const randomBytes = new Uint8Array(12);
      crypto.getRandomValues(randomBytes);
      for (const byte of randomBytes) {
        tempPassword += chars[byte % chars.length];
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        { password: tempPassword }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Kunde inte uppdatera lösenordet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: true })
        .eq("user_id", profile.user_id);

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const emailHtml = `
          <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="margin: 0 0 16px; font-size: 20px;">Tillfälligt lösenord</h2>
            <p style="color: #444; line-height: 1.5;">Ditt tillfälliga lösenord är:</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; background: #f4f4f4; padding: 16px; border-radius: 8px; text-align: center; font-family: monospace;">${tempPassword}</p>
            <p style="color: #444; line-height: 1.5;">Logga in med detta lösenord. Du kommer att bli ombedd att välja ett nytt lösenord direkt.</p>
            <p style="color: #888; font-size: 12px; margin-top: 24px;">Om du inte begärt detta, kontakta en administratör omedelbart.</p>
          </div>
        `;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "GRIM <onboarding@resend.dev>",
            to: [userEmail],
            subject: "Ditt tillfälliga lösenord",
            html: emailHtml,
          }),
        });
      }

      await resetRateLimit(supabaseAdmin, ip, nickname.trim());

      return new Response(
        JSON.stringify({ success: true, message: "Ett tillfälligt lösenord har skickats till din e-post. Logga in med det och välj sedan ett nytt lösenord." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save security answers (hashed) - new endpoint
    if (action === "save-answers") {
      // This action requires authentication
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = claimsData.claims.sub;
      const { questionIndices, answerTexts } = body;

      if (!questionIndices || !answerTexts || !Array.isArray(questionIndices) || !Array.isArray(answerTexts) ||
          questionIndices.length !== 4 || answerTexts.length !== 4) {
        return new Response(
          JSON.stringify({ error: "4 frågor och svar krävs" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate inputs
      for (let i = 0; i < 4; i++) {
        if (typeof questionIndices[i] !== "number" || questionIndices[i] < 0 || questionIndices[i] >= SECURITY_QUESTIONS.length) {
          return new Response(
            JSON.stringify({ error: "Ogiltig fråga" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (typeof answerTexts[i] !== "string" || answerTexts[i].trim().length === 0 || answerTexts[i].trim().length > 100) {
          return new Response(
            JSON.stringify({ error: "Ogiltigt svar" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Hash answers server-side
      const rows = [];
      for (let i = 0; i < 4; i++) {
        const hashed = await hashAnswer(answerTexts[i]);
        rows.push({
          user_id: userId,
          question_index: i,
          answer_hash: `${questionIndices[i]}:${hashed}`,
        });
      }

      // Delete old answers and insert new
      await supabaseAdmin
        .from("security_answers")
        .delete()
        .eq("user_id", userId);

      const { error: insertError } = await supabaseAdmin
        .from("security_answers")
        .insert(rows);

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Kunde inte spara säkerhetsfrågor" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
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
