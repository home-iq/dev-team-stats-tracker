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
import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface Month {
  id: string;
  date: string;
  teamId: string;
  createdAt: string;
  stats: {
    overall: {
      totalPrs: number;
      mergedPrs: number;
      linesAdded: number;
      linesRemoved: number;
      totalCommits: number;
      averageContributionScore: number;
    };
    contributors: Record<string, {
      login?: string;
      githubUserId?: string;
      totalCommits: number;
      totalPrs: number;
      activeRepositories: string[];
      linesAdded: number;
      linesRemoved: number;
      contributionScore: number;
      rank?: number;
      mergedPrs: number;
    }>;
    object_keys: string[];
  };
}

interface Activity {
  id: string;
  type: 'commit' | 'pull_request';
  title: string;
  repo: string;
  summary: string;
  date: string;
  linesAdded: number;
  linesRemoved: number;
}

interface CommitResponse {
  id: string;
  githubCommitId: string;
  message: string;
  linesAdded: number;
  linesDeleted: number;
  committedAt: string;
  url: string | null;
  repo: { name: string } | null;
}

interface PullRequestResponse {
  id: string;
  title: string;
  description: string | null;
  sourceBranch: string;
  targetBranch: string;
  mergedAt: string;
  url: string | null;
  linesAdded: number;
  linesDeleted: number;
  repo: { name: string } | null;
}

interface ContributorData {
  id: string;
  name: string;
  githubUserId: string;
  githubLogin: string;
  avatarUrl?: string;
  cursorEmail?: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

interface ContributorDetailProps {
  login?: string;
  currentMonth: Date;
  monthData: Month | null;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onBack: () => void;
  availableMonths: Date[];
  lastActive?: string;
  contributorRecords: Record<string, ContributorData>;
}

export const ContributorDetail = ({ 
  login, 
  onBack, 
  currentMonth,
  monthData,
  onPreviousMonth,
  onNextMonth,
  availableMonths,
  lastActive,
  contributorRecords
}: ContributorDetailProps) => {
  const isMobile = useIsMobile();

  // Get activity data
  const { data: activities, isLoading } = useQuery({
    queryKey: ["contributor-activity", login, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      if (!login) return [];
      
      // Find the contributor record by login
      const contributor = Object.values(contributorRecords).find(
        record => record.githubLogin === login
      );

      if (!contributor) {
        console.log('No contributor found for login:', login);
        return [];
      }

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      console.log('Fetching activities for:', {
        login,
        contributorId: contributor.id,
        monthStart: monthStart.toISOString(),
        monthEnd: monthEnd.toISOString()
      });

      // Fetch commits and PRs in parallel
      const [{ data: commits, error: commitError }, { data: prs, error: prError }] = await Promise.all([
        supabase
          .from('Commit')
          .select(`
            id,
            githubCommitId,
            message,
            linesAdded,
            linesDeleted,
            committedAt,
            url,
            repo:Repo(name)
          `)
          .eq('authorId', contributor.id)
          .gte('committedAt', monthStart.toISOString())
          .lt('committedAt', monthEnd.toISOString())
          .order('committedAt', { ascending: false })
          .returns<CommitResponse[]>(),
        
        supabase
          .from('PullRequest')
          .select(`
            id,
            title,
            description,
            sourceBranch,
            targetBranch,
            mergedAt,
            url,
            linesAdded,
            linesDeleted,
            repo:Repo(name)
          `)
          .eq('authorId', contributor.id)
          .gte('mergedAt', monthStart.toISOString())
          .lt('mergedAt', monthEnd.toISOString())
          .order('mergedAt', { ascending: false })
          .returns<PullRequestResponse[]>()
      ]);

      console.log('Query results:', {
        commits,
        commitError,
        prs,
        prError
      });

      // Transform and combine the data
      const activities: Activity[] = [
        ...(commits || []).map(commit => ({
          id: commit.id,
          type: 'commit' as const,
          title: 'Commit',
          repo: commit.repo?.name || 'Unknown',
          summary: commit.message,
          date: commit.committedAt,
          linesAdded: commit.linesAdded,
          linesRemoved: commit.linesDeleted,
          url: commit.url
        })),
        ...(prs || []).map(pr => ({
          id: pr.id,
          type: 'pull_request' as const,
          title: pr.title,
          repo: pr.repo?.name || 'Unknown',
          summary: `${pr.sourceBranch} → ${pr.targetBranch}`,
          date: pr.mergedAt,
          linesAdded: pr.linesAdded,
          linesRemoved: pr.linesDeleted,
          url: pr.url
        }))
      ];

      // Sort by date, most recent first
      return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  });

  // Loading shimmer effect
  const Shimmer = () => (
    <div className="animate-pulse">
      <Card className="p-5 neo-blur">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-muted-foreground/20 rounded-full shrink-0" />
          <div className="flex items-center gap-6 flex-1">
            <div className="w-[120px] shrink-0">
              <div className="h-5 bg-muted-foreground/20 rounded mb-2" />
              <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
            </div>
            <div className="flex-1 h-4 bg-muted-foreground/20 rounded" />
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-24 h-6 bg-muted-foreground/20 rounded" />
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 ml-8">
            <div className="w-20 h-6 bg-muted-foreground/20 rounded mb-1" />
            <div className="w-16 h-4 bg-muted-foreground/20 rounded" />
          </div>
        </div>
      </Card>
    </div>
  );

  if (!login || !monthData) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold">Contributor not found</h2>
      </div>
    );
  }

  // Find contributor by login in the contributors object
  const contributorEntry = Object.entries(monthData.stats.contributors).find(
    ([_, contributor]) => contributor.login === login
  );

  if (!contributorEntry) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold">Contributor data not found</h2>
      </div>
    );
  }

  const [githubUserId, contributor] = contributorEntry;
  const avatar_url = `https://avatars.githubusercontent.com/u/${contributor.githubUserId || githubUserId}`;
  const linesOfCode = (contributor.linesAdded || 0) + (contributor.linesRemoved || 0);

  const formattedLastActive = lastActive 
    ? (() => {
        const utcDate = new Date(lastActive + 'Z'); // Explicitly mark as UTC
        return formatInTimeZone(
          utcDate,
          'America/New_York',
          'MMM d, h:mm a \'EST\''
        );
      })()
    : 'Unknown';

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
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={onBack}
              size="icon" 
              className="mr-1 hover:bg-white/10 cursor-pointer focus:ring-2 focus:ring-white/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Avatar className="w-16 h-16 border-2 border-primary/20">
              <img src={avatar_url} alt={contributor.login || login} className="object-cover" />
            </Avatar>
            <div className="ml-4">
              <h2 className="text-3xl font-bold mb-1.5 text-gradient">{contributor.login || login}</h2>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Last Active</span>
                  <Badge variant="secondary" className="neo-blur">
                    {formattedLastActive}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Contribution Score</span>
                  <Badge variant="secondary" className="neo-blur">
                    {contributor.contributionScore}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          {!isMobile && (
            <MonthSelector
              currentMonth={currentMonth}
              onPreviousMonth={onPreviousMonth}
              onNextMonth={onNextMonth}
              availableMonths={availableMonths}
            />
          )}
        </div>
        {isMobile && (
          <div className="mt-4">
            <MonthSelector
              currentMonth={currentMonth}
              onPreviousMonth={onPreviousMonth}
              onNextMonth={onNextMonth}
              availableMonths={availableMonths}
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
              <p className="text-xs md:text-sm text-muted-foreground truncate">Merged PRs</p>
              <p className="text-lg md:text-2xl font-semibold text-gradient">{contributor.mergedPrs}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 glass-morphism">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-emerald-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Lines Added</p>
              <p className="text-lg md:text-2xl font-semibold text-emerald-400">+{contributor.linesAdded.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-2 md:p-4 glass-morphism">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-red-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Lines Removed</p>
              <p className="text-lg md:text-2xl font-semibold text-red-400">-{contributor.linesRemoved.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="glass-morphism overflow-hidden">
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="px-6 py-4 space-y-2">
            {isLoading ? (
              <>
                <Shimmer />
                <Shimmer />
                <Shimmer />
                <Shimmer />
                <Shimmer />
              </>
            ) : activities?.map((activity) => (
              <Card key={activity.id} className="p-4 neo-blur overflow-hidden w-full">
                <div className="md:hidden flex flex-col gap-2 w-full">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {activity.type === "commit" ? (
                        <GitCommit className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <GitPullRequest className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium truncate">{activity.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">{activity.repo}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                      <Badge variant="secondary" className="neo-blur text-xs whitespace-nowrap">
                        {format(parseISO(activity.date), 'MMM d')}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatInTimeZone(parseISO(activity.date), 'America/New_York', 'h:mm a')} EST
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 w-full">
                    <p className="text-sm text-muted-foreground truncate flex-1">{activity.summary}</p>
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      <span className="text-sm font-bold text-emerald-400 whitespace-nowrap">+{activity.linesAdded.toLocaleString()}</span>
                      <span className="text-sm font-bold text-red-400 whitespace-nowrap">-{activity.linesRemoved.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="hidden md:grid md:grid-cols-[auto_120px_1fr_auto_auto] md:gap-4 md:items-center">
                  {activity.type === "commit" ? (
                    <GitCommit className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <GitPullRequest className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-medium truncate">{activity.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">{activity.repo}</p>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{activity.summary}</p>
                  <div className="flex items-center shrink-0">
                    <span className="text-sm font-bold text-emerald-400 w-16 text-right">+{activity.linesAdded.toLocaleString()}</span>
                    <span className="text-sm font-bold text-red-400 w-16 text-right">-{activity.linesRemoved.toLocaleString()}</span>
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
              </Card>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </motion.div>
  );
};