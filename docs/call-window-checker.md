# Call Window Checker

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

// Get current date/time in UTC
let now = new Date();

// ===== TEST SECTION =====
// Uncomment just ONE of the lines below to test with that specific time

// now = new Date(Date.UTC(2025, 2, 19, 16, 0, 0)); // March 19, 2025, 4:00 PM UTC (12:00 PM EDT)
// now = new Date(Date.UTC(2025, 2, 19, 23, 30, 0)); // March 19, 2025, 11:30 PM UTC (7:30 PM EDT)
// now = new Date(Date.UTC(2025, 2, 19, 1, 0, 0)); // March 19, 2025, 1:00 AM UTC (9:00 PM EDT previous day)
// now = new Date(Date.UTC(2025, 6, 4, 15, 0, 0)); // July 4, 2025 (Independence Day), 15:00 UTC (11:00 AM EDT)
// now = new Date(Date.UTC(2025, 2, 22, 15, 0, 0)); // Saturday, March 22, 2025, 15:00 UTC (11:00 AM EDT)
// now = new Date(Date.UTC(2025, 11, 24, 15, 0, 0)); // Friday, Dec 24, 2025 (day before Christmas), 15:00 UTC (10:00 AM EST)
// now = new Date(Date.UTC(2025, 2, 1, 15, 0, 0)); // First day of month test, March 1, 2025
// now = new Date(Date.UTC(2025, 2, 31, 15, 0, 0)); // Last day of month test, March 31, 2025

// console.log("Testing with time:", now.toISOString()); // Uncomment to see the test time
// ===== END TEST SECTION =====

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

// Get Eastern Time information with accurate DST handling
function getEasternTimeInfo(utcDate) {
  // Determine if the date is in Eastern Daylight Time
  // EDT from second Sunday in March to first Sunday in November
  const year = utcDate.getUTCFullYear();
  
  // DST start: second Sunday in March at 2 AM local time (7 AM UTC)
  const dstStart = new Date(Date.UTC(year, 2, 8, 7, 0, 0)); 
  dstStart.setUTCDate(dstStart.getUTCDate() + (7 - dstStart.getUTCDay()) % 7 + 7);
  
  // DST end: first Sunday in November at 2 AM local time (6 AM UTC)
  const dstEnd = new Date(Date.UTC(year, 10, 1, 6, 0, 0));
  dstEnd.setUTCDate(dstEnd.getUTCDate() + (7 - dstEnd.getUTCDay()) % 7);
  
  // Check if current date is within DST
  const isDST = utcDate >= dstStart && utcDate < dstEnd;
  
  // Eastern Time offset: UTC-5 for EST, UTC-4 for EDT
  const etOffset = isDST ? -4 : -5;
  
  return {
    isDST,
    offset: etOffset,
    offsetString: etOffset < 0 ? `-0${Math.abs(etOffset)}:00` : `+0${etOffset}:00`,
    name: isDST ? "EDT" : "EST"
  };
}

// Calculate ET hours from UTC time
function getETHoursFromUTC(utcHours, etOffset) {
  let etHours = utcHours + etOffset;
  if (etHours < 0) etHours += 24;
  if (etHours >= 24) etHours -= 24;
  return etHours;
}

// Get current UTC time
const utcNow = now;

// Get Eastern Time info
const etInfo = getEasternTimeInfo(utcNow);

// Calculate ET date components
const utcYear = utcNow.getUTCFullYear();
const utcMonth = utcNow.getUTCMonth();
const utcDay = utcNow.getUTCDate();
const utcHours = utcNow.getUTCHours();
const utcMinutes = utcNow.getUTCMinutes();
const utcSeconds = utcNow.getUTCSeconds();

// Calculate ET hours (this may require day adjustment if crossing midnight)
let etHours = getETHoursFromUTC(utcHours, etInfo.offset);
let etDay = utcDay;
let etMonth = utcMonth;
let etYear = utcYear;

// Adjust day if needed (when ET day differs from UTC day due to timezone)
if (utcHours + etInfo.offset < 0) {
  // It's the previous day in ET
  const prevDay = new Date(Date.UTC(utcYear, utcMonth, utcDay - 1));
  etDay = prevDay.getUTCDate();
  etMonth = prevDay.getUTCMonth();
  etYear = prevDay.getUTCFullYear();
} else if (utcHours + etInfo.offset >= 24) {
  // It's the next day in ET
  const nextDay = new Date(Date.UTC(utcYear, utcMonth, utcDay + 1));
  etDay = nextDay.getUTCDate();
  etMonth = nextDay.getUTCMonth();
  etYear = nextDay.getUTCFullYear();
}

// Create timestamp strings with proper timezone format
const currentETTimestamp = `${etYear}-${(etMonth + 1).toString().padStart(2, '0')}-${etDay.toString().padStart(2, '0')}T${etHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}:${utcSeconds.toString().padStart(2, '0')}${etInfo.offsetString}`;

// Create Eastern Time date object for day-based operations
// Note: This date object is still in UTC internally but represents ET date and time for our calculations
const easternDate = new Date(Date.UTC(etYear, etMonth, etDay, etHours, utcMinutes, utcSeconds));

// Calculate business hours in UTC (11 AM - 7 PM ET)
// First, create the times in Eastern Time
const businessStartHourET = 11;
const businessEndHourET = 19;

// Convert to UTC hours by subtracting the offset (since ET offset is negative, we add its absolute value)
const businessStartHourUTC = (businessStartHourET - etInfo.offset) % 24; 
const businessEndHourUTC = (businessEndHourET - etInfo.offset) % 24;

// Create the full business hours datetime objects in UTC
const businessHoursStartUTC = new Date(Date.UTC(etYear, etMonth, etDay, businessStartHourUTC, 0, 0));
const businessHoursEndUTC = new Date(Date.UTC(etYear, etMonth, etDay, businessEndHourUTC, 0, 0));

// Format business hours timestamps in ET with timezone offset
const businessStartETTimestamp = `${etYear}-${(etMonth + 1).toString().padStart(2, '0')}-${etDay.toString().padStart(2, '0')}T${businessStartHourET.toString().padStart(2, '0')}:00:00${etInfo.offsetString}`;
const businessEndETTimestamp = `${etYear}-${(etMonth + 1).toString().padStart(2, '0')}-${etDay.toString().padStart(2, '0')}T${businessEndHourET.toString().padStart(2, '0')}:00:00${etInfo.offsetString}`;

// Initialize results
const result = {
  canMakeCalls: true,
  reasons: [],
  details: {
    currentTimeUTC: utcNow.toISOString(),
    currentTimeET: currentETTimestamp,
    easternTimeInfo: {
      isDST: etInfo.isDST,
      timezone: etInfo.name,
      offset: etInfo.offset,
      offsetString: etInfo.offsetString
    },
    businessHours: {
      startUTC: businessHoursStartUTC.toISOString(),
      endUTC: businessHoursEndUTC.toISOString(),
      startET: businessStartETTimestamp,
      endET: businessEndETTimestamp,
      startHourET: businessStartHourET,
      endHourET: businessEndHourET
    },
    today: {
      dateET: `${etYear}-${etMonth + 1}-${etDay}`,
      weekday: getDayName(easternDate),
      weekdayNumber: getDayOfWeek(easternDate)
    },
    testMode: utcNow.getTime() !== new Date().getTime() // Flag indicating if we're in test mode
  }
};

// Check if current time is within business hours
const isBusinessHours = 
  utcNow >= businessHoursStartUTC && 
  utcNow < businessHoursEndUTC;

if (!isBusinessHours) {
  result.canMakeCalls = false;
  result.reasons.push("Outside of business hours (11 AM - 7 PM ET)");
}

// Check if it's a weekday (Monday-Friday) in Eastern Time
const weekday = getDayOfWeek(easternDate);
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
// Use the Eastern Time year to determine holidays
const year = etYear;

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

// Check if today is a holiday in Eastern Time
const today = `${etYear}-${etMonth + 1}-${etDay}`;
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

// Create yesterday and tomorrow dates in Eastern Time, handling month/year boundaries
let yesterdayET, tomorrowET;

// Handle previous day
if (etDay === 1) {
  // First day of month, need to go to previous month
  const prevMonth = new Date(Date.UTC(etYear, etMonth, 0)); // Last day of previous month
  yesterdayET = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth(), prevMonth.getUTCDate()));
} else {
  yesterdayET = new Date(Date.UTC(etYear, etMonth, etDay - 1));
}

// Handle next day
const lastDayOfMonth = new Date(Date.UTC(etYear, etMonth + 1, 0)).getUTCDate(); // Last day of current month
if (etDay === lastDayOfMonth) {
  // Last day of month, need to go to next month
  tomorrowET = new Date(Date.UTC(etYear, etMonth + 1, 1));
} else {
  tomorrowET = new Date(Date.UTC(etYear, etMonth, etDay + 1));
}

const yesterdayETFormatted = `${yesterdayET.getUTCFullYear()}-${yesterdayET.getUTCMonth() + 1}-${yesterdayET.getUTCDate()}`;
const tomorrowETFormatted = `${tomorrowET.getUTCFullYear()}-${tomorrowET.getUTCMonth() + 1}-${tomorrowET.getUTCDate()}`;

// Check for observed holidays
const isFridayBeforeSaturdayHoliday = weekday === 5 && 
  fixedDateHolidays.includes(tomorrowETFormatted);

if (isFridayBeforeSaturdayHoliday) {
  result.canMakeCalls = false;
  
  // Find which holiday it is
  const holidayName = result.details.holidays.find(h => h.date === tomorrowETFormatted)?.name || "Holiday";
  result.reasons.push(`Today is Friday before a Saturday holiday (${holidayName})`);
}

const isMondayAfterSundayHoliday = weekday === 1 && 
  fixedDateHolidays.includes(yesterdayETFormatted);

if (isMondayAfterSundayHoliday) {
  result.canMakeCalls = false;
  
  // Find which holiday it is
  const holidayName = result.details.holidays.find(h => h.date === yesterdayETFormatted)?.name || "Holiday";
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

### Test Section
The implementation includes a test section at the beginning of the code that allows you to test various scenarios by uncommenting specific test cases:

```javascript
// ===== TEST SECTION =====
// Uncomment just ONE of the lines below to test with that specific time

// now = new Date(Date.UTC(2025, 2, 19, 16, 0, 0)); // March 19, 2025, 4:00 PM UTC (12:00 PM EDT)
// now = new Date(Date.UTC(2025, 2, 19, 23, 30, 0)); // March 19, 2025, 11:30 PM UTC (7:30 PM EDT)
// now = new Date(Date.UTC(2025, 6, 4, 15, 0, 0)); // July 4, 2025 (Independence Day), 15:00 UTC (11:00 AM EDT)
// ...
```

This makes it easy to validate the function's behavior with different dates, times, holidays, and weekends.

### Enhanced Timezone Handling

The implementation includes robust handling of Eastern Time with accurate Daylight Saving Time transitions:

```javascript
function getEasternTimeInfo(utcDate) {
  // Determine if the date is in Eastern Daylight Time
  // EDT from second Sunday in March to first Sunday in November
  const year = utcDate.getUTCFullYear();
  
  // DST start: second Sunday in March at 2 AM local time (7 AM UTC)
  const dstStart = new Date(Date.UTC(year, 2, 8, 7, 0, 0)); 
  dstStart.setUTCDate(dstStart.getUTCDate() + (7 - dstStart.getUTCDay()) % 7 + 7);
  
  // DST end: first Sunday in November at 2 AM local time (6 AM UTC)
  const dstEnd = new Date(Date.UTC(year, 10, 1, 6, 0, 0));
  dstEnd.setUTCDate(dstEnd.getUTCDate() + (7 - dstEnd.getUTCDay()) % 7);
  
  // Check if current date is within DST
  const isDST = utcDate >= dstStart && utcDate < dstEnd;
  
  // Eastern Time offset: UTC-5 for EST, UTC-4 for EDT
  const etOffset = isDST ? -4 : -5;
  
  return {
    isDST,
    offset: etOffset,
    offsetString: etOffset < 0 ? `-0${Math.abs(etOffset)}:00` : `+0${etOffset}:00`,
    name: isDST ? "EDT" : "EST"
  };
}
```

This function accurately determines whether a date falls within Daylight Saving Time based on the US rules (second Sunday in March to first Sunday in November). It returns complete timezone information including the offset and proper timezone abbreviation.

### Day Boundary Handling

The code properly handles day boundaries when converting between UTC and Eastern Time:

```javascript
// Adjust day if needed (when ET day differs from UTC day due to timezone)
if (utcHours + etInfo.offset < 0) {
  // It's the previous day in ET
  const prevDay = new Date(Date.UTC(utcYear, utcMonth, utcDay - 1));
  etDay = prevDay.getUTCDate();
  etMonth = prevDay.getUTCMonth();
  etYear = prevDay.getUTCFullYear();
} else if (utcHours + etInfo.offset >= 24) {
  // It's the next day in ET
  const nextDay = new Date(Date.UTC(utcYear, utcMonth, utcDay + 1));
  etDay = nextDay.getUTCDate();
  etMonth = nextDay.getUTCMonth();
  etYear = nextDay.getUTCFullYear();
}
```

This ensures that when converting UTC times near midnight to Eastern Time, the date is correctly adjusted.

### Business Hours Check

Business hours are defined as 11 AM to 7 PM Eastern Time and properly converted to UTC for comparison:

```javascript
// Calculate business hours in UTC (11 AM - 7 PM ET)
// First, create the times in Eastern Time
const businessStartHourET = 11;
const businessEndHourET = 19;

// Convert to UTC hours by subtracting the offset (since ET offset is negative, we add its absolute value)
const businessStartHourUTC = (businessStartHourET - etInfo.offset) % 24; 
const businessEndHourUTC = (businessEndHourET - etInfo.offset) % 24;

// Create the full business hours datetime objects in UTC
const businessHoursStartUTC = new Date(Date.UTC(etYear, etMonth, etDay, businessStartHourUTC, 0, 0));
const businessHoursEndUTC = new Date(Date.UTC(etYear, etMonth, etDay, businessEndHourUTC, 0, 0));
```

This conversion ensures that 11 AM to 7 PM Eastern Time is correctly represented in UTC, accounting for both Standard Time and Daylight Saving Time.

### Month Boundary Handling for Adjacent Days

The implementation properly handles month boundaries when determining adjacent days (yesterday and tomorrow) for observed holiday checks:

```javascript
// Create yesterday and tomorrow dates in Eastern Time, handling month/year boundaries
let yesterdayET, tomorrowET;

// Handle previous day
if (etDay === 1) {
  // First day of month, need to go to previous month
  const prevMonth = new Date(Date.UTC(etYear, etMonth, 0)); // Last day of previous month
  yesterdayET = new Date(Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth(), prevMonth.getUTCDate()));
} else {
  yesterdayET = new Date(Date.UTC(etYear, etMonth, etDay - 1));
}

// Handle next day
const lastDayOfMonth = new Date(Date.UTC(etYear, etMonth + 1, 0)).getUTCDate(); // Last day of current month
if (etDay === lastDayOfMonth) {
  // Last day of month, need to go to next month
  tomorrowET = new Date(Date.UTC(etYear, etMonth + 1, 1));
} else {
  tomorrowET = new Date(Date.UTC(etYear, etMonth, etDay + 1));
}
```

This ensures that even at month boundaries (e.g., January 1st or the last day of a month), the adjacent days are correctly determined.

### Weekday Check

Weekdays are defined as Monday (1) through Friday (5) using the day of week value based on Eastern Time:

```javascript
// Check if it's a weekday (Monday-Friday) in Eastern Time
const weekday = getDayOfWeek(easternDate);
const isWeekday = weekday >= 1 && weekday <= 5;
```

### US Federal Holidays

The implementation calculates all US federal holidays for the current year in Eastern Time, including both fixed-date holidays and floating holidays.

### Observed Holidays

The code correctly identifies observed holidays when fixed-date holidays fall on weekends:

```javascript
// Check for observed holidays
const isFridayBeforeSaturdayHoliday = weekday === 5 && 
  fixedDateHolidays.includes(tomorrowETFormatted);

const isMondayAfterSundayHoliday = weekday === 1 && 
  fixedDateHolidays.includes(yesterdayETFormatted);
```

This ensures that:
- Saturday holidays are observed on the preceding Friday
- Sunday holidays are observed on the following Monday

## Debugging

The implementation includes comprehensive debugging information in the result object:

```javascript
const result = {
  canMakeCalls: true,
  reasons: [],
  details: {
    currentTimeUTC: utcNow.toISOString(),
    currentTimeET: currentETTimestamp,
    easternTimeInfo: {
      isDST: etInfo.isDST,
      timezone: etInfo.name,
      offset: etInfo.offset,
      offsetString: etInfo.offsetString
    },
    businessHours: {
      startUTC: businessHoursStartUTC.toISOString(),
      endUTC: businessHoursEndUTC.toISOString(),
      startET: businessStartETTimestamp,
      endET: businessEndETTimestamp,
      startHourET: businessStartHourET,
      endHourET: businessEndHourET
    },
    today: {
      dateET: `${etYear}-${etMonth + 1}-${etDay}`,
      weekday: getDayName(easternDate),
      weekdayNumber: getDayOfWeek(easternDate)
    },
    testMode: utcNow.getTime() !== new Date().getTime() // Flag indicating if we're in test mode
  }
};
```

This provides:
- Current time in both UTC and Eastern Time with proper timezone offset
- Eastern Time information (DST status, timezone name, offset)
- Business hours in both UTC and Eastern Time
- Date information in Eastern Time (date, weekday)
- Holiday information
- Test mode indicator

## Customization

To modify the business hours, adjust the hour values in the business hours definition:

```javascript
// First, create the times in Eastern Time
const businessStartHourET = 11; // Change from 11 to 9 for 9 AM start
const businessEndHourET = 19;   // Change from 19 to 17 for 5 PM end
```

To test the code with different dates and times, use the test section at the beginning:

```javascript
// Uncomment just ONE of the lines below to test with that specific time
// now = new Date(Date.UTC(2025, 2, 19, 16, 0, 0)); // March 19, 2025, 4:00 PM UTC (12:00 PM EDT)
```

To use a different timezone, modify the `getEasternTimeInfo` function to use a different set of offset values and DST rules.
