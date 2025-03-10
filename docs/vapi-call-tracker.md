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

## Input Requirements
The function expects input from a VAPI API call with the following structure:
- `id`: The unique call identifier
- `status`: The call status (e.g., "queued", "ended")
- `customer.number`: The customer's phone number
- `createdAt`: When the call was created
- `startedAt` and `endedAt`: Timestamps for call duration calculation (for ended calls)
- `stereoRecordingUrl`: URL to the call recording (for ended calls)

## Call Log Format
The function creates structured call log entries based on the call status:

### For New Calls (status: "queued")
```
:: Started call: [call_id] (timestamp)
```

### For Completed Calls (status: "ended")
```
:: Ended call: [call_id] (timestamp)
  :: Duration: [minutes]m [seconds]s
  :: Listen: [recording_url]
```

### For Other Statuses
```
:: [Capitalized_status] call: [call_id] (timestamp)
```

## Call Count Handling
- The call count is only incremented for new calls (status: "queued")
- This ensures accurate tracking of total calls made

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
- `callLog`: The updated call log with the new entry at the top
- `closeId`: The Close CRM ID (preserved from input)
- `callCount`: The updated call count
- `lastCallId`: The ID of the current call
- `lastCallDate`: The timestamp of the current call
- `recordingUrl`: URL to the call recording (for ended calls)

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

## Maintenance
When maintaining this code, consider:
- Updating the log format if additional call information becomes available
- Adding error handling for missing or malformed VAPI responses
- Extending the status handling for any new VAPI call statuses

## Complete Code
```javascript
// Get the VAPI response data directly from the input
const callId = $input.first().json.id;
const callStatus = $input.first().json.status;
const customerPhone = $input.first().json.customer?.number || "Unknown";
const callCreatedAt = $input.first().json.createdAt;

// Check if we have a valid call ID
if (!callId) {
  return {
    json: {
      success: false,
      error: "Missing call ID in VAPI response"
    }
  };
}

// Format the date for the log entry
const callDate = new Date(callCreatedAt);
const formattedDate = callDate.toISOString().replace('T', ' ').substring(0, 19);

// Create the new log entry based on call status
let newLogEntry = "";
let callStatusMessage = "";
let recordingUrl = "";

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
  
  // Create a detailed log entry with indented details
  newLogEntry = `:: Ended call: ${callId} (${formattedDate})\n  :: Duration: ${durationText}\n  :: Listen: ${recordingUrl}`;
  callStatusMessage = "Call Completed";
} else if (callStatus === "queued") {
  newLogEntry = `:: Started call: ${callId} (${formattedDate})`;
  callStatusMessage = "In Progress...";
} else {
  // Handle any other status
  newLogEntry = `:: ${callStatus.charAt(0).toUpperCase() + callStatus.slice(1)} call: ${callId} (${formattedDate})`;
  callStatusMessage = callStatus.charAt(0).toUpperCase() + callStatus.slice(1);
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
    callLog: updatedCallLog,
    closeId: closeId,
    callCount: callCount,
    lastCallId: callId,
    lastCallDate: callCreatedAt,
    recordingUrl: recordingUrl
  }
};
``` 