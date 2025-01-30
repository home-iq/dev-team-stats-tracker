import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCommit, GitPullRequest, Star, Code2 } from "lucide-react";
import { motion } from "framer-motion";
import { parseISO } from "date-fns";
import { formatInTimeZone } from 'date-fns-tz';

interface ContributorCardProps {
  contributor: {
    login: string;
    avatar_url: string;
    totalCommits: number;
    totalPrs: number;
    mergedPrs: number;
    activeRepositories: string[];
    linesOfCode: number;
    contributionScore: number;
    rank: number;
    lastActive?: string;
  };
  onClick: () => void;
}

export const ContributorCard = ({ contributor, onClick }: ContributorCardProps) => {
  const truncatedLogin = contributor.login.length > 12 
    ? `${contributor.login.slice(0, 12)}...` 
    : contributor.login;

  const formattedLastActive = contributor.lastActive 
    ? (() => {
        const utcDate = new Date(contributor.lastActive + 'Z'); // Explicitly mark as UTC
        console.log('UTC timestamp:', utcDate.toISOString());
        const formatted = formatInTimeZone(
          utcDate,
          'America/New_York',
          'MMM d, h:mm a \'EST\''
        );
        console.log('Formatted in EST:', formatted);
        return formatted;
      })()
    : 'Unknown';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card
        className="p-6 cursor-pointer transition-all duration-100 ease-out relative overflow-hidden group glass-morphism hover:brightness-90 hover:translate-y-[2px] h-full flex flex-col"
        onClick={onClick}
      >
        <div className="absolute top-4 right-4 z-10 bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border border-primary/20">
          #{contributor.rank}
        </div>
        
        <div className="flex items-start space-x-4 flex-1">
          <Avatar className="w-16 h-16 border-2 border-primary/20 shrink-0">
            <img src={contributor.avatar_url} alt={contributor.login} className="object-cover" />
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-2 text-gradient" title={contributor.login}>{truncatedLogin}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <GitCommit className="w-3 h-3" />
                {contributor.totalCommits} commits
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <GitPullRequest className="w-3 h-3" />
                {contributor.totalPrs} PRs
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <Star className="w-3 h-3" />
                {contributor.activeRepositories.length} repos
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <Code2 className="w-3 h-3" />
                {contributor.linesOfCode.toLocaleString()} lines
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-muted-foreground">Last Active</span>
          <Badge variant="secondary" className="neo-blur">
            {formattedLastActive}
          </Badge>
        </div>

        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="text-sm text-muted-foreground flex items-center justify-between">
            <span>Contribution Score</span>
            <Badge variant="secondary" className="neo-blur">
              {contributor.contributionScore}
            </Badge>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};