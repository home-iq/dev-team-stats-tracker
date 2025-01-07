import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContributorCard } from "@/components/ContributorCard";
import { ContributorDetail } from "@/components/ContributorDetail";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, subMonths, startOfMonth, isFuture } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Octokit } from "@octokit/rest";

// Initialize Octokit
const octokit = new Octokit();

const Index = () => {
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isMobile = useIsMobile();
  const [orgName, setOrgName] = useState("your-org-name"); // Replace with your org name

  // Format the current month for display
  const formattedMonth = format(currentMonth, "MMMM yyyy");

  const { data: contributors, isLoading } = useQuery({
    queryKey: ["contributors", formattedMonth, orgName],
    queryFn: async () => {
      console.log(`Fetching data for ${formattedMonth} from GitHub org: ${orgName}`);
      
      try {
        // Get all repositories for the organization
        const { data: repos } = await octokit.repos.listForOrg({
          org: orgName,
          per_page: 100,
        });

        // Get contributors for each repository
        const contributorsMap = new Map();

        await Promise.all(
          repos.map(async (repo) => {
            try {
              const { data: repoContributors } = await octokit.repos.listContributors({
                owner: orgName,
                repo: repo.name,
                per_page: 100,
              });

              repoContributors.forEach((contributor) => {
                if (contributorsMap.has(contributor.login)) {
                  const existing = contributorsMap.get(contributor.login);
                  contributorsMap.set(contributor.login, {
                    ...existing,
                    contributions: existing.contributions + contributor.contributions,
                  });
                } else {
                  contributorsMap.set(contributor.login, {
                    login: contributor.login,
                    avatar_url: contributor.avatar_url,
                    contributions: contributor.contributions,
                    pullRequests: 0, // Will be populated in next step
                    commits: contributor.contributions,
                    repositories: 1,
                    linesOfCode: 0, // This requires additional API calls to calculate
                  });
                }
              });
            } catch (error) {
              console.error(`Error fetching contributors for ${repo.name}:`, error);
            }
          })
        );

        // Convert map to array and sort by contributions
        const contributorsArray = Array.from(contributorsMap.values());
        return contributorsArray;
      } catch (error) {
        console.error("Error fetching GitHub data:", error);
        throw error;
      }
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

  const MonthSelector = () => (
    <div className={`inline-flex items-center gap-4 bg-card rounded-lg p-4 border ${isMobile ? 'w-full' : ''}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePreviousMonth}
        className="h-12 w-12"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <span className="text-2xl font-medium min-w-48 text-center flex-1">
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
  );

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
              <div className={`flex ${isMobile ? 'flex-col' : 'flex-row justify-between items-start'} mb-8`}>
                <div>
                  <h1 className="text-4xl font-bold mb-2">myHomeIQ Dev Team Dashboard</h1>
                  <p className="text-muted-foreground">
                    Track your team's contributions across all repositories
                  </p>
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