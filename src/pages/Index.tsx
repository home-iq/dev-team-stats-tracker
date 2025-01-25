import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContributorCard } from "@/components/ContributorCard";
import { ContributorDetail } from "@/components/ContributorDetail";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, subMonths, startOfMonth, isFuture } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isMobile = useIsMobile();

  const formattedMonth = format(currentMonth, "MMMM yyyy");

  const { data: contributors, isLoading } = useQuery({
    queryKey: ["contributors", formattedMonth],
    queryFn: async () => {
      console.log(`Fetching data for ${formattedMonth}`);
      return Array.from({ length: 8 }, (_, i) => ({
        login: `user${i}`,
        avatar_url: `https://avatars.githubusercontent.com/u/${i}`,
        contributions: Math.floor(Math.random() * 1000),
        pullRequests: Math.floor(Math.random() * 100),
        commits: Math.floor(Math.random() * 500),
        repositories: Math.floor(Math.random() * 20),
        linesOfCode: Math.floor(Math.random() * 50000),
        rank: 0,
      }));
    },
  });

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

  const MonthSelector = () => (
    <div className={`inline-flex items-center gap-4 glass-morphism rounded-lg p-4 ${isMobile ? 'w-full' : ''}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePreviousMonth}
        className="h-12 w-12 hover:bg-white/10"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <span className="text-2xl font-medium min-w-48 text-center flex-1 text-gradient">
        {formattedMonth}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextMonth}
        disabled={isFuture(subMonths(currentMonth, -1))}
        className="h-12 w-12 hover:bg-white/10"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen p-6 md:p-8">
      <AnimatePresence mode="wait">
        {!selectedContributor ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="max-w-7xl mx-auto">
              <div className={`flex ${isMobile ? 'flex-col' : 'flex-row justify-between items-start'} mb-8`}>
                <div className="flex items-center gap-3">
                  <img src="/lovable-uploads/716e0ab0-b4ee-4fb2-966d-2597a98a27ec.png" alt="IQ Logo" className="h-8 w-auto" />
                  <div>
                    <h1 className="text-4xl font-bold mb-2 text-gradient">Dev Team Dashboard</h1>
                    <p className="text-muted-foreground">
                      Track your team's contributions across all repositories
                    </p>
                  </div>
                </div>
                {!isMobile && <MonthSelector />}
              </div>

              {isMobile && (
                <div className="mb-8">
                  <MonthSelector />
                </div>
              )}

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