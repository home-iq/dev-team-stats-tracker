import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronLeft, GitCommit, GitPullRequest, Code2, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit();

interface ContributorDetailProps {
  login: string;
  onBack: () => void;
}

export const ContributorDetail = ({ login, onBack }: ContributorDetailProps) => {
  const { data: contributor, isLoading: isLoadingContributor } = useQuery({
    queryKey: ["contributor", login],
    queryFn: async () => {
      console.log(`Fetching detailed data for user: ${login}`);
      const { data: user } = await octokit.users.getByUsername({ username: login });
      
      return {
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
        bio: user.bio || "No bio available",
        location: user.location || "Location not specified",
        contributions: 0, // Will be calculated from activities
        pullRequests: 0, // Will be calculated from activities
        commits: 0, // Will be calculated from activities
        repositories: user.public_repos,
        linesOfCode: 0, // This requires additional API calls to calculate
      };
    },
  });

  const { data: activities, isLoading: isLoadingActivities } = useQuery({
    queryKey: ["contributor-activity", login],
    queryFn: async () => {
      console.log(`Fetching activities for user: ${login}`);
      const { data: events } = await octokit.activity.listPublicEventsForUser({
        username: login,
        per_page: 100,
      });

      return events
        .filter((event) => 
          event.type === "PushEvent" || 
          event.type === "PullRequestEvent"
        )
        .map((event) => ({
          id: event.id,
          type: event.type === "PushEvent" ? "commit" : "pull_request",
          repo: event.repo.name,
          title: event.type === "PushEvent" 
            ? `Pushed to ${event.repo.name}`
            : `Pull request in ${event.repo.name}`,
          date: event.created_at,
          linesChanged: 0, // This requires additional API calls to calculate
        }));
    },
  });

  // Group activities by month
  const groupedActivities = activities?.reduce((acc, activity) => {
    const monthKey = format(parseISO(activity.date), 'MMMM yyyy');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(activity);
    return acc;
  }, {} as Record<string, typeof activities>);

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
        <Card className="p-2 md:p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Commits</p>
              <p className="text-lg md:text-2xl font-semibold">{contributor?.commits}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Pull Requests</p>
              <p className="text-lg md:text-2xl font-semibold">{contributor?.pullRequests}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Repositories</p>
              <p className="text-lg md:text-2xl font-semibold">{contributor?.repositories}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Lines of Code</p>
              <p className="text-lg md:text-2xl font-semibold">{contributor?.linesOfCode}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800">
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="p-4 space-y-6">
            {groupedActivities && Object.entries(groupedActivities).map(([month, monthActivities]) => (
              <div key={month} className="space-y-4">
                <h3 className="font-semibold text-lg text-muted-foreground mb-2">{month}</h3>
                {monthActivities.map((activity) => (
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
                        {format(parseISO(activity.date), 'MMM d')}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </motion.div>
  );
};
