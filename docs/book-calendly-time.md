# Book Calendly Time Function

This document explains the implementation and usage of the `book-calendly-time` Cloudflare Worker function that automates the process of booking appointments through Calendly.

## Overview

The Book Calendly Time function is a Cloudflare Worker that automates the process of filling out and submitting Calendly booking forms. It's designed to be used as part of a conversational AI system to allow virtual assistants to directly book appointments on behalf of users.

The function uses the Browserless API to programmatically complete Calendly booking forms with provided user information, including:
- First and last name
- Email address
- Phone number
- Specific time slot to book

## Key Features

- **Headless Browser Automation**: Uses Browserless to automate form filling and submission
- **Error Handling**: Comprehensive error handling for failed bookings, including detection of unavailable time slots
- **Authentication**: Secure API endpoint requiring a secret key
- **VAPI Integration**: Designed to work with VAPI's tool calling format for AI assistants
- **Debugging**: Includes detailed debugging information for troubleshooting failed bookings

## API Specification

### Endpoint

POST to the deployed Cloudflare Worker URL (e.g., `https://book-calendly-time.yourdomain.workers.dev`)

### Authentication

The request must include an `x-vapi-secret` header with the correct secret value configured in the Cloudflare Worker environment.

### Request Format

The request body must follow the VAPI tool calling format:

```json
{
  "message": {
    "toolCalls": [
      {
        "id": "unique-tool-call-id",
        "function": {
          "arguments": {
            "start_time": "2023-06-15T14:00:00-07:00",
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "calendar_web_url": "https://calendly.com/example/30min",
            "phone": "+11234567890"
          }
        }
      }
    ]
  }
}
```

#### Required Fields

- `start_time`: ISO 8601 timestamp with timezone offset (from Calendly availability)
- `first_name`: Customer's first name
- `last_name`: Customer's last name
- `email`: Customer's email address
- `calendar_web_url`: Base Calendly URL for the meeting type
- `phone`: Customer's phone number (will be used if the form has a phone field)

### Response Format

The response follows the VAPI tool result format:

```json
{
  "results": [
    {
      "toolCallId": "unique-tool-call-id",
      "result": {
        "success": true,
        "message": "Appointment booked successfully",
        "debug": {
          "url": "https://calendly.com/example/30min/confirmation",
          "content": "Confirmation page content..."
        }
      }
    }
  ]
}
```

#### Response Fields

- `success`: Boolean indicating whether the booking was successful
- `message`: Description of the result
- `debug`: Object containing debugging information
  - `url`: The final URL after form submission
  - `error`: Error message (if applicable)
  - `content`: First 500 characters of the page content for debugging

### Error Responses

1. **Authentication Failure**:
   - Status Code: 401
   - Response: `{ "error": { "message": "Unauthorized" } }`

2. **Invalid Method**:
   - Status Code: 405
   - Response: `{ "error": { "message": "Method not allowed" } }`

3. **Invalid Request Format**:
   - Status Code: 400
   - Response: `{ "error": { "message": "Invalid request format" } }`

4. **Missing Required Fields**:
   - Status Code: 400
   - Response: `{ "error": { "message": "start_time, first_name, last_name, email, calendar_web_url, and phone are required" } }`

5. **Booking Failure**:
   - Status Code: 400
   - Response includes the debug information about what went wrong

## Implementation Details

### Technology Stack

- **Cloudflare Workers**: Serverless JavaScript runtime
- **Browserless API**: Headless browser automation service
- **TypeScript**: For type-safe code

### Key Components

1. **Main Worker Handler**:
   - Handles incoming HTTP requests
   - Validates authentication and request format
   - Processes booking requests
   - Returns formatted responses

2. **Booking Function**:
   - Constructs the Calendly URL with the specified time
   - Uses Browserless to automate form filling
   - Detects booking success or failure
   - Captures debugging information

3. **Form Filling Logic**:
   - Handles both combined and separate name fields
   - Supports phone number fields
   - Simulates human-like form interaction with delays
   - Clicks the correct "Schedule Event" button

### Environment Variables

The function requires the following environment variables to be set in the Cloudflare Workers environment:

- `BROWSERLESS_TOKEN`: Authentication token for the Browserless API
- `VAPI_SECRET`: Secret key for authenticating incoming requests

## Usage in AI Assistant Workflows

This function is designed to be called by an AI assistant using tool calling capabilities. The typical workflow is:

1. AI assistant collects user information and preferred appointment time
2. AI identifies a suitable time slot from available Calendly times
3. AI calls the `book-calendly-time` function with the appropriate parameters
4. Function attempts to book the appointment and returns the result
5. AI communicates the booking result to the user

### Example Usage with n8n Template Processor

The function works well with the n8n template processor documented in `n8n-template-processor.md`. The AI can use the timezone-specific timestamps that appear after the dash (-) character next to available times:

```
7:00am - 2023-06-15T07:00:00-07:00
```

The timestamp part (`2023-06-15T07:00:00-07:00`) should be used as the `start_time` parameter to ensure the correct timeslot is booked.

## Error Handling

The function includes several layers of error handling:

1. **Request Validation**: Ensures all required fields are present
2. **Browserless Errors**: Catches and reports failures in the browser automation
3. **Time Availability**: Detects when a selected time is no longer available
4. **Form Submission Errors**: Captures and reports failures in the form submission process

Debug information is included in the response to help troubleshoot issues.

## Implementation Notes

- Delays are built into the form filling process to ensure reliable automation
- The function verifies successful booking by checking the final URL
- Phone number fields are handled specially due to their unique behavior
- The function supports both single name fields and separate first/last name fields

## Security Considerations

- The function enforces authentication using the `x-vapi-secret` header
- Sensitive information is logged for debugging but not exposed in responses
- The Browserless token is stored as an environment variable and never exposed

## Known Limitations

- Custom fields beyond name, email, and phone may not be handled automatically
- Changes to Calendly's form structure may require updates to the automation logic
- Very high booking volumes may be rate-limited by Calendly or Browserless 