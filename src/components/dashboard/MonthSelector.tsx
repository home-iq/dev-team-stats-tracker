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
    <div className={`inline-flex items-center gap-4 glass-morphism rounded-lg p-4 ${isMobile ? 'w-full' : ''}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onPreviousMonth}
        className="h-12 w-12 hover:bg-white/10"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <span className="text-2xl font-medium min-w-48 text-center flex-1 text-gradient">
        {formattedMonth}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNextMonth}
        disabled={isFuture(subMonths(currentMonth, -1))}
        className="h-12 w-12 hover:bg-white/10"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </div>
  );
};