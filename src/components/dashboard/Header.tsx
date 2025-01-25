import { useIsMobile } from "@/hooks/use-mobile";
import { MonthSelector } from "./MonthSelector";

export const Header = () => {
  const isMobile = useIsMobile();

  return (
    <div className={`flex ${isMobile ? 'flex-col' : 'flex-row justify-between items-start'} mb-8`}>
      <div className="flex items-center gap-3">
        <img src="/lovable-uploads/716e0ab0-b4ee-4fb2-966d-2597a98a27ec.png" alt="IQ Logo" className="h-8 w-auto" />
        <div>
          <h1 className="text-4xl font-bold mb-2 text-gradient">Dev Team Dashboard</h1>
          <p className="text-muted-foreground">
            Track your team's contributions across all repositories
          </p>
        </div>
      </div>
      {!isMobile && <MonthSelector />}
    </div>
  );
};