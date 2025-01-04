import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronLeft, GitCommit, GitPullRequest } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ContributorDetailProps {
  login: string;
  onBack: () => void;
}

export const ContributorDetail = ({ login, onBack }: ContributorDetailProps) => {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["contributor-activity", login],
    queryFn: async () => {
      // Mock data for now - replace with actual GitHub API call
      return Array.from({ length: 10 }, (_, i) => ({
        id: i,
        type: i % 2 === 0 ? "commit" : "pull_request",
        repo: `repo-${i}`,
        title: `Activity ${i}`,
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
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
        <h2 className="text-2xl font-semibold">{login}'s Activity</h2>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
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
                </div>
                <Badge variant="secondary">
                  {new Date(activity.date).toLocaleDateString()}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </motion.div>
  );
};