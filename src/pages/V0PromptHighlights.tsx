import V0PromptHighlights from "../components/V0PromptHighlights";

export default function V0PromptHighlightsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="py-6 bg-white dark:bg-gray-950 shadow-sm border-b">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">V0 Prompt Design Principles</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Learn effective prompting techniques from Vercel's V0 system prompt
          </p>
        </div>
      </header>
      <main className="container mx-auto px-4">
        <V0PromptHighlights />
      </main>
      <footer className="mt-12 py-6 text-center text-gray-500 dark:text-gray-400 border-t">
        <p>Created to educate and inspire about AI prompt engineering</p>
      </footer>
    </div>
  );
} 