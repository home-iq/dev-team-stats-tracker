import { useIsMobile } from "@/hooks/use-mobile";
import { MonthSelector } from "./MonthSelector";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onMonthChange: (date: Date) => void;
}

export const Header = ({ currentMonth, onPreviousMonth, onNextMonth, onMonthChange }: HeaderProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const handleHomeClick = () => {
    onMonthChange(new Date());
  };

  return (
    <div className={`flex ${isMobile ? 'flex-col' : 'flex-row justify-between items-center'} mb-8`}>
      <div 
        className="flex items-center gap-6 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={handleHomeClick}
      >
        <img src="/lovable-uploads/716e0ab0-b4ee-4fb2-966d-2597a98a27ec.png" alt="IQ Logo" className="h-12 w-auto" />
        <div>
          <h1 className="text-3xl font-bold mb-0.4 text-gradient">Dev Team Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Our team's contributions across all repositories
          </p>
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
  );
};