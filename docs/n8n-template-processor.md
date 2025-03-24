# Prompt Template Variable Processor with Greeting Extraction and Phone Formatting

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

// Check if there are available times, if not throw a clear error
if (!rawAvailableTimes || rawAvailableTimes.length === 0) {
  throw new Error("No demo times available on this calendar.");
}

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
  
  // Extract year, month, day components for both dates in the timezone
  const tzNowYear = tzNow.getFullYear();
  const tzNowMonth = tzNow.getMonth();
  const tzNowDay = tzNow.getDate();
  
  const tzDateYear = tzDate.getFullYear();
  const tzDateMonth = tzDate.getMonth();
  const tzDateDay = tzDate.getDate();
  
  // Create date objects with only the date part (no time) for accurate day comparison
  const tzNowDateOnly = new Date(tzNowYear, tzNowMonth, tzNowDay);
  const tzDateDateOnly = new Date(tzDateYear, tzDateMonth, tzDateDay);
  
  // Calculate difference in milliseconds and convert to days
  const diffTime = tzDateDateOnly.getTime() - tzNowDateOnly.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Using Math.floor for exact day count
  
  // Format the date parts for display
  const formattedMonth = tzDate.toLocaleDateString('en-US', { month: 'long' });
  const formattedDay = tzDateDay;
  const formattedDayName = tzDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Return appropriate label based on day difference
  if (diffDays === 0) return `Today (${formattedDayName}, ${formattedMonth} ${formattedDay})`;
  if (diffDays === 1) return `Tomorrow (${formattedDayName}, ${formattedMonth} ${formattedDay})`;
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

/**
 * Determines if a specific date falls within the Daylight Saving Time period
 * DST in the US starts on the second Sunday in March and ends on the first Sunday in November
 * @param {Date} date - The date to check
 * @return {boolean} - True if the date is in DST, false otherwise
 */
function isDSTForDate(date) {
  const year = date.getFullYear();
  
  // Calculate second Sunday in March (DST start)
  const marchSecondSunday = new Date(year, 2, 1); // March 1
  // Move to second Sunday: add days until we reach Sunday, then add 7 more days
  marchSecondSunday.setDate(marchSecondSunday.getDate() + (7 - marchSecondSunday.getDay()) % 7 + 7);
  marchSecondSunday.setHours(2, 0, 0, 0); // 2:00 AM
  
  // Calculate first Sunday in November (DST end)
  const novemberFirstSunday = new Date(year, 10, 1); // November 1
  // Move to first Sunday: add days until we reach Sunday
  novemberFirstSunday.setDate(novemberFirstSunday.getDate() + (7 - novemberFirstSunday.getDay()) % 7);
  novemberFirstSunday.setHours(2, 0, 0, 0); // 2:00 AM
  
  // Check if the date is between the DST start and end dates
  return date >= marchSecondSunday && date < novemberFirstSunday;
}

/**
 * Gets the timezone information for a specific date and base timezone
 * @param {Date} date - The date to get timezone info for
 * @param {Object} tzBase - The base timezone information (name and base offset)
 * @return {Object} - Object containing offset, name, and abbreviation
 */
function getTimezoneInfo(date, tzBase) {
  // Check if this specific date is in DST
  const isDST = isDSTForDate(date);
  
  // Apply DST offset if needed (add 1 hour during DST)
  // During DST, we add 1 hour to make the offset less negative
  // For example: PST (UTC-8) becomes PDT (UTC-7) during DST
  const offset = tzBase.baseOffset + (isDST ? 1 : 0);
  
  // Generate the appropriate timezone name and abbreviation
  const seasonName = isDST ? "Daylight" : "Standard";
  const abbr = isDST ? tzBase.abbr.replace('S', 'D') : tzBase.abbr;
  const name = `${tzBase.name} ${seasonName} Time (${abbr})`;
  
  return { offset, name, abbr, isDST };
}

// Function to organize times by day for a specific timezone
function organizeTimesByDay(times, tzBase) {
  // Use the same UTC time reference that we captured earlier
  const now = new Date(nowUtc);
  const result = {};
  const utcTimes = [];
  const timeMap = {};
  
  // Parse times and adjust for timezone with proper DST handling
  times.forEach(timeStr => {
    const utcTime = new Date(timeStr);
    utcTimes.push(utcTime);
    
    // Get timezone info for this specific date
    const tzInfo = getTimezoneInfo(utcTime, tzBase);
    
    // Create a date object adjusted for the timezone with the correct DST offset
    const localTime = new Date(utcTime.getTime() + tzInfo.offset * 60 * 60 * 1000);
    
    // Get day label (Today, Tomorrow, or the date)
    const dayLabel = getRelativeDayLabel(utcTime, now, tzInfo.offset);
    
    // Format the time
    const formattedTime = formatTimeIn12HourFormat(localTime);
    
    // Format the timestamp with the correct timezone offset
    const timestampWithOffset = formatTimestampWithOffset(utcTime, tzInfo.offset);
    
    // Add to result
    if (!result[dayLabel]) {
      result[dayLabel] = [];
      timeMap[dayLabel] = {};
    }
    
    result[dayLabel].push({
      formattedTime,
      utcTime: timeStr, // Keep original UTC time for booking
      timestampWithOffset, // Add timestamp with timezone offset
      isDST: tzInfo.isDST, // Store DST status for reference
      tzAbbr: tzInfo.abbr // Store timezone abbreviation
    });
    
    // Add to time map
    timeMap[dayLabel][formattedTime] = {
      utcTime: timeStr,
      timestampWithOffset,
      isDST: tzInfo.isDST,
      tzAbbr: tzInfo.abbr
    };
  });
  
  // Sort times within each day
  Object.keys(result).forEach(day => {
    result[day].sort((a, b) => {
      return new Date(a.utcTime) - new Date(b.utcTime);
    });
  });
  
  // Create formatted output for this timezone
  // Use the base timezone name for the header
  const tzHeader = `${tzBase.name.toUpperCase()} TIME`;
  
  let output = `==== ${tzHeader} ====\n`;
  output += `(use if user says their time zone is ${tzBase.name.substring(0, 1)}T, ${tzBase.name} Time, `;
  output += `${tzBase.abbr.replace('S', 'D')}, ${tzBase.name} Daylight Time, `;
  output += `or ${tzBase.abbr}, ${tzBase.name} Standard Time`;
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
      // Extract the time from the timestamp to ensure consistency
      const timestampTime = t.timestampWithOffset.split('T')[1].substring(0, 5);
      const hours = parseInt(timestampTime.split(':')[0]);
      const minutes = timestampTime.split(':')[1];
      const ampm = hours >= 12 ? 'pm' : 'am';
      const displayHours = hours % 12 || 12; // Convert 0 to 12
      const correctedFormattedTime = `${displayHours}:${minutes}${ampm}`;
      
      // Use the corrected time format that matches the timestamp
      output += `  ${correctedFormattedTime} - ${t.timestampWithOffset}\n`;
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

// Define base timezone information (without DST adjustment)
const timezoneDefinitions = [
  { name: "Pacific", baseOffset: -8, abbr: "PST" },
  { name: "Mountain", baseOffset: -7, abbr: "MST" },
  { name: "Central", baseOffset: -6, abbr: "CST" },
  { name: "Eastern", baseOffset: -5, abbr: "EST" }
];

// Process each timezone with proper DST handling for each date
timezoneDefinitions.forEach(tzBase => {
  const result = organizeTimesByDay(rawAvailableTimes.split(','), tzBase);
  timesByTimezone[tzBase.name] = result.organizedTimes;
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

1. For any day (Today, Tomorrow, or future dates):
   - Present just a few times to start from the day's list
   - Use simple time format (e.g., "9:30am") without restating the timezone
   - If there's only one time available for a day, use singular wording ("The soonest I have availability is [day reference], at 9:30am")
   - If there are multiple times, use plural wording ("The soonest I have availability is [day reference], at 9:30am, 10:00am, and 11:00am. Would any of those work for you?")
   - Ask if any of those times work
   - If none work, present a few more times from the same day
   - Only move to the next day after you've offered all times from the current day

2. If there are times available for Today:
   - Use "Today (Thursday, June 15)" as the day reference
   - Example: "The soonest I have availability is Today (Thursday, June 15), at 9:00am, 10:00am, and 11:00am. Would any of those work for you?"

3. If there are no times for Today but there are times for Tomorrow:
   - Use "Tomorrow (Friday, June 16)" as the day reference
   - Example: "The soonest I have availability is Tomorrow (Friday, June 16), at 9:00am, 10:00am, and 11:00am. Would any of those work for you?"

4. If there are no times for Today or Tomorrow, but there are times for future dates:
   - Use the full day name and date as the reference (e.g., "Monday, June 19")
   - Example: "The soonest I have availability is Monday, June 19, at 9:00am, 10:00am, and 11:00am. Would any of those work for you?"

5. For all scenarios, continue this pattern for subsequent days:
   - Always present times in small groups (just a few at a time)
   - Only move to the next day after offering all times from the current day

6. Unless we're within a few days of January 1st, you don't need to say the year when listing available start times because the user will know what year it is.

7. If there are no available times at all, apologize and let them know you will have a sales team member reach out personally to help them.

8.  Use bookCalendlyTime to book the appointment without waiting for additional confirmation from the user. For the start_time attribute, use the timezone-specific timestamp that appears after the dash (-) character next to their selected time in the correct timezone section.
   - For example, if they select "7:00am" from the PACIFIC TIME section, use the specific timestamp that appears after the dash (e.g., "2023-06-15T07:00:00-07:00") from that section.

## Example Formatted Output

Below is an example of how the formatted timezone output will appear with the updated code. This example uses the following UTC timestamps as input:

```
2023-06-15T14:00:00Z,2023-06-15T15:30:00Z,2023-06-15T17:00:00Z,2023-06-15T18:30:00Z,2023-06-16T14:00:00Z,2023-06-16T15:30:00Z,2023-06-16T17:00:00Z,2023-06-16T18:30:00Z,2023-06-19T14:00:00Z,2023-06-19T15:30:00Z,2023-06-19T17:00:00Z,2023-06-19T18:30:00Z
```

Assuming today is June 15, 2023, and we're in Daylight Saving Time:

```
==== PACIFIC TIME ====
(use if user says their time zone is PT, Pacific Time, PDT, Pacific Daylight Time, or PST, Pacific Standard Time)

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
(use if user says their time zone is MT, Mountain Time, MDT, Mountain Daylight Time, or MST, Mountain Standard Time)

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
(use if user says their time zone is CT, Central Time, CDT, Central Daylight Time, or CST, Central Standard Time)

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
(use if user says their time zone is ET, Eastern Time, EDT, Eastern Daylight Time, or EST, Eastern Standard Time)

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

Note how during Daylight Saving Time:
- Pacific Standard Time (PST, UTC-8) becomes Pacific Daylight Time (PDT, UTC-7)
- Mountain Standard Time (MST, UTC-7) becomes Mountain Daylight Time (MDT, UTC-6)
- Central Standard Time (CST, UTC-6) becomes Central Daylight Time (CDT, UTC-5)
- Eastern Standard Time (EST, UTC-5) becomes Eastern Daylight Time (EDT, UTC-4) 