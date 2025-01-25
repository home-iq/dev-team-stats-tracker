import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, GitCommit, GitPullRequest, Star, Code2 } from "lucide-react";
import { motion } from "framer-motion";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";

interface ContributorCardProps {
  contributor: {
    login: string;
    avatar_url: string;
    contributions: number;
    pullRequests: number;
    commits: number;
    repositories: number;
    linesOfCode: number;
    rank: number;
    lastActivity: string;
  };
  onClick: () => void;
}

export const ContributorCard = ({ contributor, onClick }: ContributorCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className="p-6 cursor-pointer transition-all duration-100 ease-out relative overflow-hidden group glass-morphism hover:brightness-90 hover:translate-y-[2px]"
        onClick={onClick}
      >
        <div className="absolute top-4 right-4 z-10 bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border border-primary/20">
          #{contributor.rank}
        </div>
        
        <div className="flex items-start space-x-4">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <img src={contributor.avatar_url} alt={contributor.login} className="object-cover" />
          </Avatar>
          
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2 text-gradient">{contributor.login}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <GitCommit className="w-3 h-3" />
                {contributor.commits} commits
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <GitPullRequest className="w-3 h-3" />
                {contributor.pullRequests} PRs
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <Star className="w-3 h-3" />
                {contributor.repositories} repos
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 neo-blur">
                <Code2 className="w-3 h-3" />
                {contributor.linesOfCode} lines
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground mt-4">
          Last Activity
          <span className="float-right">
            {formatInTimeZone(parseISO(contributor.lastActivity), 'America/New_York', 'MMM d @ h:mm a')} EST
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-sm text-muted-foreground">
            Contribution Score
            <span className="float-right font-semibold text-foreground">
              {contributor.contributions}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};