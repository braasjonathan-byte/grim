import { lazyRetry } from "@/lib/lazyRetry";
import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SaveIndicatorProvider } from "@/components/SaveIndicator";
import { InAppBrowserDialog } from "@/components/InAppBrowserDialog";
import RouteNavigationHost from "@/components/RouteNavigationHost";
import HeartRateWidget from "@/components/HeartRateWidget";
import { startWakeLockManager } from "@/lib/wakeLock";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import ConnectionNotice from "@/components/ConnectionNotice";

// Synlig laddning i stället för null: en tom Suspense-fallback gav en helt
// tom skärm (bara temabakgrunden) medan/om sidchunken inte laddade.
const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-2 border-muted border-t-foreground animate-spin" />
  </div>
);

const Index = lazyRetry(() => import("./pages/Index"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const Install = lazyRetry(() => import("./pages/Install"));
const Privacy = lazyRetry(() => import("./pages/Privacy"));
const DeleteAccount = lazyRetry(() => import("./pages/DeleteAccount"));
const OAuthConsent = lazyRetry(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient();

startWakeLockManager();

const App = () => (
  <AppErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <SaveIndicatorProvider>
          <Toaster />
          <Sonner />
          <InAppBrowserDialog />
          <RouteNavigationHost />
          <HeartRateWidget />
          <ConnectionNotice />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Suspense fallback={<RouteFallback />}><Index /></Suspense>} />
              <Route path="/index" element={<Suspense fallback={<RouteFallback />}><Index /></Suspense>} />
              <Route path="/install" element={<Suspense fallback={<RouteFallback />}><Install /></Suspense>} />
              <Route path="/privacy" element={<Suspense fallback={<RouteFallback />}><Privacy /></Suspense>} />
              <Route path="/integritetspolicy" element={<Suspense fallback={<RouteFallback />}><Privacy /></Suspense>} />
              <Route path="/delete-account" element={<Suspense fallback={<RouteFallback />}><DeleteAccount /></Suspense>} />
              <Route path="/radera-konto" element={<Suspense fallback={<RouteFallback />}><DeleteAccount /></Suspense>} />
              <Route path="/.lovable/oauth/consent" element={<Suspense fallback={<RouteFallback />}><OAuthConsent /></Suspense>} />
              <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFound /></Suspense>} />
            </Routes>
          </BrowserRouter>
        </SaveIndicatorProvider>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
