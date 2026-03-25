import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALWAYS_HONORARY_NICKNAMES = ["jonne", "wilma02"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("nickname, is_honorary, referred_by")
      .eq("user_id", user.id)
      .single();

    const nickname = profile?.nickname?.toLowerCase() ?? "";
    const isAlwaysHonorary = ALWAYS_HONORARY_NICKNAMES.includes(nickname);
    const wasHonoraryViaReferral = !!profile?.referred_by && profile?.is_honorary === true;

    const { data: emailRow } = await supabaseClient
      .from("user_emails")
      .select("email, stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    const registeredEmail = emailRow?.email;
    let stripeCustomerId = emailRow?.stripe_customer_id;

    let hasActiveSub = false;
    let subscriptionEnd = null;

    if (registeredEmail || stripeCustomerId) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // Find customer: prefer stored ID, fall back to email lookup
      if (!stripeCustomerId && registeredEmail) {
        const customers = await stripe.customers.list({ email: registeredEmail, limit: 1 });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
          // Persist for future lookups
          await supabaseClient
            .from("user_emails")
            .update({ stripe_customer_id: stripeCustomerId })
            .eq("user_id", user.id);
        }
      }

      if (stripeCustomerId) {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: "active",
          limit: 1,
        });

        hasActiveSub = subscriptions.data.length > 0;

        if (hasActiveSub) {
          const subscription = subscriptions.data[0];
          subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        }
      }
    }

    const shouldBeHonorary = hasActiveSub || isAlwaysHonorary || wasHonoraryViaReferral;
    await supabaseClient
      .from("profiles")
      .update({ is_honorary: shouldBeHonorary })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_end: subscriptionEnd,
      is_honorary: shouldBeHonorary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
