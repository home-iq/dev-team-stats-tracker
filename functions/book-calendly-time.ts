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
  calendar_web_url: string;
  phone: string;  // Add phone field
}

// Types for request body
interface VapiRequest {
  message: {
    toolCalls: Array<{
      id: string;  // This is the toolCallId we need
      function: {
        arguments: BookingRequest;
      };
    }>;
  };
}

interface VapiResponse {
  results: Array<{
    toolCallId: string;
    result: BookingResult;  // Using our specific type instead of any
  }>;
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
    // Construct the Calendly URL with prefilled values for name and email
    const name = `${booking.first_name} ${booking.last_name}`;
    
    // Ensure the calendar_web_url ends with a slash before appending parameters
    let baseUrl = booking.calendar_web_url;
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    
    // Include name and email as URL parameters for prefilling
    const calendlyUrl = `${baseUrl}${booking.start_time}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(booking.email)}`;

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
            // Navigate to page and wait 3.5 seconds
            await page.goto('${calendlyUrl}');
            await new Promise(resolve => setTimeout(resolve, 3500));

            // Fill in all form fields and click button
            await page.evaluate((userData) => {
              // Get the form fields
              const fullNameInput = document.querySelector('input[name="full_name"]');
              const firstNameInput = document.querySelector('input[name="first_name"]');
              const lastNameInput = document.querySelector('input[name="last_name"]');
              const emailInput = document.querySelector('input[name="email"]');
              const phoneInputs = Array.from(document.querySelectorAll('input[type="tel"]'));
              
              // Handle name fields - either full name or first/last name fields
              if (fullNameInput) {
                // Single full name field
                fullNameInput.value = userData.name;
                fullNameInput.dispatchEvent(new Event('input', { bubbles: true }));
              } else if (firstNameInput && lastNameInput) {
                // Separate first and last name fields
                firstNameInput.value = userData.firstName;
                firstNameInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                lastNameInput.value = userData.lastName;
                lastNameInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
              
              // Fill in email field
              if (emailInput) {
                emailInput.value = userData.email;
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
              }

              // Fill in phone fields if they exist
              if (phoneInputs.length > 0) {
                // Fill the first (required) phone field
                phoneInputs[0].value = userData.phone;
                phoneInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                
                // If there's a second phone field (for SMS), fill that too
                if (phoneInputs.length > 1) {
                  phoneInputs[1].value = userData.phone;
                  phoneInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
                }
              }

              // Find and click the button
              const buttons = Array.from(document.querySelectorAll('button'));
              const scheduleButton = buttons.find(button => button.textContent.trim() === 'Schedule Event');
              if (scheduleButton) scheduleButton.click();
            }, {
              name: '${booking.first_name} ${booking.last_name}',
              firstName: '${booking.first_name}',
              lastName: '${booking.last_name}',
              email: '${booking.email}',
              phone: '${booking.phone || ""}'
            });
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Check if URL changed and get page content
            const currentUrl = await page.url();
            const pageContent = await page.evaluate(() => document.body.innerText);
            console.log('Final Calendly URL:', currentUrl);

            if (currentUrl.includes('/invitees/')) {
              return {
                data: { 
                  success: true, 
                  message: 'Appointment booked successfully',
                  debug: {
                    url: currentUrl,
                    content: pageContent.substring(0, 500)
                  }
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
                    message: 'Sorry, that time is no longer available.',
                    debug: {
                      url: currentUrl,
                      content: pageContent.substring(0, 500)
                    }
                  },
                  type: 'application/json'
                };
              } else {
                return {
                  data: { 
                    success: false, 
                    message: 'Something went wrong.',
                    debug: {
                      url: currentUrl,
                      content: pageContent.substring(0, 500)
                    }
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
    const bookingResult = {
      success: result.data.success,
      message: result.data.message,
      debug: result.data.debug
    };
    console.log('BookingResult:', JSON.stringify(bookingResult, null, 2));
    return bookingResult;

  } catch (error) {
    console.error('Error booking Calendly time:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
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
      console.log('Received Vapi request:', JSON.stringify(vapiRequest, null, 2));
      
      // Validate Vapi request structure
      if (!vapiRequest?.message?.toolCalls?.length) {
        console.log('Invalid Vapi request structure:', vapiRequest);
        return new Response(
          JSON.stringify({
            error: { message: 'Invalid request format' }
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const booking = vapiRequest.message.toolCalls[0].function.arguments;

      // Log validation details
      console.log('Validation check details:', {
        start_time: booking.start_time || false,
        first_name: booking.first_name || false,
        last_name: booking.last_name || false,
        email: booking.email || false,
        calendar_web_url: booking.calendar_web_url || false,
        phone: booking.phone || false
      });

      // Validate required fields (phone is always provided but may not be used if the form doesn't have phone fields)
      if (!booking.start_time || !booking.first_name || !booking.last_name || !booking.email || !booking.calendar_web_url || !booking.phone) {
        return new Response(
          JSON.stringify({
            error: { message: 'start_time, first_name, last_name, email, calendar_web_url, and phone are required' }
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Book the time
      const result = await bookCalendlyTime(env, booking);

      // Format response for Vapi
      const vapiResponse: VapiResponse = {
        results: [{
          toolCallId: vapiRequest.message.toolCalls[0].id,
          result: result  // No need to stringify, can pass the object directly
        }]
      };

      console.log('Returning to Vapi:', JSON.stringify(vapiResponse, null, 2));

      // Return response
      return new Response(
        JSON.stringify(vapiResponse),
        {
          status: result.success ? 200 : 400,
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
