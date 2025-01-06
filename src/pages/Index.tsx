import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContributorCard } from "@/components/ContributorCard";
import { ContributorDetail } from "@/components/ContributorDetail";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, subMonths, startOfMonth, isFuture } from "date-fns";

const Index = () => {
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Format the current month for display
  const formattedMonth = format(currentMonth, "MMMM yyyy");

  const { data: contributors, isLoading } = useQuery({
    queryKey: ["contributors", formattedMonth],
    queryFn: async () => {
      // Mock data for now - replace with actual GitHub API call
      // In real implementation, we would use the currentMonth to fetch data for that specific month
      console.log(`Fetching data for ${formattedMonth}`);
      return Array.from({ length: 8 }, (_, i) => ({
        login: `user${i}`,
        avatar_url: `https://avatars.githubusercontent.com/u/${i}`,
        contributions: Math.floor(Math.random() * 1000),
        pullRequests: Math.floor(Math.random() * 100),
        commits: Math.floor(Math.random() * 500),
        repositories: Math.floor(Math.random() * 20),
        linesOfCode: Math.floor(Math.random() * 50000),
        rank: 0, // Will be calculated after sorting
      }));
    },
  });

  // Sort and rank contributors
  const rankedContributors = contributors
    ?.sort((a, b) => b.contributions - a.contributions)
    .map((contributor, index) => ({
      ...contributor,
      rank: index + 1,
    }));

  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = startOfMonth(subMonths(new Date(), -1));
    if (!isFuture(currentMonth)) {
      setCurrentMonth((prev) => {
        const proposedNext = subMonths(prev, -1);
        return isFuture(proposedNext) ? prev : proposedNext;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <AnimatePresence mode="wait">
        {!selectedContributor ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">myHomeIQ Dev Team Dashboard</h1>
                <p className="text-muted-foreground">
                  Track your team's contributions across all repositories
                </p>
              </div>

              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-4 bg-card rounded-lg p-4 border">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePreviousMonth}
                    className="h-12 w-12"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <span className="text-2xl font-medium min-w-48 text-center">
                    {formattedMonth}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    disabled={isFuture(subMonths(currentMonth, -1))}
                    className="h-12 w-12"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {rankedContributors?.map((contributor) => (
                  <ContributorCard
                    key={contributor.login}
                    contributor={contributor}
                    onClick={() => setSelectedContributor(contributor.login)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-4xl mx-auto"
          >
            <ContributorDetail
              login={selectedContributor}
              onBack={() => setSelectedContributor(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;