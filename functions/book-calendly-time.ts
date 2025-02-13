// Types for environment variables
export interface Env {
  BROWSERLESS_TOKEN: string;
}

// Cloudflare Worker types
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Types for request body
interface BookingRequest {
  start_time: string;
  first_name: string;
  last_name: string;
  email: string;
}

// Main function to book Calendly time
async function bookCalendlyTime(env: Env, booking: BookingRequest): Promise<boolean> {
  const browserlessEndpoint = `https://myhomeiq-browserless.smallmighty.co/screenshot?token=${env.BROWSERLESS_TOKEN}`;
  
  try {
    // Construct the Calendly URL with prefilled values
    const name = `${booking.first_name} ${booking.last_name}`;
    const calendlyUrl = `https://calendly.com/jon-myhomeiq/30min/${booking.start_time}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(booking.email)}`;

    // Make a POST request to browserless to execute the script
    const response = await fetch(browserlessEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: calendlyUrl,
        viewport: {
          width: 1280,
          height: 800
        },
        waitForFunction: {
          fn: `async () => {
            // Wait for the page to be fully loaded
            await new Promise(resolve => {
              if (document.readyState === 'complete') {
                resolve(true);
              } else {
                window.addEventListener('load', resolve);
              }
            });
            
            // Wait a bit for any dynamic content
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('Looking for submit button...');
            const submitButton = document.querySelector('button[type="submit"]');
            console.log('Submit button found:', !!submitButton);
            
            if (submitButton) {
              console.log('Clicking submit button...');
              submitButton.click();
              
              // Wait for navigation to complete
              await new Promise(resolve => {
                let attempts = 0;
                const checkUrl = () => {
                  if (window.location.href.includes('calendly.com/invitees/') || attempts >= 10) {
                    resolve(true);
                  } else {
                    attempts++;
                    setTimeout(checkUrl, 1000);
                  }
                };
                checkUrl();
              });
              
              return window.location.href.includes('calendly.com/invitees/');
            }
            return false;
          }`,
          polling: 1000,
          timeout: 30000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Browserless returned ${response.status}: ${await response.text()}`);
    }

    // The screenshot endpoint returns a binary image if successful
    // If we get here, it means the script completed and returned true
    return true;

  } catch (error) {
    console.error('Error booking Calendly time:', error);
    return false;
  }
}

// Main worker object
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Only allow POST requests
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      // Parse request body
      const booking = await request.json() as BookingRequest;

      // Validate required fields
      if (!booking.start_time || !booking.first_name || !booking.last_name || !booking.email) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields',
            message: 'start_time, first_name, last_name, and email are required'
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }

      // Book the time
      const success = await bookCalendlyTime(env, booking);

      // Return response
      return new Response(
        JSON.stringify({
          success,
          message: success ? 'Appointment booked successfully' : 'Failed to book appointment'
        }),
        {
          status: success ? 200 : 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );
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
