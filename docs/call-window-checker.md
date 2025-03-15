# Call Window Checker for n8n

This document explains the implementation of the call window checker expression used in n8n workflows to ensure calls are only made during appropriate business hours on business days, excluding US federal holidays.

## Overview

The call window checker is a single expression that evaluates to `true` only when all of the following conditions are met:
- Current time is within business hours (11 AM - 7 PM Eastern Time)
- Current day is a weekday (Monday-Friday)
- Current day is not a US federal holiday
- Current day is not a Friday before a Saturday holiday (observed holiday)
- Current day is not a Monday after a Sunday holiday (observed holiday)

## Implementation

The implementation uses the standard JavaScript Date object without any external dependencies, making it compatible with any n8n environment.

```javascript
// Call Window Checker Function
// Returns true if current time is within business hours on a business day (not a holiday)

// Get current date/time
const now = new Date();

// Function to format date as YYYY-M-D
function formatDateYMD(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Function to get day of week (0 = Sunday, 1 = Monday, etc.)
function getDayOfWeek(date) {
  return date.getDay();
}

// Function to get day name
function getDayName(date) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

// Convert to Eastern Time
// Note: This is a simplified approach and doesn't handle DST perfectly
function getEasternTime(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  // Eastern Time is UTC-5 in standard time, UTC-4 in daylight time
  // Check if we're in DST (roughly March to November)
  const month = date.getMonth() + 1; // 1-12
  const isDST = month > 3 && month < 11;
  const easternOffset = isDST ? -4 : -5;
  return new Date(utc + (3600000 * easternOffset));
}

// Get current time in Eastern Time
const easternNow = getEasternTime(now);

// Initialize results
const result = {
  canMakeCalls: true,
  reasons: [],
  details: {
    currentTime: easternNow.toISOString(),
    businessHours: {
      start: new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate(), 11, 0, 0).toISOString(),
      end: new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate(), 19, 0, 0).toISOString()
    },
    today: {
      date: formatDateYMD(easternNow),
      weekday: getDayName(easternNow),
      weekdayNumber: getDayOfWeek(easternNow)
    },
    holidays: []
  }
};

// Check if current time is within business hours (11 AM - 7 PM ET)
const businessHoursStart = new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate(), 11, 0, 0);
const businessHoursEnd = new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate(), 19, 0, 0);
const isBusinessHours = easternNow >= businessHoursStart && easternNow <= businessHoursEnd;

if (!isBusinessHours) {
  result.canMakeCalls = false;
  result.reasons.push("Outside of business hours (11 AM - 7 PM ET)");
}

// Check if it's a weekday (Monday-Friday)
const weekday = getDayOfWeek(easternNow);
const isWeekday = weekday >= 1 && weekday <= 5;

if (!isWeekday) {
  result.canMakeCalls = false;
  result.reasons.push("Not a weekday");
}

// Helper function to get the nth occurrence of a specific day in a month
function getNthDayOfMonth(year, dayOfWeek, month, n) {
  // month is 1-12, dayOfWeek is 0-6 (0 = Sunday)
  const firstDay = new Date(year, month - 1, 1);
  let dayOffset = dayOfWeek - firstDay.getDay();
  if (dayOffset < 0) dayOffset += 7;
  const firstOccurrence = new Date(year, month - 1, 1 + dayOffset);
  return new Date(year, month - 1, 1 + dayOffset + (n - 1) * 7);
}

// Helper function to get the last occurrence of a specific day in a month
function getLastDayOfMonth(year, dayOfWeek, month) {
  // month is 1-12, dayOfWeek is 0-6 (0 = Sunday)
  const lastDay = new Date(year, month, 0); // Last day of month
  const lastDayOfWeek = lastDay.getDay();
  let dayOffset = dayOfWeek - lastDayOfWeek;
  if (dayOffset > 0) dayOffset -= 7;
  return new Date(year, month - 1, lastDay.getDate() + dayOffset);
}

// Define all US federal holidays for the current year
const year = easternNow.getFullYear();

// Calculate floating holidays
const mlkDay = getNthDayOfMonth(year, 1, 1, 3); // 3rd Monday in January
const presidentsDay = getNthDayOfMonth(year, 1, 2, 3); // 3rd Monday in February
const memorialDay = getLastDayOfMonth(year, 1, 5); // Last Monday in May
const laborDay = getNthDayOfMonth(year, 1, 9, 1); // 1st Monday in September
const columbusDay = getNthDayOfMonth(year, 1, 10, 2); // 2nd Monday in October
const thanksgiving = getNthDayOfMonth(year, 4, 11, 4); // 4th Thursday in November

// Format all holidays as YYYY-M-D
const holidays = [
  // Fixed date holidays
  `${year}-1-1`,   // New Year's Day
  `${year}-6-19`,  // Juneteenth
  `${year}-7-4`,   // Independence Day
  `${year}-11-11`, // Veterans Day
  `${year}-12-25`, // Christmas
  
  // Floating date holidays
  formatDateYMD(mlkDay),          // MLK Day
  formatDateYMD(presidentsDay),   // Presidents' Day
  formatDateYMD(memorialDay),     // Memorial Day
  formatDateYMD(laborDay),        // Labor Day
  formatDateYMD(columbusDay),     // Columbus Day
  formatDateYMD(thanksgiving)     // Thanksgiving
];

// Add holiday details to result
result.details.holidays = [
  { name: "New Year's Day", date: `${year}-1-1` },
  { name: "Martin Luther King Jr. Day", date: formatDateYMD(mlkDay) },
  { name: "Presidents' Day", date: formatDateYMD(presidentsDay) },
  { name: "Memorial Day", date: formatDateYMD(memorialDay) },
  { name: "Juneteenth", date: `${year}-6-19` },
  { name: "Independence Day", date: `${year}-7-4` },
  { name: "Labor Day", date: formatDateYMD(laborDay) },
  { name: "Columbus Day", date: formatDateYMD(columbusDay) },
  { name: "Veterans Day", date: `${year}-11-11` },
  { name: "Thanksgiving", date: formatDateYMD(thanksgiving) },
  { name: "Christmas", date: `${year}-12-25` }
];

// Check if today is a holiday
const today = formatDateYMD(easternNow);
const isHoliday = holidays.includes(today);

if (isHoliday) {
  result.canMakeCalls = false;
  
  // Find which holiday it is
  const holidayName = result.details.holidays.find(h => h.date === today)?.name || "Holiday";
  result.reasons.push(`Today is a holiday (${holidayName})`);
}

// Fixed date holidays for weekend checks
const fixedDateHolidays = [
  `${year}-1-1`,   // New Year's Day
  `${year}-6-19`,  // Juneteenth
  `${year}-7-4`,   // Independence Day
  `${year}-11-11`, // Veterans Day
  `${year}-12-25`  // Christmas
];

// If today is Friday and tomorrow is a fixed-date holiday that falls on Saturday
const yesterday = new Date(easternNow);
yesterday.setDate(easternNow.getDate() - 1);
const tomorrow = new Date(easternNow);
tomorrow.setDate(easternNow.getDate() + 1);

const tomorrowHolidayCheck = formatDateYMD(tomorrow);
const isFridayBeforeSaturdayHoliday = getDayOfWeek(easternNow) === 5 && 
  fixedDateHolidays.includes(tomorrowHolidayCheck);

if (isFridayBeforeSaturdayHoliday) {
  result.canMakeCalls = false;
  
  // Find which holiday it is
  const holidayName = result.details.holidays.find(h => h.date === tomorrowHolidayCheck)?.name || "Holiday";
  result.reasons.push(`Today is Friday before a Saturday holiday (${holidayName})`);
}

// If today is Monday and yesterday was a fixed-date holiday that fell on Sunday
const yesterdayHolidayCheck = formatDateYMD(yesterday);
const isMondayAfterSundayHoliday = getDayOfWeek(easternNow) === 1 && 
  fixedDateHolidays.includes(yesterdayHolidayCheck);

if (isMondayAfterSundayHoliday) {
  result.canMakeCalls = false;
  
  // Find which holiday it is
  const holidayName = result.details.holidays.find(h => h.date === yesterdayHolidayCheck)?.name || "Holiday";
  result.reasons.push(`Today is Monday after a Sunday holiday (${holidayName})`);
}

// Process all items
const items = [];
for (const item of $input.all()) {
  // Add our result to each item
  items.push({
    json: {
      ...item.json,
      callWindow: result
    }
  });
}

// Return all items with our result added
return items;
```

## Key Components

### Timezone Handling

The implementation includes a custom function to convert to Eastern Time, with basic handling of Daylight Saving Time:

```javascript
function getEasternTime(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  // Eastern Time is UTC-5 in standard time, UTC-4 in daylight time
  // Check if we're in DST (roughly March to November)
  const month = date.getMonth() + 1; // 1-12
  const isDST = month > 3 && month < 11;
  const easternOffset = isDST ? -4 : -5;
  return new Date(utc + (3600000 * easternOffset));
}
```

### Business Hours Check

Business hours are defined as 11 AM to 7 PM Eastern Time.

```javascript
const businessHoursStart = new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate(), 11, 0, 0);
const businessHoursEnd = new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate(), 19, 0, 0);
const isBusinessHours = easternNow >= businessHoursStart && easternNow <= businessHoursEnd;
```

### Weekday Check

Weekdays are defined as Monday (1) through Friday (5) using the day of week value.

```javascript
const weekday = getDayOfWeek(easternNow);
const isWeekday = weekday >= 1 && weekday <= 5;
```

### US Federal Holidays

The implementation calculates all US federal holidays for the current year, including both fixed-date holidays and floating holidays (like Thanksgiving or Memorial Day).

Fixed-date holidays:
- New Year's Day (January 1)
- Juneteenth (June 19)
- Independence Day (July 4)
- Veterans Day (November 11)
- Christmas (December 25)

Floating holidays:
- Martin Luther King Jr. Day (3rd Monday in January)
- Presidents' Day (3rd Monday in February)
- Memorial Day (last Monday in May)
- Labor Day (1st Monday in September)
- Columbus Day / Indigenous Peoples' Day (2nd Monday in October)
- Thanksgiving (4th Thursday in November)

### Observed Holidays

When a fixed-date holiday falls on a weekend, it's typically observed on the nearest weekday:
- Saturday holidays are observed on the preceding Friday
- Sunday holidays are observed on the following Monday

The implementation checks for these cases to prevent calls on observed holidays.

## Usage in n8n

This code is designed to be used in a Code node in n8n workflows to control whether outbound calls should be made. The function processes all input items and adds a `callWindow` property to each item with detailed information about the call window status.

### Example Workflow Structure

```
[Trigger] → [Call Window Checker Code] → [IF (item.json.callWindow.canMakeCalls)] → (true) → [Make Call]
                                                                                  → (false) → [Schedule for Later]
```

## Debugging

The implementation includes a detailed result object that provides comprehensive information for debugging:

```javascript
const result = {
  canMakeCalls: true,  // Boolean indicating if calls can be made
  reasons: [],         // Array of reasons why calls cannot be made (if applicable)
  details: {
    currentTime: easternNow.toISOString(),  // Current time in Eastern Time
    businessHours: {
      start: businessHoursStart.toISOString(),  // Business hours start time
      end: businessHoursEnd.toISOString()       // Business hours end time
    },
    today: {
      date: formatDateYMD(easternNow),          // Today's date in YYYY-M-D format
      weekday: getDayName(easternNow),          // Today's weekday name
      weekdayNumber: getDayOfWeek(easternNow)   // Today's weekday number (0-6)
    },
    holidays: []  // Array of holiday objects with name and date
  }
};
```

This detailed information makes it easy to identify which condition might be preventing calls from being made.

## Customization

To modify the business hours, adjust the hour values in the business hours check:

```javascript
const businessHoursStart = new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate(), 9, 0, 0); // Change from 11 to 9 for 9 AM start
const businessHoursEnd = new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate(), 17, 0, 0); // Change from 19 to 17 for 5 PM end
```

To use a different timezone, modify the `getEasternTime` function to use a different offset:

```javascript
// For Central Time (UTC-6/UTC-5)
function getCentralTime(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const month = date.getMonth() + 1;
  const isDST = month > 3 && month < 11;
  const centralOffset = isDST ? -5 : -6;
  return new Date(utc + (3600000 * centralOffset));
}
``` 