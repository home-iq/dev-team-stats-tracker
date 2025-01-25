import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, subMonths, startOfMonth, isFuture } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface MonthSelectorProps {
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export const MonthSelector = ({ currentMonth, onPreviousMonth, onNextMonth }: MonthSelectorProps) => {
  const isMobile = useIsMobile();
  const formattedMonth = format(currentMonth, "MMMM yyyy");

  return (
    <div className={`inline-flex items-center gap-4 glass-morphism rounded-lg p-3 ${
      isMobile 
        ? 'w-full' 
        : 'w-full md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]'
    }`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onPreviousMonth}
        className="h-10 w-10 hover:bg-white/10"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="text-xl font-medium min-w-48 text-center flex-1 text-gradient">
        {formattedMonth}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNextMonth}
        disabled={isFuture(subMonths(currentMonth, -1))}
        className="h-11 w-11 hover:bg-white/10"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
};