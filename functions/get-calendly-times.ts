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
async function getCalendlyTimes(eventTypeId: string, calendlyToken: string): Promise<EnrichedAvailableTime[]> {
  // Calculate timestamps
  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Array to collect all available time objects
  const availableTimes: EnrichedAvailableTime[] = [];

  const url = `https://api.calendly.com/event_type_available_times?event_type=${encodeURIComponent(eventTypeId)}&start_time=${encodeURIComponent(fifteenMinutesFromNow)}&end_time=${encodeURIComponent(sevenDaysLater)}`;
  
  try {
    console.log('Using provided Calendly token');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${calendlyToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Error fetching for event type ${eventTypeId}: ${response.statusText}`);
      return [];
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

      // Parse the URL to extract the 'url' parameter
      const url = new URL(request.url);
      const eventTypeId = url.searchParams.get('url');

      // Check if the URL parameter is provided
      if (!eventTypeId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Bad Request',
            message: 'The "url" parameter is required'
          }), 
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Get the Calendly token from the Authorization header
      const authHeader = request.headers.get('Authorization');
      let calendlyToken = '';
      
      // Check if Authorization header exists and has the correct format
      if (authHeader && authHeader.startsWith('Bearer ')) {
        calendlyToken = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
      
      // Ensure we have a token
      if (!calendlyToken) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unauthorized',
            message: 'A valid Authorization header with a Calendly API token is required'
          }), 
          { 
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Get Calendly times
      const times = await getCalendlyTimes(eventTypeId, calendlyToken);
      
      // Create a comma-delimited string of start times
      const startTimesString = times.map(time => time.start_time).join(',');

      // Return the response with startTimes first in the data object
      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          startTimes: startTimesString,
          times: times
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // Enable CORS
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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