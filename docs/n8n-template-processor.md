# Documentation: Template Variable Processor with Greeting Extraction and Phone Formatting

## Overview
This n8n code node processes a template-based content string, extracts a greeting section, formats phone numbers, and replaces template variables with actual values. It's designed to prepare content for an AI-powered SDR (Sales Development Representative) system.

## Code
```javascript
// Access the input data
const content = $input.first().json.content;

// Extract greeting if present
let greeting = "";
let contentWithoutGreeting = content;

// Look for "Greeting:" pattern and extract until newline
const greetingMatch = content.match(/Greeting:\s*(.*?)(?:\n|$)/s);
if (greetingMatch && greetingMatch[1]) {
  greeting = greetingMatch[1].trim();
  
  // Remove the entire greeting section from the content
  contentWithoutGreeting = content.replace(/Greeting:\s*.*?(?:\n|$)/s, '').trim();
}

// Get current UTC time as a string
const nowUtc = new Date().toISOString();

// Format phone number gracefully
let phone = $('Code').first().json.Phone || "";

// Convert to string if it's not already
phone = phone.toString();

// Remove any non-numeric characters
phone = phone.replace(/\D/g, '');

// Handle different phone number formats
if (phone.length === 10) {
  // 10 digits: add country code
  phone = '+1' + phone;
} else if (phone.length === 11 && phone.startsWith('1')) {
  // 11 digits starting with 1: add plus sign
  phone = '+' + phone;
} else if (phone.length > 0) {
  // Other cases: standardize to +1 and last 10 digits
  phone = '+1' + phone.slice(-10);
}

// Get available times from Calendly
const rawAvailableTimes = $('Get Calendly Times').first().json.data.startTimes;

// Function to format time in 12-hour format (e.g., "9:30am")
function formatTimeIn12HourFormat(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${formattedMinutes}${ampm}`;
}

// Function to format date as "Day, Month Day" (e.g., "Friday, March 15")
function formatDate(date) {
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// Function to format date as just the day name (e.g., "Friday")
function formatDayName(date) {
  const options = { weekday: 'long' };
  return date.toLocaleDateString('en-US', options);
}

// Function to check if a date is today, tomorrow, etc. in a specific timezone
function getRelativeDayLabel(date, now, tzOffset) {
  // Create date objects adjusted for timezone
  const tzNow = new Date(now.getTime() + tzOffset * 60 * 60 * 1000);
  const tzDate = new Date(date.getTime() + tzOffset * 60 * 60 * 1000);
  
  // Reset time to start of day for comparison
  const tzNowDay = new Date(tzNow.getFullYear(), tzNow.getMonth(), tzNow.getDate());
  const tzDateDay = new Date(tzDate.getFullYear(), tzDate.getMonth(), tzDate.getDate());
  
  // Calculate difference in days
  const diffTime = tzDateDay.getTime() - tzNowDay.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  if (diffDays === 0) return `Today (${formatDayName(tzDate)}, ${tzDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })})`;
  if (diffDays === 1) return `Tomorrow (${formatDayName(tzDate)}, ${tzDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })})`;
  return formatDate(tzDate);
}

// Function to format a timestamp in ISO format with timezone offset
function formatTimestampWithOffset(date, tzOffset) {
  // Create a new date adjusted for the timezone
  const localDate = new Date(date.getTime() + tzOffset * 60 * 60 * 1000);
  
  // Format the date in ISO format
  const isoDate = localDate.toISOString().slice(0, 19);
  
  // Calculate the timezone offset string (e.g., "-07:00")
  const offsetHours = Math.floor(Math.abs(tzOffset));
  const offsetMinutes = Math.abs(tzOffset % 1) * 60;
  const offsetSign = tzOffset < 0 ? '-' : '+';
  const offsetString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;
  
  return `${isoDate}${offsetString}`;
}

// Function to organize times by day for a specific timezone
function organizeTimesByDay(times, tzOffset, tzName) {
  const now = new Date();
  const result = {};
  const utcTimes = [];
  const timeMap = {};
  
  // Parse times and adjust for timezone
  times.forEach(timeStr => {
    const utcTime = new Date(timeStr);
    utcTimes.push(utcTime);
    
    // Create a date object adjusted for the timezone
    const localTime = new Date(utcTime.getTime() + tzOffset * 60 * 60 * 1000);
    
    // Get day label (Today, Tomorrow, or the date)
    const dayLabel = getRelativeDayLabel(utcTime, now, tzOffset);
    
    // Format the time
    const formattedTime = formatTimeIn12HourFormat(localTime);
    
    // Format the timestamp with timezone offset
    const timestampWithOffset = formatTimestampWithOffset(utcTime, tzOffset);
    
    // Add to result
    if (!result[dayLabel]) {
      result[dayLabel] = [];
      timeMap[dayLabel] = {};
    }
    
    result[dayLabel].push({
      formattedTime,
      utcTime: timeStr, // Keep original UTC time for booking
      timestampWithOffset // Add timestamp with timezone offset
    });
    
    // Add to time map
    timeMap[dayLabel][formattedTime] = {
      utcTime: timeStr,
      timestampWithOffset
    };
  });
  
  // Sort times within each day
  Object.keys(result).forEach(day => {
    result[day].sort((a, b) => {
      return new Date(a.utcTime) - new Date(b.utcTime);
    });
  });
  
  // Create formatted output for this timezone
  // Extract the timezone name for the header (e.g., "PACIFIC TIME" from "Pacific Daylight Time (PDT)")
  const tzNameParts = tzName.split(' ');
  const tzHeader = `${tzNameParts[0].toUpperCase()} TIME`;
  
  let output = `==== ${tzHeader} ====\n`;
  output += `(use if user says their time zone is ${tzNameParts[0].substring(0, 1)}T, ${tzNameParts[0]} Time, `;
  
  // Add timezone abbreviations
  if (tzName.includes('(')) {
    const abbr = tzName.match(/\(([A-Z]+)\)/)[1];
    const seasonName = tzName.includes('Daylight') ? 'Daylight' : 'Standard';
    output += `${abbr}, ${tzNameParts[0]} ${seasonName} Time, `;
    
    // Add the alternative abbreviation
    const altAbbr = abbr.replace('D', 'S');
    const altSeasonName = seasonName === 'Daylight' ? 'Standard' : 'Daylight';
    output += `or ${altAbbr.replace('S', 'D')}, ${tzNameParts[0]} ${altSeasonName} Time`;
  }
  
  output += `)\n\n`;
  
  // Get days in order (Today, Tomorrow, then other days sorted by date)
  const days = Object.keys(result).sort((a, b) => {
    if (a.startsWith('Today')) return -1;
    if (b.startsWith('Today')) return 1;
    if (a.startsWith('Tomorrow')) return -1;
    if (b.startsWith('Tomorrow')) return 1;
    
    // Compare dates for other days
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA - dateB;
  });
  
  // Add each day's times to output
  days.forEach(day => {
    output += `- For ${day}, we have: \n`;
    
    // Add each time on its own line with the timestamp after a dash
    result[day].forEach(t => {
      output += `  ${t.formattedTime} - ${t.timestampWithOffset}\n`;
    });
    
    output += '\n';
  });
  
  return {
    formattedOutput: output,
    organizedTimes: result,
    timeMap,
    utcTimes
  };
}

// Process times for common US timezones
let timesByTimezone = {};
let formattedTimesByTimezone = "";

// Check if we're in Daylight Saving Time
const isDST = (() => {
  const today = new Date();
  const jan = new Date(today.getFullYear(), 0, 1);
  const jul = new Date(today.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return today.getTimezoneOffset() < stdTimezoneOffset;
})();

// Define timezones to process
const timezones = [
  { offset: -7 - (isDST ? 1 : 0), name: isDST ? "Pacific Daylight Time (PDT)" : "Pacific Standard Time (PST)" },
  { offset: -6 - (isDST ? 1 : 0), name: isDST ? "Mountain Daylight Time (MDT)" : "Mountain Standard Time (MST)" },
  { offset: -5 - (isDST ? 1 : 0), name: isDST ? "Central Daylight Time (CDT)" : "Central Standard Time (CST)" },
  { offset: -4 - (isDST ? 1 : 0), name: isDST ? "Eastern Daylight Time (EDT)" : "Eastern Standard Time (EST)" }
];

// Process each timezone
timezones.forEach(tz => {
  const result = organizeTimesByDay(rawAvailableTimes.split(','), tz.offset, tz.name);
  timesByTimezone[tz.name] = result.organizedTimes;
  formattedTimesByTimezone += result.formattedOutput + "\n";
});

// Define the variable values using actual values from n8n nodes
const variableValues = {
  "first_name": $('Code').first().json['First Name'],
  "last_name": $('Code').first().json['Last Name'],
  "email": $('Code').first().json.Email,
  "phone": phone,
  "available_times": rawAvailableTimes,
  "formatted_times_by_timezone": formattedTimesByTimezone,
  "calendar_web_url": $('Code').first().json.calendar_web_url,
  "now": nowUtc
};

// Process the content by replacing template variables
let processedContent = contentWithoutGreeting;

// Replace each template variable with its corresponding value
for (const [key, value] of Object.entries(variableValues)) {
  const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
  processedContent = processedContent.replace(regex, value);
}

// Process the greeting by replacing template variables
let processedGreeting = greeting;

// Replace each template variable in the greeting
for (const [key, value] of Object.entries(variableValues)) {
  const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
  processedGreeting = processedGreeting.replace(regex, value);
}

// Find any remaining template variables that weren't replaced
const templateRegex = /\{\{([^}]+)\}\}/g;
const matches = [...processedContent.matchAll(templateRegex)];
const remainingVariables = [...new Set(matches.map(match => match[1].trim()))];

// Return the processed content, greeting, and JSON-stringified versions
return {
  json: {
    processedContent,
    processedContentJSON: JSON.stringify(processedContent),
    greeting: processedGreeting,
    greetingJSON: JSON.stringify(processedGreeting),
    formattedPhone: phone,
    formattedTimesByTimezone,
    remainingVariables,
    allVariablesReplaced: remainingVariables.length === 0
  }
};
```

## Functionality

### 1. Content Processing
- Extracts a greeting section from the content (identified by "Greeting:" prefix)
- Removes the greeting section from the main content
- Replaces template variables in both the greeting and main content
- Formats phone numbers to a standardized format
- Identifies any template variables that weren't replaced

### 2. Phone Number Formatting
The code standardizes phone numbers to the international format `+1XXXXXXXXXX` by:
- Converting the phone number to a string
- Removing non-numeric characters
- Adding country code (+1) for 10-digit numbers
- Adding plus sign for 11-digit numbers starting with 1
- Standardizing other formats to +1 followed by the last 10 digits

### 3. Template Variable Replacement
Replaces variables in the format `{{variable_name}}` with their corresponding values from:
- 'Code' node data (First Name, Last Name, Email, Phone, calendar_web_url)
- 'Get Calendly Times' node data (available_times)
- Current UTC time

## Input Requirements
- `$input.first().json.content`: The template content with variables in `{{variable_name}}` format
- `$('Code').first().json`: Contains user data (First Name, Last Name, Email, Phone, calendar_web_url)
- `$('Get Calendly Times').first().json.data.startTimes`: Available appointment times

## Output
The node outputs a JSON object containing:
- `processedContent`: The main content with variables replaced
- `processedContentJSON`: JSON-stringified version of the processed content
- `greeting`: The extracted greeting with variables replaced
- `greetingJSON`: JSON-stringified version of the greeting
- `formattedPhone`: The formatted phone number
- `formattedTimesByTimezone`: Organized and formatted times by timezone
- `remainingVariables`: Any template variables that weren't replaced
- `allVariablesReplaced`: Boolean indicating if all variables were replaced

## Usage in Workflow
This code node is designed to work in a workflow that:
1. Receives contact data from the 'Code' node
2. Gets available appointment times from the 'Get Calendly Times' node
3. Processes the template content for an AI assistant
4. Sends the processed content to an AI service via HTTP request

## Example
### Input Content
```
Greeting: Hey there {{first_name}}, this is Emma from myhomeIQ!

You are Emma, an AI-powered Sales Development Representative (SDR) for myhomeIQ.
The lead's first name is: {{first_name}}
The lead's last name is: {{last_name}}
The lead's email is: {{email}}
Currently the time in UTC is {{now}}.
You can book a meeting at: {{calendar_web_url}}
```

### Output
```json
{
  "processedContent": "You are Emma, an AI-powered Sales Development Representative (SDR) for myhomeIQ.\nThe lead's first name is: John\nThe lead's last name is: Doe\nThe lead's email is: john.doe@example.com\nCurrently the time in UTC is 2023-06-15T14:30:45.123Z.\nYou can book a meeting at: https://calendly.com/myhomeiq/demo",
  "processedContentJSON": "\"You are Emma, an AI-powered Sales Development Representative (SDR) for myhomeIQ.\\nThe lead's first name is: John\\nThe lead's last name is: Doe\\nThe lead's email is: john.doe@example.com\\nCurrently the time in UTC is 2023-06-15T14:30:45.123Z.\\nYou can book a meeting at: https://calendly.com/myhomeiq/demo\"",
  "greeting": "Hey there John, this is Emma from myhomeIQ!",
  "greetingJSON": "\"Hey there John, this is Emma from myhomeIQ!\"",
  "formattedPhone": "+19167927365",
  "formattedTimesByTimezone": "Pacific Standard Time (PST):\n- For Today, we have: 9:30am\n- For Tomorrow, we have: 9:30am\nMountain Standard Time (MST):\n- For Today, we have: 10:30am\n- For Tomorrow, we have: 10:30am\nCentral Standard Time (CST):\n- For Today, we have: 11:30am\n- For Tomorrow, we have: 11:30am\nEastern Standard Time (EST):\n- For Today, we have: 12:30pm\n- For Tomorrow, we have: 12:30pm",
  "remainingVariables": [],
  "allVariablesReplaced": true
}
```

## Integration with HTTP Request
When using this node's output in an HTTP request to an AI service, use the JSON-stringified versions to ensure proper JSON formatting:

```json
{
  "assistantId": "cd9d20f9-5915-4b42-b9dd-27fe67160e53",
  "assistantOverrides": {
    "variableValues": {
      "prompt_body": {{$json.processedContentJSON}},
      "greeting": {{$json.greetingJSON}}
    }
  },
  "customer": {
    "number": {{$json.formattedPhone}},
    "name": "{{$('Code').first().json['First Name']}}"
  },
  "phoneNumberId": "9a43e40d-65f4-482e-8196-a1a3812f0004"
}
```

## Maintenance Notes
- The code handles missing values gracefully but doesn't validate the format of emails or other fields
- Additional template variables can be added to the `variableValues` object as needed
- The phone formatting logic assumes US/Canada numbers (+1 country code) 

## Updated Prompt for Timezone-Aware Scheduling

```
Before sharing available times for a demo, first ask the lead: "may I ask what timezone you're in?"

Currently the time in UTC is {{now}}. Convert this to the lead's timezone to establish the current time context. Never mention UTC time to the lead - always refer to times in their local timezone.

Based on the lead's timezone, use the appropriate section from the following timezone information. Each section shows times already converted to the correct timezone (including daylight savings time adjustments):

{{formatted_times_by_timezone}}

When the lead tells you their timezone, find the matching timezone section above (e.g., PACIFIC TIME, MOUNTAIN TIME, etc.). The times are already organized by day in their local timezone, so you don't need to do any timezone conversion yourself.

When presenting available times:

1. If there are times available for Today:
   - Present just a few times to start from Today's list
   - Use simple time format (e.g., "9:30am") without restating the timezone
   - If there's only one time, use singular wording ("I have one time available at 9:30am")
   - If there are multiple times, use plural wording ("I have times available at 9:30am, 10:00am, and 11:00am")
   - Ask if any of those times work
   - If none work, present a few more times from Today
   - Only move to Tomorrow's times after you've offered all of Today's times

2. If there are no times for Today but there are times for Tomorrow:
   - Start by saying "I don't have any availability today, but I have times available tomorrow"
   - Present just a few times to start from Tomorrow
   - Follow the same format as above
   - If none work, present a few more times from Tomorrow
   - Only move to the next day after offering all times from Tomorrow

3. If there are no times for Today or Tomorrow, but there are times for future dates:
   - Start by saying "The soonest I have availability is [day], [month] [date]" (e.g., "The soonest I have availability is Monday, June 19")
   - Present just a few times to start from that day
   - Follow the same format as above
   - If none work, present a few more times from that day
   - Only move to the next day after offering all times from the current day
   - Use the same format as in the examples: "For Monday, June 19, I have availability at 9:00am, 10:00am, and 11:00am. Would any of those work for you?"

4. For all scenarios, continue this pattern for subsequent days:
   - Always present times in small groups (just a few at a time)
   - Only move to the next day after offering all times from the current day
   - Use a conversational tone, such as:
     * "For Today (Thursday, June 15), I have availability at 9:00am, 10:00am, and 11:00am. Would any of those work for you?"
     * "For Tomorrow (Friday, June 16), I have availability at 9:00am, 10:00am, and 11:00am. Would any of those work for you?"
     * "For Monday, June 19, I have availability at 9:00am, 10:00am, and 11:00am. Would any of those work for you?"

5. Unless we're within a few days of January 1st, you don't need to say the year when listing available start times because the user will know what year it is.

6. If there are no available times at all, apologize and let them know you will have a sales team member reach out personally to help them.

When the lead selects a time, use the corresponding timestamp that appears after the dash (-) character next to their selected time in the correct timezone section. For example, if they select a time like "7:00am" from the PACIFIC TIME section, you would use the specific timestamp that appears after the dash for that exact time (e.g., "2023-06-15T07:00:00-07:00") in the PACIFIC TIME section (not from any other timezone section).

Once the lead decides their time, use bookCalendlyTime to book it. For the start_time attribute in bookCalendlyTime, use the timezone-specific timestamp that appears after the dash (-) next to their selected time in the correct timezone section. Do not restate the time after booking.
```

## Example Formatted Output

Below is an example of how the formatted timezone output will appear with the updated code. This example uses the following UTC timestamps as input:

```
2023-06-15T14:00:00Z,2023-06-15T15:30:00Z,2023-06-15T17:00:00Z,2023-06-15T18:30:00Z,2023-06-16T14:00:00Z,2023-06-16T15:30:00Z,2023-06-16T17:00:00Z,2023-06-16T18:30:00Z,2023-06-19T14:00:00Z,2023-06-19T15:30:00Z,2023-06-19T17:00:00Z,2023-06-19T18:30:00Z
```

Assuming today is June 15, 2023, and we're in Daylight Saving Time:

```
==== PACIFIC TIME ====
(use if user says their time zone is PT, Pacific Time, PST, Pacific Standard Time, or PDT, Pacific Daylight Time)

- For Today (Thursday, June 15), we have: 
  7:00am - 2023-06-15T07:00:00-07:00
  8:30am - 2023-06-15T08:30:00-07:00
  10:00am - 2023-06-15T10:00:00-07:00
  11:30am - 2023-06-15T11:30:00-07:00

- For Tomorrow (Friday, June 16), we have: 
  7:00am - 2023-06-16T07:00:00-07:00
  8:30am - 2023-06-16T08:30:00-07:00
  10:00am - 2023-06-16T10:00:00-07:00
  11:30am - 2023-06-16T11:30:00-07:00

- For Monday, June 19, we have: 
  7:00am - 2023-06-19T07:00:00-07:00
  8:30am - 2023-06-19T08:30:00-07:00
  10:00am - 2023-06-19T10:00:00-07:00
  11:30am - 2023-06-19T11:30:00-07:00


==== MOUNTAIN TIME ====
(use if user says their time zone is MT, Mountain Time, MST, Mountain Standard Time, or MDT, Mountain Daylight Time)

- For Today (Thursday, June 15), we have: 
  8:00am - 2023-06-15T08:00:00-06:00
  9:30am - 2023-06-15T09:30:00-06:00
  11:00am - 2023-06-15T11:00:00-06:00
  12:30pm - 2023-06-15T12:30:00-06:00

- For Tomorrow (Friday, June 16), we have: 
  8:00am - 2023-06-16T08:00:00-06:00
  9:30am - 2023-06-16T09:30:00-06:00
  11:00am - 2023-06-16T11:00:00-06:00
  12:30pm - 2023-06-16T12:30:00-06:00

- For Monday, June 19, we have: 
  8:00am - 2023-06-19T08:00:00-06:00
  9:30am - 2023-06-19T09:30:00-06:00
  11:00am - 2023-06-19T11:00:00-06:00
  12:30pm - 2023-06-19T12:30:00-06:00


==== CENTRAL TIME ====
(use if user says their time zone is CT, Central Time, CST, Central Standard Time, or CDT, Central Daylight Time)

- For Today (Thursday, June 15), we have: 
  9:00am - 2023-06-15T09:00:00-05:00
  10:30am - 2023-06-15T10:30:00-05:00
  12:00pm - 2023-06-15T12:00:00-05:00
  1:30pm - 2023-06-15T13:30:00-05:00

- For Tomorrow (Friday, June 16), we have: 
  9:00am - 2023-06-16T09:00:00-05:00
  10:30am - 2023-06-16T10:30:00-05:00
  12:00pm - 2023-06-16T12:00:00-05:00
  1:30pm - 2023-06-16T13:30:00-05:00

- For Monday, June 19, we have: 
  9:00am - 2023-06-19T09:00:00-05:00
  10:30am - 2023-06-19T10:30:00-05:00
  12:00pm - 2023-06-19T12:00:00-05:00
  1:30pm - 2023-06-19T13:30:00-05:00


==== EASTERN TIME ====
(use if user says their time zone is ET, Eastern Time, EST, Eastern Standard Time, or EDT, Eastern Daylight Time)

- For Today (Thursday, June 15), we have: 
  10:00am - 2023-06-15T10:00:00-04:00
  11:30am - 2023-06-15T11:30:00-04:00
  1:00pm - 2023-06-15T13:00:00-04:00
  2:30pm - 2023-06-15T14:30:00-04:00

- For Tomorrow (Friday, June 16), we have: 
  10:00am - 2023-06-16T10:00:00-04:00
  11:30am - 2023-06-16T11:30:00-04:00
  1:00pm - 2023-06-16T13:00:00-04:00
  2:30pm - 2023-06-16T14:30:00-04:00

- For Monday, June 19, we have: 
  10:00am - 2023-06-19T10:00:00-04:00
  11:30am - 2023-06-19T11:30:00-04:00
  1:00pm - 2023-06-19T13:00:00-04:00
  2:30pm - 2023-06-19T14:30:00-04:00
``` 