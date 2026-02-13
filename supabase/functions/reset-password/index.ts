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
    const { nickname } = await req.json();

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

    const genericMessage = "Om kontot finns och har en e-post skickas ett nytt lösenord dit.";

    if (profileError || !profile || !profile.email) {
      return new Response(
        JSON.stringify({ success: true, message: genericMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a new random password
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
    let tempPassword = "";
    for (let i = 0; i < 12; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    // Update user's password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.user_id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error("Failed to reset password:", updateError);
      return new Response(
        JSON.stringify({ error: "Kunde inte återställa lösenordet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send the temp password via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "E-posttjänsten är inte konfigurerad" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailHtml = `
      <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 16px; font-size: 20px;">Lösenordsåterställning</h2>
        <p style="color: #444; line-height: 1.5;">Hej! Ditt lösenord har återställts. Använd lösenordet nedan för att logga in:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; font-family: monospace; font-size: 22px; letter-spacing: 2px; margin: 20px 0; color: #111;">
          ${tempPassword}
        </div>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">Logga in och byt sedan lösenord i inställningarna.</p>
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
        subject: "Ditt nya tillfälliga lösenord",
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

    // Masked email for confirmation
    const emailParts = profile.email.split("@");
    const maskedEmail = emailParts[0].substring(0, 2) + "***@" + emailParts[1];

    return new Response(
      JSON.stringify({
        success: true,
        maskedEmail,
        message: `Ett nytt lösenord har skickats till ${maskedEmail}.`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Reset password error:", err);
    return new Response(
      JSON.stringify({ error: "Något gick fel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
