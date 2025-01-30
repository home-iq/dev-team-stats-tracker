import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronLeft, GitCommit, GitPullRequest, Code2, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from 'date-fns-tz';
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { contributorsData } from "@/data/contributors";

interface ContributorDetailProps {
  login: string;
  onBack: () => void;
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export const ContributorDetail = ({ 
  login, 
  onBack, 
  currentMonth,
  onPreviousMonth,
  onNextMonth 
}: ContributorDetailProps) => {
  const isMobile = useIsMobile();

  // Find contributor data
  const contributor = Object.values(contributorsData.contributors).find(c => c.login === login);
  const avatar_url = contributor ? `https://avatars.githubusercontent.com/u/${contributor.githubUserId || login}` : '';
  const linesOfCode = contributor ? contributor.linesAdded + contributor.linesRemoved : 0;

  // Get activity data
  const { data: activities } = useQuery({
    queryKey: ["contributor-activity", login, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      return Array.from({ length: 10 }, (_, i) => {
        const type = i % 2 === 0 ? "commit" : "pull_request";
        const repo = `repo-${i}`;
        return {
          id: i,
          type,
          repo,
          title: type === "commit" ? "Commit" : "Pull Request",
          summary: type === "commit" 
            ? "Updated user authentication and fixed responsive layout issues"
            : "feature/user-auth → main",
          date: new Date(currentMonth.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
          linesAdded: Math.floor(Math.random() * 10000),
          linesRemoved: Math.floor(Math.random() * 5000),
        };
      });
    },
  });

  if (!contributor) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold">Contributor not found</h2>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <div className="mb-8">
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row justify-between items-center'}`}>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={onBack}
                size="icon" 
                className="hover:bg-white/10 cursor-pointer focus:ring-2 focus:ring-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Avatar className="w-16 h-16 border-2 border-primary/20">
                <img src={avatar_url} alt={contributor.login} className="object-cover" />
              </Avatar>
              <div>
                <h2 className="text-3xl font-bold mb-0.5 text-gradient">{contributor.login}</h2>
                <p className="text-sm text-muted-foreground">
                  Contribution Score: <span className="font-semibold">{contributor.contributionScore}</span>
                </p>
              </div>
            </div>
          </div>
          {!isMobile && (
            <MonthSelector
              currentMonth={currentMonth}
              onPreviousMonth={onPreviousMonth}
              onNextMonth={onNextMonth}
            />
          )}
        </div>
        {isMobile && (
          <div className="mt-4">
            <MonthSelector
              currentMonth={currentMonth}
              onPreviousMonth={onPreviousMonth}
              onNextMonth={onNextMonth}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
        <Card className="p-2 md:p-4 glass-morphism">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Commits</p>
              <p className="text-lg md:text-2xl font-semibold text-gradient">{contributor.totalCommits}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 glass-morphism">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Pull Requests</p>
              <p className="text-lg md:text-2xl font-semibold text-gradient">{contributor.totalPrs}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 glass-morphism">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Repositories</p>
              <p className="text-lg md:text-2xl font-semibold text-gradient">{contributor.activeRepositories.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 glass-morphism">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Lines of Code</p>
              <p className="text-lg md:text-2xl font-semibold text-gradient">{linesOfCode.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="glass-morphism">
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="p-4 space-y-2">
            {activities?.map((activity) => (
              <Card key={activity.id} className="p-5 neo-blur">
                <div className="md:hidden flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {activity.type === "commit" ? (
                        <GitCommit className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <GitPullRequest className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h4 className="font-medium truncate">{activity.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">{activity.repo}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center shrink-0">
                        <span className="text-base font-bold text-emerald-400 w-[4.5rem] text-right">+{activity.linesAdded.toLocaleString()}</span>
                        <span className="text-base font-bold text-red-400 w-[4.5rem] text-right -ml-1">-{activity.linesRemoved.toLocaleString()}</span>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <Badge variant="secondary" className="neo-blur text-xs">
                          {format(parseISO(activity.date), 'MMM d')}
                        </Badge>
                        <span className="text-xs text-muted-foreground mt-1">
                          {formatInTimeZone(parseISO(activity.date), 'America/New_York', 'h:mm a')} EST
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.summary}</p>
                </div>

                <div className="hidden md:flex items-center gap-3">
                  {activity.type === "commit" ? (
                    <GitCommit className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <GitPullRequest className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex items-center gap-6 flex-1">
                    <div className="w-[120px] shrink-0">
                      <h4 className="font-medium truncate">{activity.title}</h4>
                      <p className="text-sm text-muted-foreground truncate">{activity.repo}</p>
                    </div>
                    <p className="text-sm text-muted-foreground truncate flex-1">{activity.summary}</p>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center shrink-0">
                        <span className="text-lg font-bold text-emerald-400 w-[5rem] text-right">+{activity.linesAdded.toLocaleString()}</span>
                        <span className="text-lg font-bold text-red-400 w-[5rem] text-right -ml-1">-{activity.linesRemoved.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-8">
                    <Badge variant="secondary" className="neo-blur text-sm">
                      {format(parseISO(activity.date), 'MMM d')}
                    </Badge>
                    <span className="text-xs text-muted-foreground mt-1">
                      {formatInTimeZone(parseISO(activity.date), 'America/New_York', 'h:mm a')} EST
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </motion.div>
  );
};