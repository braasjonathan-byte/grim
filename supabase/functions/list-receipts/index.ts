import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Get registered email from user_emails table
    const { data: emailRow } = await supabaseClient
      .from("user_emails")
      .select("email")
      .eq("user_id", user.id)
      .single();

    const registeredEmail = emailRow?.email;
    if (!registeredEmail) {
      return new Response(JSON.stringify({ receipts: [], email: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: registeredEmail, limit: 1 });

    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ receipts: [], email: registeredEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 50,
      status: "paid",
    });

    const receipts = invoices.data.map((inv) => ({
      id: inv.id,
      amount: inv.amount_paid,
      currency: inv.currency,
      date: inv.created,
      description: inv.lines.data[0]?.description || "Supporter-prenumeration",
      receipt_url: inv.hosted_invoice_url,
      pdf_url: inv.invoice_pdf,
      email: registeredEmail,
    }));

    return new Response(JSON.stringify({ receipts, email: registeredEmail }), {
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
