# Lead Processing Function Documentation

## Overview

This n8n function processes lead data from Google Sheets to identify the most recent eligible lead for follow-up calls. It normalizes phone numbers, applies multiple eligibility criteria, and assigns the appropriate Calendly booking URL based on the assigned salesperson.

## Function Purpose

The function serves as a critical component in the lead management workflow by:

1. Identifying the most recently created lead that is eligible for a follow-up call
2. Normalizing phone numbers to a standard format for calling systems
3. Matching leads with the correct salesperson's Calendly booking URL
4. Filtering out leads that have been recently contacted or marked as "Do Not Call"

## Configuration

The function includes a configuration section at the top where salesperson information and backup URLs are defined:

```javascript
// Configuration: Array of salespersons with their calendar URLs
const salespersons = [
  { 
    name: "Tawd Frensley", 
    calendar_url: "https://api.calendly.com/event_types/EFHTV7GOKIPFHJDH",
    calendar_web_url: "https://calendly.com/tawdfrensley/30"
  },
  { 
    name: "Jon Shumate", 
    calendar_url: "https://api.calendly.com/event_types/c4fe39b5-c6bb-41fa-a035-1d3c79de3c7e",
    calendar_web_url: "https://calendly.com/jon-myhomeiq/30min"
  },
  { 
    name: "Shannon Luckey", 
    calendar_url: "https://api.calendly.com/event_types/bdb0565c-c59a-47a3-8a90-bc4939d89230",
    calendar_web_url: "https://calendly.com/shannon-myhomeiq/full-product-demo"
  },
  // Add more salespersons as needed
];

// Backup URLs to use if no matching salesperson is found
const backupCalendarUrl = "https://api.calendly.com/event_types/78a2485f-6e9c-44fa-9b05-33c3e61948bd";
const backupCalendarWebUrl = "https://calendly.com/d/cqs4-2yf-wdt/myhomeiq-product-demo";
```

To add or modify salespersons, simply update the array with the correct name (exactly as it appears in the Google Sheet), their Calendly API event type URL, and their public-facing Calendly web URL.

## How to Get Calendly API Event Type ID

When adding a new salesperson to the configuration array, you'll need to find their Calendly API event type ID. The easiest way to do this is:

1. **Load the Calendly web URL** in your browser (e.g., `https://calendly.com/username/30min`)
2. **Open Developer Tools** (press F12 or right-click and select "Inspect")
3. **Go to the Network tab** in the Developer Tools
4. **Refresh the page**
5. **Look for a request** with a name that starts with "range?"
6. **Click on that request** and examine the request URL
7. **Extract the event_types ID** from the URL
8. **Format the API URL** by combining `https://api.calendly.com/event_types/` with the extracted ID

For example, if you found an ID like `c4fe39b5-c6bb-41fa-a035-1d3c79de3c7e`, the complete API URL would be:
```
https://api.calendly.com/event_types/c4fe39b5-c6bb-41fa-a035-1d3c79de3c7e
```

Add this to the `calendar_url` field in the configuration array for the new salesperson.

## Lead Eligibility Criteria

A lead is considered eligible for processing if it meets ALL of the following criteria:

1. **Not recently called**: The lead has either never been called or was last called more than 24 hours ago
2. **Appropriate call status**: The "Call Status" field is NOT set to "Do Not Call"
3. **Not booked**: The "Booked" field is empty/not set

## Phone Number Normalization

The function normalizes phone numbers to ensure consistent formatting for calling systems:

1. Removes all non-numeric characters
2. Handles different formats:
   - 10-digit numbers: Adds "+1" prefix (e.g., "1234567890" → "+11234567890")
   - 11-digit numbers starting with "1": Adds "+" prefix (e.g., "11234567890" → "+11234567890")
   - Other formats: Standardizes to "+1" plus the last 10 digits

## Processing Logic

The function follows these steps:

1. Sorts all leads by "Created At" date in descending order (most recent first)
2. Iterates through the sorted leads, checking each against the eligibility criteria
3. Stops at the first eligible lead (which will be the most recent one due to sorting)
4. Normalizes the phone number for the selected lead
5. Matches the lead's assigned salesperson with the corresponding Calendly URL
6. If no matching salesperson is found, assigns the backup Calendly URL
7. Returns only the selected lead as a single-item array, or an empty array if no eligible leads are found

## Performance Considerations

The function is optimized for performance:

- **Early termination**: Stops processing as soon as a valid lead is found
- **Efficient sorting**: Uses JavaScript's native sort function for optimal performance
- **Minimal memory usage**: Only keeps track of the current valid lead

## Required Google Sheet Columns

The function expects the following columns to be present in the Google Sheet:

- **Phone**: The lead's phone number (will be normalized)
- **Created At**: Timestamp when the lead was created
- **Last Called At**: Timestamp when the lead was last called (can be empty)
- **Call Status**: Current status of call attempts (can be any value except "Do Not Call")
- **Booked**: Indicates if a meeting has been booked (should be empty for eligible leads)
- **Salesperson**: Name of the assigned salesperson (must match names in the configuration array)

## Usage in n8n

This function is designed to be used in an n8n Function node that receives data from a Google Sheets node. The output of this function will be a single item representing the most eligible lead, which can then be passed to subsequent nodes in your workflow (such as a Twilio node for making calls or a Calendly integration).

## Example Output

If an eligible lead is found, the function will return a single item with all the original fields from the Google Sheet, plus:

- A normalized phone number in the "Phone" field
- A "calendar_url" field containing the appropriate Calendly booking URL

If no eligible lead is found, the function will return an empty array.

## Complete Code

```javascript
// Configuration: Array of salespersons with their calendar URLs
const salespersons = [
  { 
    name: "Tawd Frensley", 
    calendar_url: "https://api.calendly.com/event_types/EFHTV7GOKIPFHJDH",
    calendar_web_url: "https://calendly.com/tawdfrensley/30"
  },
  { 
    name: "Jon Shumate", 
    calendar_url: "https://api.calendly.com/event_types/c4fe39b5-c6bb-41fa-a035-1d3c79de3c7e",
    calendar_web_url: "https://calendly.com/jon-myhomeiq/30min"
  },
  { 
    name: "Shannon Luckey", 
    calendar_url: "https://api.calendly.com/event_types/bdb0565c-c59a-47a3-8a90-bc4939d89230",
    calendar_web_url: "https://calendly.com/shannon-myhomeiq/full-product-demo"
  },
  // Add more salespersons as needed
];

// Backup URLs to use if no matching salesperson is found
const backupCalendarUrl = "https://api.calendly.com/event_types/78a2485f-6e9c-44fa-9b05-33c3e61948bd";
const backupCalendarWebUrl = "https://calendly.com/d/cqs4-2yf-wdt/myhomeiq-product-demo";

// Get current date and date from 24 hours ago for comparison
const now = new Date();
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

// Get all items and sort them by Created At in descending order (most recent first)
let items = $input.all();
items.sort((a, b) => {
  const dateA = new Date(a.json["Created At"]);
  const dateB = new Date(b.json["Created At"]);
  return dateB - dateA; // Descending order (most recent first)
});

// Variable to store our valid item
let validItem = null;

// Iterate through sorted items
for (const item of items) {
  // Normalize phone number
  let phone = item.json.Phone.toString();
  
  // Remove any non-numeric characters
  phone = phone.replace(/\D/g, '');

  // Handle different phone number formats
  if (phone.length === 10) {
    // 10 digits: add country code
    phone = '+1' + phone;
  } else if (phone.length === 11 && phone.startsWith('1')) {
    // 11 digits starting with 1: add plus sign
    phone = '+' + phone;
  } else {
    // Other cases: standardize to +1 and last 10 digits
    phone = '+1' + phone.slice(-10);
  }
  
  // Update the phone number in the item
  item.json.Phone = phone;
  
  // Check if this item is eligible (not called within last day)
  let lastCalledAt = item.json["Last Called At"] ? new Date(item.json["Last Called At"]) : null;
  
  // If the item has never been called or was called more than a day ago
  const notCalledRecently = !lastCalledAt || lastCalledAt < oneDayAgo;
  
  // Check Call Status is not "Do Not Call"
  const callStatus = item.json["Call Status"];
  const validCallStatus = callStatus !== "Do Not Call";
  
  // Check Booked column is not set
  const booked = item.json["Booked"];
  const notBooked = !booked;
  
  // If this item meets all our criteria, it's the most recent valid one
  if (notCalledRecently && validCallStatus && notBooked) {
    validItem = item;
    break; // Stop iterating - we found our most recent valid item
  }
}

// If we found a valid item, add the calendar URLs
if (validItem) {
  const salespersonName = validItem.json.Salesperson;
  const matchedSalesperson = salespersons.find(sp => sp.name === salespersonName);
  
  if (matchedSalesperson) {
    validItem.json.calendar_url = matchedSalesperson.calendar_url;
    validItem.json.calendar_web_url = matchedSalesperson.calendar_web_url;
  } else {
    // If no match found, use the backup URLs
    validItem.json.calendar_url = backupCalendarUrl;
    validItem.json.calendar_web_url = backupCalendarWebUrl;
  }
  
  // Return only this single item
  return [validItem];
} else {
  // No valid items found
  return [];
}
``` 