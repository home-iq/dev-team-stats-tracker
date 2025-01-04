import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, GitCommit, GitPullRequest, Star, Code2 } from "lucide-react";
import { motion } from "framer-motion";

interface ContributorCardProps {
  contributor: {
    login: string;
    avatar_url: string;
    contributions: number;
    pullRequests: number;
    commits: number;
    repositories: number;
    linesOfCode: number;
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
        className="p-6 cursor-pointer hover:shadow-lg transition-shadow duration-300 relative overflow-hidden group bg-white dark:bg-gray-800"
        onClick={onClick}
      >
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="flex items-start space-x-4">
          <Avatar className="w-16 h-16">
            <img src={contributor.avatar_url} alt={contributor.login} className="object-cover" />
          </Avatar>
          
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{contributor.login}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary" className="flex items-center gap-1">
                <GitCommit className="w-3 h-3" />
                {contributor.commits} commits
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <GitPullRequest className="w-3 h-3" />
                {contributor.pullRequests} PRs
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {contributor.repositories} repos
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Code2 className="w-3 h-3" />
                {contributor.linesOfCode} lines
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Total Contributions
            <span className="float-right font-semibold text-foreground">
              {contributor.contributions}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};