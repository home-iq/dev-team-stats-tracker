# get-calendly-times.ts Documentation

## Overview

The `get-calendly-times.ts` Cloudflare Worker is a critical component of the Voice Agent system that provides a consistent API interface for retrieving available appointment times from Calendly. This service acts as middleware between the n8n workflows and Calendly's API, enabling our voice agent to offer up-to-date scheduling options during calls.

## Purpose

This worker serves several important functions:

1. **Simplified Time Retrieval**: Provides a streamlined endpoint to fetch Calendly availability
2. **Consistent Formatting**: Delivers appointment times in formats that can be easily presented by the voice agent
3. **Date Range Management**: Automatically calculates appropriate time windows (15 minutes from now to 7 days later)
4. **Authentication Handling**: Manages Calendly API authentication securely
5. **Sorting**: Returns time slots in chronological order for clear presentation

## Technical Implementation

### Endpoint Details

- **URL**: Part of our Cloudflare Workers deployment
- **Method**: GET
- **Authentication**: Requires a valid Calendly API token in the Authorization header

### Request Parameters

| Parameter | Description                         | Required | Example                                                |
|-----------|-------------------------------------|----------|--------------------------------------------------------|
| url       | Calendly event type ID to query     | Yes      | `https://api.calendly.com/event_types/XXXXXXXXXXXX`    |

### Authentication

The worker expects a valid Calendly API token to be provided in the request:

```
Authorization: Bearer [CALENDLY_API_TOKEN]
```

The token can be set in the environment variables or provided by the calling workflow.

### Implementation Logic

The worker performs the following operations:

1. Validates the incoming request and authentication
2. Calculates the time window (15 minutes from now to 7 days in the future)
3. Makes an authenticated request to the Calendly API
4. Processes and formats the response data
5. Sorts available time slots chronologically
6. Returns both a comma-delimited string of timestamps and detailed time objects

### Calendly API Limitations

**Important Note**: The Calendly API has a strict limitation that only allows retrieving availability for a maximum of 7 days into the future. This is a hard constraint imposed by Calendly, not a limitation of our implementation. The worker is configured to work within this constraint by:

- Setting the end date parameter to exactly 7 days from the current time
- Not providing options to extend this window beyond what Calendly allows
- Handling the response data efficiently to maximize the usability of the available time slots

If business requirements change to need booking options beyond 7 days, alternative approaches would need to be explored, such as making multiple staggered API calls or working with Calendly support for enterprise-level solutions.

### Response Format

A successful response has the following structure:

```json
{
  "success": true,
  "data": {
    "startTimes": "2023-06-15T14:00:00-07:00,2023-06-16T10:00:00-07:00,...",
    "times": [
      {
        "start_time": "2023-06-15T14:00:00-07:00",
        "invitee_start_time": "2023-06-15T14:00:00-07:00",
        "status": "available",
        "event_type_id": "https://api.calendly.com/event_types/XXXXXXXXXXXX"
      },
      ...
    ]
  }
}
```

### Error Handling

The worker includes comprehensive error handling:

- **400 Bad Request**: When required parameters are missing
- **401 Unauthorized**: When the Calendly token is missing or invalid
- **405 Method Not Allowed**: When a non-GET method is used
- **500 Internal Server Error**: For unexpected errors during processing

Each error response includes a descriptive message to aid in troubleshooting.

## Integration with n8n Workflows

### Usage in Main Workflow

In the "Voice Agent - Booking SDR Emma" workflow, this worker is used in the "Get Calendly Times" node:

1. The workflow prepares the API request with appropriate authentication
2. The worker retrieves available times for the specified Calendly event type
3. The comma-delimited list of times is processed into a format that can be included in the voice agent's prompt
4. The available times are presented to the prospect during the call

### Usage in Prompt Tester

The worker is also used in the "Voice Agent - Prompt Tester" workflow to provide realistic time options during test calls, enabling accurate simulation of the booking experience.

## Security Considerations

- The worker validates all incoming requests
- Authentication is required via the Calendly API token
- The worker does not expose sensitive Calendly account details
- CORS headers are configured to allow access only from authorized sources

## Environment Variables

The worker can be configured with the following environment variable:

- `CALENDLY_API_TOKEN`: (Optional) Default Calendly API token if not provided in the request

## Maintenance

When maintaining this worker, consider:

- Updating the calculation of date ranges if scheduling policies change
- Adding additional CORS headers if new origins need access
- Enhancing the response format if the voice agent needs additional data
- Implementing caching if performance optimizations are needed

## Example Usage

### cURL Request

```bash
curl -X GET "https://your-worker-url/?url=https://api.calendly.com/event_types/XXXXXXXXXXXX" \
  -H "Authorization: Bearer eyJra..."
```

### n8n HTTP Request Node

```json
{
  "url": "https://your-worker-url/",
  "method": "GET",
  "qs": {
    "url": "https://api.calendly.com/event_types/XXXXXXXXXXXX"
  },
  "headers": {
    "Authorization": "Bearer eyJra..."
  }
}
```

## Related Components

- [book-calendly-time.ts](./book-calendly-time.md): Worker for booking appointments
- [n8n-template-processor.md](./n8n-template-processor.md): Processor for formatting time options in prompts 