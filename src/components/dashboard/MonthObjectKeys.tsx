import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';

interface Month {
  id: number;
  date: string;
  month: string;
  object_keys: string[];
}

export const MonthObjectKeys = () => {
  const [months, setMonths] = useState<Month[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchMonths = async () => {
      try {
        const { data, error } = await supabase
          .from('Month')
          .select('*')
          .order('date', { ascending: false })
          .limit(1);

        console.log('Month data from Supabase:', { data, error });

        if (error) {
          throw error;
        }

        if (data && isMounted) {
          setMonths(data);
        }
      } catch (error) {
        console.error('Error fetching months:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMonths();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading object keys...</div>;
  }

  if (!months.length) {
    return <div className="text-sm text-muted-foreground">No month data available</div>;
  }

  const latestMonth = months[0];
  const objectKeys = latestMonth.object_keys || [];

  if (!objectKeys.length) {
    return <div className="text-sm text-muted-foreground">No object keys available for {latestMonth.month}</div>;
  }

  return (
    <div className="mt-2 mb-8">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Available Object Keys for {latestMonth.month}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {objectKeys.map((key) => (
          <Card key={key} className="p-2 glass-morphism">
            <p className="text-xs truncate" title={key}>
              {key}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}; 
