import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContributorCard } from "@/components/ContributorCard";
import { ContributorDetail } from "@/components/ContributorDetail";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const Index = () => {
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contributors, isLoading } = useQuery({
    queryKey: ["contributors"],
    queryFn: async () => {
      // Mock data for now - replace with actual GitHub API call
      return Array.from({ length: 8 }, (_, i) => ({
        login: `user${i}`,
        avatar_url: `https://avatars.githubusercontent.com/u/${i}`,
        contributions: Math.floor(Math.random() * 1000),
        pullRequests: Math.floor(Math.random() * 100),
        commits: Math.floor(Math.random() * 500),
        repositories: Math.floor(Math.random() * 20),
      }));
    },
  });

  const filteredContributors = contributors?.filter((contributor) =>
    contributor.login.toLowerCase().includes(searchQuery.toLowerCase())
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
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Team Dashboard</h1>
                <p className="text-muted-foreground">
                  Track your team's contributions across all repositories
                </p>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search contributors..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredContributors?.map((contributor) => (
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