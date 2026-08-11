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
import { startWakeLockManager } from "@/lib/wakeLock";

const Index = lazyRetry(() => import("./pages/Index"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const Install = lazyRetry(() => import("./pages/Install"));
const Privacy = lazyRetry(() => import("./pages/Privacy"));
const DeleteAccount = lazyRetry(() => import("./pages/DeleteAccount"));

const queryClient = new QueryClient();

startWakeLockManager();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <SaveIndicatorProvider>
          <Toaster />
          <Sonner />
          <InAppBrowserDialog />
          <RouteNavigationHost />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Suspense fallback={null}><Index /></Suspense>} />
              <Route path="/index" element={<Suspense fallback={null}><Index /></Suspense>} />
              <Route path="/install" element={<Suspense fallback={null}><Install /></Suspense>} />
              <Route path="/privacy" element={<Suspense fallback={null}><Privacy /></Suspense>} />
              <Route path="/integritetspolicy" element={<Suspense fallback={null}><Privacy /></Suspense>} />
              <Route path="/delete-account" element={<Suspense fallback={null}><DeleteAccount /></Suspense>} />
              <Route path="/radera-konto" element={<Suspense fallback={null}><DeleteAccount /></Suspense>} />
              <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
            </Routes>
          </BrowserRouter>
        </SaveIndicatorProvider>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
