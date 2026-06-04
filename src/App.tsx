import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SaveIndicatorProvider } from "@/components/SaveIndicator";
import { InAppBrowserDialog } from "@/components/InAppBrowserDialog";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));
const Privacy = lazy(() => import("./pages/Privacy"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <SaveIndicatorProvider>
          <Toaster />
          <Sonner />
          <InAppBrowserDialog />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Suspense fallback={null}><Index /></Suspense>} />
              <Route path="/index" element={<Suspense fallback={null}><Index /></Suspense>} />
              <Route path="/install" element={<Suspense fallback={null}><Install /></Suspense>} />
              <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
            </Routes>
          </BrowserRouter>
        </SaveIndicatorProvider>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
