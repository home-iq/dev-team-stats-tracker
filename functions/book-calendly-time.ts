// Types for environment variables
export interface Env {
  BROWSERLESS_TOKEN: string;
  VAPI_SECRET: string;  // Add secret to env interface
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

// Types for request body
interface VapiRequest {
  message: {
    tool_calls: Array<{
      function: {
        arguments: BookingRequest;
      };
    }>;
  };
}

// Response type for booking result
interface BookingResult {
  data?: {
    success: boolean;
    message: string;
    debug?: {
      url: string;
      error?: string;
      content: string;
    };
  };
  error?: {
    message: string;
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
                data: { 
                  success: true, 
                  message: 'Appointment booked successfully' 
                },
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
                  data: { 
                    success: false, 
                    message: 'Sorry, that time is no longer available.' 
                  },
                  type: 'application/json'
                };
              } else {
                return {
                  data: { 
                    success: false, 
                    message: 'Something went wrong.' 
                  },
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
              data: { 
                success: false, 
                message: 'Something went wrong.',
                debug: {
                  url: currentUrl,
                  error: error.message,
                  content: pageContent.substring(0, 500)
                }
              },
              type: 'application/json'
            };
          }
        }
      `
    });

    if (!response.ok) {
      throw new Error(`Browserless returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json() as { 
      data: { 
        success: boolean; 
        message: string; 
        debug?: { 
          url: string; 
          error?: string; 
          content: string; 
        }; 
      }; 
    };
    return {
      data: {
        success: result.data.success,
        message: result.data.message,
        debug: result.data.debug
      }
    };

  } catch (error) {
    console.error('Error booking Calendly time:', error);
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Main worker object
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Check for required secret header
      const authHeader = request.headers.get('x-vapi-secret');
      if (!authHeader || authHeader !== env.VAPI_SECRET) {
        return new Response(JSON.stringify({ 
          error: { message: 'Unauthorized' }
        }), { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type, x-vapi-secret'
          }
        });
      }

      // Only allow POST requests
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({
          error: { message: 'Method not allowed' }
        }), { status: 405 });
      }

      // Parse request body
      const vapiRequest = await request.json() as VapiRequest;
      const booking = vapiRequest.message.tool_calls[0].function.arguments;

      // Validate required fields
      if (!booking.start_time || !booking.first_name || !booking.last_name || !booking.email) {
        return new Response(
          JSON.stringify({
            error: { message: 'start_time, first_name, last_name, and email are required' }
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
          status: result.data?.success ? 200 : 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type, x-vapi-secret'
          }
        }
      );
    } catch (err) {
      console.error('Error processing request:', err);
      return new Response(
        JSON.stringify({
          error: { message: err instanceof Error ? err.message : 'Unknown error' }
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
