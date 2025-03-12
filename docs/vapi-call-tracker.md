# Documentation: VAPI Call Tracker

## Overview
This n8n function node processes VAPI call data and updates a Google Sheet with call information, including status, logs, and recording URLs. It's designed to maintain a comprehensive call history for each lead, with detailed information about call duration and recordings.

## Purpose
The code serves as a bridge between VAPI's call API and a Google Sheet tracking system. It:
1. Processes call status updates from VAPI
2. Maintains a chronological call log with timestamps
3. Tracks call counts and statuses
4. Provides easy access to call recordings
5. Calculates and displays call durations
6. Extracts and formats booking information when a demo is scheduled

## Input Requirements
The function expects input from a VAPI API call with the following structure:
- `id`: The unique call identifier
- `status`: The call status (e.g., "queued", "ended")
- `customer.number`: The customer's phone number
- `createdAt`: When the call was created
- `startedAt` and `endedAt`: Timestamps for call duration calculation (for ended calls)
- `stereoRecordingUrl`: URL to the call recording (for ended calls)
- `messages`: Array of messages from the call, including tool call results for bookings

## Call Log Format
The function creates structured call log entries based on the call status:

### For New Calls (status: "queued")
```
:: Started call: [call_id]
  :: Date: [timestamp]
```

### For Completed Calls (status: "ended")
```
:: Ended call: [call_id]
  :: Date: [timestamp]
  :: Duration: [minutes]m [seconds]s
  :: Recording: [recording_url]
  :: Booked with [Salesperson Name]: [Day], [Month] [Date] @ [Time] [Timezone]
```
The last line with booking information is only included if a booking was made during the call.

### For Other Statuses
```
:: [Capitalized_status] call: [call_id]
  :: Date: [timestamp]
```

## Call Count Handling
- The call count is only incremented for new calls (status: "queued")
- This ensures accurate tracking of total calls made

## Booking Information Handling
- When a call includes a successful booking via the `bookCalendlyTime` function, the script extracts:
  - Salesperson name (from the Calendly content)
  - Day of week (abbreviated)
  - Date (month and day)
  - Time (in 12-hour format)
  - Timezone (abbreviated)
- This information is formatted as: "Booked with Jon Shumate: Wed, March 12 @ 9:30 AM PT"
- The formatted booking information is:
  - Added as an indented item in the call log
  - Added to the `slackStatusMessage` as a bullet point
  - Stored in the `bookingSuccessful` field for use in Google Sheets
  - NOT added to the `callStatusMessage` (which remains simply "Call Completed")

## Integration with Google Sheets
The function is designed to work with a Google Sheets node in n8n:
1. It reads existing call log data from a previous node
2. It updates the log with new entries at the top
3. It returns fields that can be directly mapped to Google Sheet columns

## Output Fields
The function returns a JSON object with these fields:
- `phone`: Customer's phone number (for row matching)
- `callStatus`: Raw status from VAPI (e.g., "queued", "ended")
- `callStatusMessage`: User-friendly status message (e.g., "In Progress...", "Call Completed")
- `slackStatusMessage`: Slack-formatted status message with markdown for bold, italics, and links
  - For completed calls: `*Call Completed with [Name] ([Phone])*` followed by bulleted list with duration, recording link, and booking info (if available)
  - For queued calls: `_*In Progress...*_ (Call with [Name] ([Phone]) just started)`
  - For other statuses: `*[Status]* - [Name] ([Phone])`
- `callLog`: The updated call log with the new entry at the top
- `closeId`: The Close CRM ID (preserved from input)
- `callCount`: The updated call count
- `lastCallId`: The ID of the current call
- `lastCallDate`: The timestamp of the current call
- `recordingUrl`: URL to the call recording (for ended calls)
- `userTalked`: Boolean indicating if the user talked during the call
- `userMessageCount`: Number of user messages during the call
- `bookingSuccessful`: String with formatted booking information if a booking was made, or false if no booking

## Usage in n8n Workflow
This function is designed to be used in an n8n workflow with:
1. A previous node that reads data from Google Sheets
2. A node that makes API calls to VAPI
3. This function node to process the VAPI response
4. A Google Sheets node to update the sheet with the processed data

## Example Workflow
```
[Google Sheets: Read] → [HTTP Request to VAPI] → [This Function] → [Google Sheets: Update]
```

## Google Sheets Expression for Booking Column
When setting up the Google Sheets node to update the "Booked" column, use this expression:
```
{{ $json.bookingSuccessful === false ? "" : $json.bookingSuccessful }}
```
This ensures that when no booking was made (`bookingSuccessful` is `false`), the cell will be empty rather than displaying "false".

## Maintenance
When maintaining this code, consider:
- Updating the log format if additional call information becomes available
- Adding error handling for missing or malformed VAPI responses
- Extending the status handling for any new VAPI call statuses
- Updating the booking information extraction if the Calendly response format changes
- Adjusting the salesperson name detection logic if the Calendly content format changes

## Complete Code
```javascript
// Function to extract booking information from the messages
function extractBookingInfo(messages) {
  // Find the successful booking result
  const bookingResult = messages.find(msg => 
    msg.role === "tool_call_result" && 
    msg.name === "bookCalendlyTime" && 
    msg.result && 
    msg.result.success === true
  );
  
  if (!bookingResult) return null;
  
  // Get the booking URL
  const bookingUrl = bookingResult.result.debug.url;
  
  // Extract meeting details from content
  const content = bookingResult.result.debug.content;
  
  // Find the line with the meeting time
  const lines = content.split('\n');
  let meetingInfoLine = '';
  let timezoneLine = '';
  let salespersonName = 'Jon Shumate'; // Default salesperson name
  
  // Try to find the salesperson name in the content
  for (let i = 0; i < lines.length; i++) {
    // Look for a line that might contain the salesperson name
    if (i < lines.length - 1 && 
        lines[i].trim() !== '' && 
        !lines[i].includes(':') && 
        !lines[i].includes('Invitation') && 
        !lines[i].includes('Meeting') &&
        !lines[i].includes('scheduled') &&
        !lines[i].includes('invitation') &&
        !lines[i].includes('Calendly')) {
      // This might be the salesperson name
      const potentialName = lines[i].trim();
      if (potentialName.split(' ').length <= 3) { // Most names are 1-3 words
        salespersonName = potentialName;
      }
    }
    
    // Look for the meeting info line with time and date
    if ((lines[i].includes(':') && lines[i].includes(',')) && 
        (lines[i].includes('AM') || lines[i].includes('PM') || lines[i].includes(' - '))) {
      meetingInfoLine = lines[i].trim();
      // Timezone is typically on the next line
      if (i + 1 < lines.length) {
        timezoneLine = lines[i + 1].trim();
      }
      break;
    }
  }
  
  if (!meetingInfoLine) return null;
  
  // Parse the meeting info
  // Format is typically: "09:30 - 10:00, Wednesday, March 12, 2025"
  const parts = meetingInfoLine.split(',').map(p => p.trim());
  const timeRange = parts[0];
  const dayOfWeek = parts[1]; // "Wednesday"
  const date = parts[2]; // "March 12, 2025" or "March 12"
  
  // Extract just the start time from the time range (09:30 - 10:00)
  const startTime = timeRange.split(' - ')[0];
  
  // Convert to 12-hour format if needed
  let formattedTime = startTime;
  if (startTime.includes(':')) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12; // Convert 0 to 12
    formattedTime = `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  
  // Get abbreviated day of week (Wed from Wednesday)
  const dayAbbrev = dayOfWeek.substring(0, 3);
  
  // Parse date to get just "March 12" without the year
  let monthDay = date;
  if (date.includes(',')) {
    monthDay = date.split(',')[0].trim();
  }
  
  // Parse timezone (typically "Pacific Time - US & Canada")
  let timezoneAbbrev = 'PT'; // Default
  if (timezoneLine.includes('Pacific')) {
    timezoneAbbrev = 'PT';
  } else if (timezoneLine.includes('Eastern')) {
    timezoneAbbrev = 'ET';
  } else if (timezoneLine.includes('Central')) {
    timezoneAbbrev = 'CT';
  } else if (timezoneLine.includes('Mountain')) {
    timezoneAbbrev = 'MT';
  } else if (timezoneLine.includes('Alaska')) {
    timezoneAbbrev = 'AKT';
  } else if (timezoneLine.includes('Hawaii')) {
    timezoneAbbrev = 'HT';
  }
  
  // Format the human-readable string in the requested format with salesperson name
  const formattedBooking = `Booked with ${salespersonName}: ${dayAbbrev}, ${monthDay} @ ${formattedTime} ${timezoneAbbrev}`;
  
  return {
    formattedString: formattedBooking,
    url: bookingUrl,
    success: true
  };
}

// Get the VAPI response data directly from the input
const callId = $input.first().json.id;
const callStatus = $input.first().json.status;
const customerPhone = $input.first().json.customer?.number || "Unknown";
const callCreatedAt = $input.first().json.createdAt;
const messages = $input.first().json.messages || []; // Extract messages array

// Check if we have a valid call ID
if (!callId) {
  return {
    json: {
      success: false,
      error: "Missing call ID in VAPI response"
    }
  };
}

// Check if user talked and count how many times
let userTalked = false;
let userMessageCount = 0;
let bookingSuccessful = false;

// Only check messages and booking success if the call has ended
if (callStatus === "ended" && messages && messages.length > 0) {
  // Count user messages
  const userMessages = messages.filter(msg => msg.role === "user");
  userMessageCount = userMessages.length;
  userTalked = userMessageCount > 0;
  
  // Check for successful bookCalendlyTime calls and extract booking info
  const bookingInfo = extractBookingInfo(messages);
  bookingSuccessful = bookingInfo ? bookingInfo.formattedString : false;
}

// Format the date for the log entry
const callDate = new Date(callCreatedAt);
const formattedDate = callDate.toISOString().replace('T', ' ').substring(0, 19);

// Create the new log entry based on call status
let newLogEntry = "";
let callStatusMessage = "";
let slackStatusMessage = ""; // New variable for Slack-formatted message
let recordingUrl = "";

// Get first and last name for Slack messages
let firstName = "";
let lastName = "";
let contactPhone = "";
try {
  firstName = $('Code').first().json['First Name'] || "";
  lastName = $('Code').first().json['Last Name'] || "";
  contactPhone = $('Code').first().json.Phone || customerPhone || "";
} catch (error) {
  console.log("Could not access name from previous node");
}

// Create a formatted name for Slack messages
const formattedName = firstName || lastName ? `${firstName} ${lastName}`.trim() : "Unknown contact";
const contactName = contactPhone ? `${formattedName} (${contactPhone})` : formattedName;

if (callStatus === "ended") {
  // Get the recording URL for ended calls
  recordingUrl = $input.first().json.stereoRecordingUrl || "No recording available";
  
  // Calculate call duration if possible
  let durationText = "unknown";
  if ($input.first().json.endedAt && $input.first().json.startedAt) {
    const endTime = new Date($input.first().json.endedAt);
    const startTime = new Date($input.first().json.startedAt);
    const durationMs = endTime - startTime;
    
    // Format duration as minutes and seconds
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    durationText = `${minutes}m ${seconds}s`;
  }
  
  // Format the recording URL as a clickable link
  const recordingLink = recordingUrl !== "No recording available" 
    ? recordingUrl 
    : "No recording available";
  
  // Create a detailed log entry with indented details
  newLogEntry = `:: Ended call: ${callId}\n  :: Date: ${formattedDate}\n  :: Duration: ${durationText}\n  :: Recording: ${recordingLink}`;
  
  // Add booking information to the call log if available
  if (bookingSuccessful) {
    newLogEntry += `\n  :: ${bookingSuccessful}`;
  }
  
  // Keep callStatusMessage simple
  callStatusMessage = "Call Completed";
  
  // Create Slack-formatted message with proper link syntax and contact name
  const slackRecordingLink = recordingUrl !== "No recording available"
    ? `<${recordingUrl}|Click to Listen>`
    : "No recording available";
  slackStatusMessage = `*Call Completed with ${contactName}*\n  • Duration: ${durationText}\n  • Recording: ${slackRecordingLink}`;
  
  // Add booking information to Slack message if available
  if (bookingSuccessful) {
    slackStatusMessage += `\n  • ${bookingSuccessful}`;
  }
  
} else if (callStatus === "queued") {
  newLogEntry = `:: Started call: ${callId}\n  :: Date: ${formattedDate}`;
  callStatusMessage = "In Progress...";
  slackStatusMessage = `_*In Progress...*_ (Call with ${contactName} just started)`;
} else {
  // Handle any other status
  newLogEntry = `:: ${callStatus.charAt(0).toUpperCase() + callStatus.slice(1)} call: ${callId}\n  :: Date: ${formattedDate}`;
  callStatusMessage = callStatus.charAt(0).toUpperCase() + callStatus.slice(1);
  slackStatusMessage = `*${callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}* - ${contactName}`;
}

// Get the existing call log from the previous Code node
let existingCallLog = "";
try {
  existingCallLog = $('Code').first().json['Call Log'] || "";
} catch (error) {
  // If there's an error accessing the previous node, continue with empty call log
  console.log("Could not access previous call log, starting fresh");
}

// Get the Close ID from the previous Code node
let closeId = "";
try {
  closeId = $('Code').first().json['Close ID'] || "";
} catch (error) {
  console.log("Could not access Close ID from previous node");
}

// Get the current call count and increment it
let callCount = 0;
try {
  // Get the current call count, default to 0 if not present
  callCount = parseInt($('Code').first().json['Call Count']) || 0;
  // Only increment the call count for new calls (queued status)
  if (callStatus === "queued") {
    callCount += 1;
  }
} catch (error) {
  // If there's an error, start with 1 for new calls, 0 for ended calls
  callCount = callStatus === "queued" ? 1 : 0;
  console.log("Could not access previous Call Count, using default based on call status");
}

// Combine the new log entry with the existing log
// Put the new entry at the top since we want most recent first
// Add two new lines between entries
const updatedCallLog = existingCallLog 
  ? `${newLogEntry}\n\n${existingCallLog}`
  : newLogEntry;

// Return the data to update in Google Sheets
return {
  json: {
    phone: customerPhone,
    callStatus: callStatus,
    callStatusMessage: callStatusMessage,
    slackStatusMessage: slackStatusMessage,
    callLog: updatedCallLog,
    closeId: closeId,
    callCount: callCount,
    lastCallId: callId,
    lastCallDate: callCreatedAt,
    recordingUrl: recordingUrl,
    userTalked: userTalked,
    userMessageCount: userMessageCount,
    bookingSuccessful: bookingSuccessful
  }
};
``` 