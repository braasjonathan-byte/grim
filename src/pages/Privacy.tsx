import { Helmet } from "react-helmet-async";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Integritetspolicy – Grim</title>
        <meta name="description" content="Integritetspolicy för Grim – hur appen samlar in, lagrar och hanterar dina personuppgifter." />
        <link rel="canonical" href="https://grim.lovable.app/privacy" />
      </Helmet>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Integritetspolicy</h1>
          <p className="text-sm text-muted-foreground">Senast uppdaterad: 4 juni 2026</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">1. Personuppgiftsansvarig</h2>
          <p className="text-sm leading-relaxed">
            Grim ("vi", "appen") är personuppgiftsansvarig för behandlingen av dina personuppgifter
            i denna app. Kontakt: support@grim.lovable.app
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">2. Vilka uppgifter vi samlar in</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
            <li><strong>Kontouppgifter:</strong> e-postadress, namn, lösenord (krypterat).</li>
            <li><strong>Profil:</strong> ålder, kön, längd, vikt, träningsmål (frivilligt).</li>
            <li><strong>Trännings- och kostdata:</strong> pass, övningar, måltider, mått, foton du laddar upp.</li>
            <li><strong>Hälso- och sensordata:</strong> puls, GPS-position och rörelse vid pass (endast under aktiv loggning).</li>
            <li><strong>Enhetsdata:</strong> enhetstyp, OS-version, push-token, kraschloggar.</li>
            <li><strong>Användning:</strong> anonymiserad statistik om hur appen används.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">3. Varför vi behandlar uppgifterna</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
            <li>För att leverera appens funktioner (träningsloggning, statistik, planer).</li>
            <li>För att synkronisera dina data mellan enheter.</li>
            <li>För att skicka aviseringar du har valt att ta emot.</li>
            <li>För att förbättra appen och åtgärda fel.</li>
            <li>För att uppfylla rättsliga skyldigheter.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">4. Rättslig grund</h2>
          <p className="text-sm leading-relaxed">
            Behandlingen sker enligt avtal (för att leverera tjänsten), samtycke (känsliga
            uppgifter som hälsa och GPS) och berättigat intresse (förbättring och säkerhet).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">5. Lagring och säkerhet</h2>
          <p className="text-sm leading-relaxed">
            Dina uppgifter lagras krypterat hos våra molnleverantörer (Supabase/EU). Åtkomst skyddas
            med Row Level Security – endast du kan läsa dina data. Vi lagrar uppgifterna så länge
            ditt konto är aktivt eller så länge det krävs enligt lag.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">6. Delning med tredje part</h2>
          <p className="text-sm leading-relaxed">
            Vi säljer aldrig dina uppgifter. Vi delar endast data med underbiträden som behövs för
            att driva tjänsten:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
            <li>Supabase (databas, autentisering, lagring) – EU.</li>
            <li>Google Firebase (push-aviseringar).</li>
            <li>Stripe (betalningar för prenumeration).</li>
            <li>Open Food Facts (näringsdata – ingen personlig data skickas).</li>
            <li>Strava (endast om du frivilligt kopplar ditt konto).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">7. Dina rättigheter (GDPR)</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
            <li>Få tillgång till dina uppgifter.</li>
            <li>Rätta felaktiga uppgifter.</li>
            <li>Radera ditt konto och alla data ("rätten att bli glömd").</li>
            <li>Begränsa eller invända mot viss behandling.</li>
            <li>Dataportabilitet – få ut dina data i maskinläsbart format.</li>
            <li>Lämna klagomål till Integritetsskyddsmyndigheten (IMY).</li>
          </ul>
          <p className="text-sm leading-relaxed">
            Du kan radera ditt konto direkt i appen under Profil → Inställningar, eller kontakta
            support@grim.lovable.app.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">8. Barn</h2>
          <p className="text-sm leading-relaxed">
            Appen är inte avsedd för barn under 13 år. Vi samlar inte medvetet in uppgifter från barn.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">9. Ändringar</h2>
          <p className="text-sm leading-relaxed">
            Vi kan uppdatera denna policy. Väsentliga ändringar meddelas i appen.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold">10. Kontakt</h2>
          <p className="text-sm leading-relaxed">
            Frågor om personuppgifter: <a className="underline" href="mailto:support@grim.lovable.app">support@grim.lovable.app</a>
          </p>
        </section>
      </main>
    </div>
  );
};

export default Privacy;
