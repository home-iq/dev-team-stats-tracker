import { useState, useEffect } from "react";
import { ContributorCard } from "@/components/ContributorCard";
import { ContributorDetail } from "@/components/ContributorDetail";
import { format, subMonths, startOfMonth, isFuture, parse } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";
import { Header } from "@/components/dashboard/Header";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { OverallStats } from "@/components/dashboard/OverallStats";
import { MonthObjectKeys } from "@/components/dashboard/MonthObjectKeys";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { supabase } from "@/lib/supabase";

interface Contributor {
  githubUserId?: string;
  totalCommits: number;
  totalPrs: number;
  activeRepositories: string[];
  linesAdded: number;
  linesRemoved: number;
  contributionScore: number;
  rank?: number;
}

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
    contributors: Record<string, Contributor>;
    object_keys: string[];
  };
}

const Index = () => {
  const navigate = useNavigate();
  const { contributorId, month } = useParams();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [monthData, setMonthData] = useState<Month | null>(null);

  // Separate month states for dashboard and contributor detail
  const [dashboardMonth, setDashboardMonth] = useState(() => {
    if (!contributorId && month) {
      try {
        return parse(month, 'MMMM-yyyy', new Date());
      } catch {
        return new Date();
      }
    }
    return new Date();
  });

  const [contributorMonth, setContributorMonth] = useState(() => {
    if (contributorId && month) {
      try {
        return parse(month, 'MMMM-yyyy', new Date());
      } catch {
        return new Date();
      }
    }
    return new Date();
  });

  useEffect(() => {
    const fetchMonthData = async () => {
      try {
        console.log('Fetching month data...');
        const { data, error } = await supabase
          .from('Month')
          .select('*')
          .order('date', { ascending: false })
          .limit(1);

        console.log('Supabase response:', { data, error });

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          console.log('Setting month data:', data[0]);
          setMonthData(data[0]);
        }
      } catch (error) {
        console.error('Error fetching month data:', error);
      } finally {
        setIsLoading(false);
        setShowContent(true);
      }
    };

    fetchMonthData();
  }, []);

  // Get the current active month based on the view
  const currentMonth = contributorId ? contributorMonth : dashboardMonth;
  const formattedMonth = format(currentMonth, "MMMM yyyy");
  const urlFormattedMonth = format(currentMonth, "MMMM-yyyy").toLowerCase();

  // Update month states when URL changes
  useEffect(() => {
    if (month) {
      try {
        const parsedMonth = parse(month, 'MMMM-yyyy', new Date());
        if (contributorId) {
          setContributorMonth(parsedMonth);
        } else {
          setDashboardMonth(parsedMonth);
        }
      } catch {
        // Invalid month format, keep current month
      }
    } else if (!contributorId) {
      // No month in URL and on dashboard, reset to current month
      setDashboardMonth(new Date());
    }
  }, [month, contributorId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contributorId) {
        const dashboardMonthStr = format(dashboardMonth, "MMMM-yyyy").toLowerCase();
        if (format(dashboardMonth, "yyyy-MM") !== format(new Date(), "yyyy-MM")) {
          navigate(`/${dashboardMonthStr}`);
        } else {
          navigate('/');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contributorId, navigate, dashboardMonth]);

  const handleMonthChange = (newMonth: Date) => {
    const monthString = format(newMonth, "MMMM-yyyy").toLowerCase();
    if (contributorId) {
      setContributorMonth(newMonth);
      navigate(`/contributor/${contributorId}/${monthString}`);
    } else {
      setDashboardMonth(newMonth);
      if (format(newMonth, "yyyy-MM") !== format(new Date(), "yyyy-MM")) {
        navigate(`/${monthString}`);
      } else {
        navigate('/');
      }
    }
  };

  const handlePreviousMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    handleMonthChange(newMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = startOfMonth(subMonths(new Date(), -1));
    if (!isFuture(currentMonth)) {
      const proposedNext = subMonths(currentMonth, -1);
      if (!isFuture(proposedNext)) {
        handleMonthChange(proposedNext);
      }
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <AnimatePresence mode="wait" initial={false}>
        {!contributorId ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="max-w-7xl mx-auto">
              <Header 
                currentMonth={dashboardMonth}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                onMonthChange={handleMonthChange}
              />
              
              {isMobile && (
                <div className="mb-8">
                  <MonthSelector
                    currentMonth={dashboardMonth}
                    onPreviousMonth={handlePreviousMonth}
                    onNextMonth={handleNextMonth}
                  />
                </div>
              )}

              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LoadingSpinner />
                  </motion.div>
                ) : showContent && monthData ? (
                  <motion.div 
                    key="content"
                  >
                    <OverallStats overall={monthData.stats.overall} />
                    <MonthObjectKeys />
                    <motion.div 
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      variants={container}
                      initial="hidden"
                      animate="show"
                    >
                      {monthData.stats.contributors && Object.entries(monthData.stats.contributors).map(([login, contributor]) => (
                        <ContributorCard
                          key={login}
                          contributor={{
                            login,
                            avatar_url: `https://avatars.githubusercontent.com/u/${contributor.githubUserId || login}`,
                            totalCommits: contributor.totalCommits,
                            totalPrs: contributor.totalPrs,
                            activeRepositories: contributor.activeRepositories || [],
                            linesOfCode: (contributor.linesAdded || 0) + (contributor.linesRemoved || 0),
                            contributionScore: contributor.contributionScore || 0,
                            rank: contributor.rank || 0,
                          }}
                          onClick={() => {
                            setContributorMonth(dashboardMonth);
                            navigate(`/contributor/${login}/${urlFormattedMonth}`);
                          }}
                        />
                      ))}
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto"
          >
            <ContributorDetail
              login={contributorId}
              currentMonth={contributorMonth}
              onPreviousMonth={handlePreviousMonth}
              onNextMonth={handleNextMonth}
              onBack={() => {
                const dashboardMonthStr = format(dashboardMonth, "MMMM-yyyy").toLowerCase();
                if (format(dashboardMonth, "yyyy-MM") !== format(new Date(), "yyyy-MM")) {
                  navigate(`/${dashboardMonthStr}`);
                } else {
                  navigate('/');
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;