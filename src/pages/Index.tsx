import { useState, useEffect } from "react";
import { ContributorCard } from "@/components/ContributorCard";
import { ContributorDetail } from "@/components/ContributorDetail";
import { format, subMonths, startOfMonth, isFuture, parse } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";
import { Header } from "@/components/dashboard/Header";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { OverallStats } from "@/components/dashboard/OverallStats";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { supabase } from "@/lib/supabase";

interface Contributor {
  login?: string;
  githubUserId?: string;
  totalCommits: number;
  totalPrs: number;
  mergedPrs: number;
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
  const [monthsData, setMonthsData] = useState<Month[]>([]);
  const [currentMonthData, setCurrentMonthData] = useState<Month | null>(null);
  const [availableMonths, setAvailableMonths] = useState<Date[]>([]);
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

  // Get the current active month based on the view
  const currentMonth = contributorId ? contributorMonth : dashboardMonth;
  const formattedMonth = format(currentMonth, "MMMM yyyy");
  const urlFormattedMonth = format(currentMonth, "MMMM-yyyy").toLowerCase();

  // Fetch all months data at once
  useEffect(() => {
    const fetchAllMonthsData = async () => {
      // Only show loading states if we don't have any data yet
      if (monthsData.length === 0) {
        setIsLoading(true);
        setShowContent(false);
      }

      try {
        const { data, error } = await supabase
          .from('Month')
          .select('*')
          .order('date', { ascending: false });

        if (error) {
          throw error;
        }

        if (data) {
          setMonthsData(data);
          setAvailableMonths(data.map(m => new Date(m.date)));
          
          // Set initial month data
          const monthStart = startOfMonth(currentMonth);
          const initialMonthData = data.find(
            m => format(new Date(m.date), "yyyy-MM") === format(monthStart, "yyyy-MM")
          );
          
          if (initialMonthData) {
            setCurrentMonthData(initialMonthData);
          } else {
            setCurrentMonthData(null);
          }

          // Only show loading animation on initial load
          if (monthsData.length === 0) {
            const loadingEndTime = Math.max(1200 - (Date.now() - startTime), 0);
            setTimeout(() => {
              setIsLoading(false);
              setTimeout(() => {
                setShowContent(true);
              }, 300);
            }, loadingEndTime);
          }
        }
      } catch (error) {
        console.error('Error fetching months data:', error);
        setIsLoading(false);
        setShowContent(true);
      }
    };

    const startTime = Date.now();
    fetchAllMonthsData();
  }, []);

  // Update current month data when month changes
  useEffect(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthData = monthsData.find(
      m => format(new Date(m.date), "yyyy-MM") === format(monthStart, "yyyy-MM")
    );
    setCurrentMonthData(monthData || null);
  }, [currentMonth, monthsData]);

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

  // Update handlePreviousMonth and handleNextMonth
  const handlePreviousMonth = () => {
    const currentIndex = availableMonths.findIndex(
      m => format(m, "yyyy-MM") === format(currentMonth, "yyyy-MM")
    );
    
    if (currentIndex < availableMonths.length - 1) {
      handleMonthChange(availableMonths[currentIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = availableMonths.findIndex(
      m => format(m, "yyyy-MM") === format(currentMonth, "yyyy-MM")
    );
    
    if (currentIndex > 0) {
      handleMonthChange(availableMonths[currentIndex - 1]);
    }
  };

  // Pass available months to MonthSelector
  const monthSelectorProps = {
    currentMonth,
    onPreviousMonth: handlePreviousMonth,
    onNextMonth: handleNextMonth,
    availableMonths,
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

  // Don't render anything until we have initial data
  if (isLoading) {
    return (
      <div className="min-h-screen p-6 md:p-8 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!showContent) {
    return (
      <div className="min-h-screen p-6 md:p-8 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <LoadingSpinner />
        </motion.div>
      </div>
    );
  }

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
                {...monthSelectorProps}
                onMonthChange={handleMonthChange}
              />
              
              {isMobile && (
                <div className="mb-8">
                  <MonthSelector {...monthSelectorProps} />
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
                ) : showContent && currentMonthData ? (
                  <motion.div 
                    key="content"
                  >
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <OverallStats overall={currentMonthData.stats.overall} />
                    </motion.div>
                    <motion.div 
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      variants={container}
                      initial="hidden"
                      animate="show"
                    >
                      {currentMonthData.stats.contributors && 
                        Object.entries(currentMonthData.stats.contributors)
                          .sort(([, a], [, b]) => {
                            const scoreCompare = (b.contributionScore || 0) - (a.contributionScore || 0);
                            if (scoreCompare === 0) {
                              return a.login?.localeCompare(b.login || '') || 0;
                            }
                            return scoreCompare;
                          })
                          .map(([login, contributor], index) => (
                            <ContributorCard
                              key={login}
                              contributor={{
                                login: contributor.login || login,
                                avatar_url: `https://avatars.githubusercontent.com/u/${contributor.githubUserId || login}`,
                                totalCommits: contributor.totalCommits,
                                totalPrs: contributor.totalPrs,
                                mergedPrs: contributor.mergedPrs,
                                activeRepositories: contributor.activeRepositories || [],
                                linesOfCode: (contributor.linesAdded || 0) + (contributor.linesRemoved || 0),
                                contributionScore: contributor.contributionScore || 0,
                                rank: index + 1,
                              }}
                              onClick={() => {
                                setContributorMonth(dashboardMonth);
                                navigate(`/contributor/${contributor.login || login}/${urlFormattedMonth}`);
                              }}
                            />
                          ))
                      }
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
              monthData={currentMonthData}
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