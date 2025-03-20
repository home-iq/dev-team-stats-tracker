import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import TestSdr from "./pages/TestSdr";
import V0PromptHighlightsPage from "./pages/V0PromptHighlights";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/:month" element={<Index />} />
          <Route path="/contributor/:contributorId" element={<Index />} />
          <Route path="/contributor/:contributorId/:month" element={<Index />} />
          <Route path="/test-sdr" element={<TestSdr />} />
          <Route path="/v0-prompt-highlights" element={<V0PromptHighlightsPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
