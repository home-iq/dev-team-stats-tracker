import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContributorCard } from "@/components/ContributorCard";
import { ContributorDetail } from "@/components/ContributorDetail";
import { format, subMonths, startOfMonth, isFuture, parse, parseISO } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";
import { Header } from "@/components/dashboard/Header";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useNavigate, useParams } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const { contributorId, month } = useParams();
  const isMobile = useIsMobile();

  // Initialize currentMonth from URL or default to current date
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (month) {
      try {
        return parse(month, 'MMMM-yyyy', new Date());
      } catch {
        return new Date();
      }
    }
    return new Date();
  });

  const formattedMonth = format(currentMonth, "MMMM yyyy");
  const urlFormattedMonth = format(currentMonth, "MMMM-yyyy").toLowerCase();

  // Update currentMonth when URL changes
  useEffect(() => {
    if (month) {
      try {
        const parsedMonth = parse(month, 'MMMM-yyyy', new Date());
        setCurrentMonth(parsedMonth);
      } catch {
        // Invalid month format, keep current month
      }
    } else {
      // No month in URL, reset to current month
      setCurrentMonth(new Date());
    }
  }, [month]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contributorId) {
        if (format(currentMonth, "yyyy-MM") !== format(new Date(), "yyyy-MM")) {
          navigate(`/${urlFormattedMonth}`);
        } else {
          navigate('/');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contributorId, navigate, currentMonth, urlFormattedMonth]);

  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth);
    const monthString = format(newMonth, "MMMM-yyyy").toLowerCase();
    if (contributorId) {
      navigate(`/contributor/${contributorId}/${monthString}`);
    } else if (format(newMonth, "yyyy-MM") !== format(new Date(), "yyyy-MM")) {
      // Only add month to URL if it's not the current month
      navigate(`/${monthString}`);
    } else {
      // If it's the current month, use the clean index route
      navigate(`/`);
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

  const { data: contributors, isLoading } = useQuery({
    queryKey: ["contributors", formattedMonth],
    queryFn: async () => {
      console.log(`Fetching data for ${formattedMonth}`);
      return Array.from({ length: 8 }, (_, i) => ({
        login: `user${i}`,
        avatar_url: `https://avatars.githubusercontent.com/u/${i}`,
        contributions: Math.floor(Math.random() * 1000),
        pullRequests: Math.floor(Math.random() * 100),
        commits: Math.floor(Math.random() * 500),
        repositories: Math.floor(Math.random() * 20),
        linesOfCode: Math.floor(Math.random() * 50000),
        lastActivity: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
        rank: 0,
      }));
    },
  });

  const rankedContributors = contributors
    ?.sort((a, b) => b.contributions - a.contributions)
    .map((contributor, index) => ({
      ...contributor,
      rank: index + 1,
    }));

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
                currentMonth={currentMonth}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                onMonthChange={handleMonthChange}
              />
              
              {isMobile && (
                <div className="mb-8">
                  <MonthSelector
                    currentMonth={currentMonth}
                    onPreviousMonth={handlePreviousMonth}
                    onNextMonth={handleNextMonth}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {rankedContributors?.map((contributor) => (
                  <ContributorCard
                    key={contributor.login}
                    contributor={contributor}
                    onClick={() => navigate(`/contributor/${contributor.login}/${urlFormattedMonth}`)}
                  />
                ))}
              </div>
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
              currentMonth={currentMonth}
              onPreviousMonth={handlePreviousMonth}
              onNextMonth={handleNextMonth}
              onBack={() => {
                if (format(currentMonth, "yyyy-MM") !== format(new Date(), "yyyy-MM")) {
                  navigate(`/${urlFormattedMonth}`);
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