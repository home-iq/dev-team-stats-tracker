import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronLeft, GitCommit, GitPullRequest, Line, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ContributorDetailProps {
  login: string;
  onBack: () => void;
}

export const ContributorDetail = ({ login, onBack }: ContributorDetailProps) => {
  const { data: contributor, isLoading: isLoadingContributor } = useQuery({
    queryKey: ["contributor", login],
    queryFn: async () => {
      // Mock data for now - replace with actual GitHub API call
      return {
        login,
        name: `${login}'s Full Name`,
        avatar_url: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 1000)}`,
        bio: "Software Engineer passionate about building great products",
        location: "San Francisco, CA",
        contributions: Math.floor(Math.random() * 1000),
        pullRequests: Math.floor(Math.random() * 100),
        commits: Math.floor(Math.random() * 500),
        repositories: Math.floor(Math.random() * 20),
        linesOfCode: Math.floor(Math.random() * 50000),
      };
    },
  });

  const { data: activities, isLoading: isLoadingActivities } = useQuery({
    queryKey: ["contributor-activity", login],
    queryFn: async () => {
      // Mock data for now - replace with actual GitHub API call
      return Array.from({ length: 10 }, (_, i) => ({
        id: i,
        type: i % 2 === 0 ? "commit" : "pull_request",
        repo: `repo-${i}`,
        title: `Activity ${i}`,
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        linesChanged: Math.floor(Math.random() * 100),
      }));
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} size="icon">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <img src={contributor?.avatar_url} alt={contributor?.login} className="object-cover" />
          </Avatar>
          <div>
            <h2 className="text-2xl font-semibold">{contributor?.name}</h2>
            <p className="text-muted-foreground">{contributor?.bio}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Commits</p>
              <p className="text-2xl font-semibold">{contributor?.commits}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Pull Requests</p>
              <p className="text-2xl font-semibold">{contributor?.pullRequests}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Repositories</p>
              <p className="text-2xl font-semibold">{contributor?.repositories}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Line className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Lines of Code</p>
              <p className="text-2xl font-semibold">{contributor?.linesOfCode}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800">
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="p-4 space-y-4">
            {activities?.map((activity) => (
              <Card key={activity.id} className="p-4">
                <div className="flex items-center gap-3">
                  {activity.type === "commit" ? (
                    <GitCommit className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium">{activity.title}</h4>
                    <p className="text-sm text-muted-foreground">{activity.repo}</p>
                    <p className="text-sm text-muted-foreground">
                      Lines changed: {activity.linesChanged}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {new Date(activity.date).toLocaleDateString()}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </motion.div>
  );
};