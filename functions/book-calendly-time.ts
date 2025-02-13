/// <reference lib="dom" />

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

// Response type for booking result
interface BookingResult {
  success: boolean;
  message: string;
  debug?: {
    url: string;
    error?: string;
    content: string;
  };
}

// Main function to book Calendly time
async function bookCalendlyTime(env: Env, booking: BookingRequest): Promise<BookingResult> {
  try {
    // Construct the Calendly URL with prefilled values
    const name = `${booking.first_name} ${booking.last_name}`;
    const calendlyUrl = `https://calendly.com/jon-myhomeiq/30min/${booking.start_time}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(booking.email)}`;

    // Make request to browserless to perform the booking
    const response = await fetch(`https://myhomeiq-browserless.smallmighty.co/function?token=${env.BROWSERLESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/javascript',
      },
      body: `
        export default async function({ page }) {
          // Set viewport and timeouts
          await page.setViewport({ width: 1280, height: 800 });
          await page.setDefaultNavigationTimeout(15000);
          
          try {
            // Navigate to page and wait 2 seconds
            await page.goto('${calendlyUrl}');
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Click the button and wait 2.5 seconds
            await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const scheduleButton = buttons.find(button => button.textContent.trim() === 'Schedule Event');
              if (scheduleButton) scheduleButton.click();
            });
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Check if URL changed
            const currentUrl = await page.url();
            if (currentUrl.includes('/invitees/')) {
              return {
                data: { success: true, message: 'Appointment booked successfully' },
                type: 'application/json'
              };
            } else {
              // Check for specific error message
              const hasErrorMessage = await page.evaluate(() => {
                const h1s = Array.from(document.querySelectorAll('h1'));
                return h1s.some(h1 => h1.textContent === 'Sorry, that time is no longer available.');
              });
              
              if (hasErrorMessage) {
                return {
                  data: { success: false, message: 'Sorry, that time is no longer available.' },
                  type: 'application/json'
                };
              } else {
                return {
                  data: { success: false, message: 'Something went wrong.' },
                  type: 'application/json'
                };
              }
            }
            
          } catch (error) {
            // Get page state if there's an error
            const currentUrl = await page.url();
            const pageContent = await page.evaluate(() => document.body.innerText);
            
            // Log all details for debugging
            console.log('Calendly booking error:', {
              url: currentUrl,
              error: error.message,
              content: pageContent.substring(0, 500)
            });
            
            return {
              data: { success: false, message: 'Something went wrong.' },
              type: 'application/json'
            };
          }
        }
      `
    });

    if (!response.ok) {
      throw new Error(`Browserless returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    return {
      success: result.data.success,
      message: result.data.message,
      debug: result.data.debug
    };

  } catch (error) {
    console.error('Error booking Calendly time:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
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
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Book the time
      const result = await bookCalendlyTime(env, booking);

      // Return response
      return new Response(
        JSON.stringify(result),
        {
          status: result.success ? 200 : 400,
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
