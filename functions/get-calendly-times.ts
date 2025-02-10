// Types for environment variables
export interface Env {
  CALENDLY_API_TOKEN: string;
}

// Cloudflare Worker types
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Types for Calendly API responses
interface CalendlyAvailableTime {
  start_time: string;
  invitee_start_time: string;
  status: string;
}

interface CalendlyResponse {
  collection: CalendlyAvailableTime[];
  pagination: {
    count: number;
    next_page: string | null;
  };
}

interface EnrichedAvailableTime extends CalendlyAvailableTime {
  event_type_id: string;
}

// Main function to get Calendly times
async function getCalendlyTimes(env: Env): Promise<EnrichedAvailableTime[]> {
  // Constant array of event type IDs (using full resource URLs)
  const eventTypeIds = [
    "https://api.calendly.com/event_types/c4fe39b5-c6bb-41fa-a035-1d3c79de3c7e"
  ];

  // Calculate timestamps
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const sixDaysLater = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();

  // Array to collect all available time objects
  const availableTimes: EnrichedAvailableTime[] = [];

  // Loop through each event type id
  for (const eventTypeId of eventTypeIds) {
    const url = `https://api.calendly.com/event_type_available_times?event_type=${encodeURIComponent(eventTypeId)}&start_time=${encodeURIComponent(fifteenMinutesFromNow)}&end_time=${encodeURIComponent(sixDaysLater)}`;
    
    try {
      console.log('Using token:', env.CALENDLY_API_TOKEN ? 'Token exists' : 'No token found');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.CALENDLY_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`Error fetching for event type ${eventTypeId}: ${response.statusText}`);
        continue;
      }
      
      const data = await response.json() as CalendlyResponse;
      
      if (data.collection && Array.isArray(data.collection)) {
        const enrichedTimes = data.collection.map(item => ({
          ...item,
          event_type_id: eventTypeId
        }));
        availableTimes.push(...enrichedTimes);
      }
    } catch (error) {
      console.error(`Error processing event type ${eventTypeId}:`, error);
    }
  }

  // Sort availableTimes in ascending order
  return availableTimes.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

// Main worker object
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Only allow GET requests
      if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
      }

      // Get Calendly times
      const times = await getCalendlyTimes(env);

      // Return the response
      return new Response(JSON.stringify({ success: true, data: times }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // Enable CORS
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    } catch (err) {
      console.error('Error processing request:', err);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Internal server error',
          message: err instanceof Error ? err.message : 'Unknown error'
        }), 
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};

export default worker;

// Export handleRequest for Vite development
export const handleRequest = async (request: Request, env: Env) => {
  return worker.fetch(request, env, {
    waitUntil: () => {},
    passThroughOnException: () => {}
  });
};

interface PagesContext {
  request: Request;
  env: Env;
  params: { [key: string]: string };
}

// Export the onRequest handler for Cloudflare Pages Functions
export const onRequest = async (context: PagesContext) => {
  const { request, env } = context;
  return handleRequest(request, env);
}; 