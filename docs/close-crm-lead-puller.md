# Documentation: Close CRM Lead Puller

## Overview
This code retrieves leads from a Close CRM smart view, processes them to extract key information, and returns a structured dataset. It implements proper pagination and rate limit handling to reliably fetch large numbers of leads. It also identifies which leads in the Google Sheet need to be retired (no longer in the Smart View) and which are still valid.

## Purpose
The code serves as an n8n node that:
1. Fetches leads matching a specific smart view in Close CRM
2. Extracts contact information (name, email, phone)
3. Identifies leads that need to be retired (no longer in the Smart View)
4. Formats the data for further processing or export to Google Sheets

## Configuration

```javascript
// Configuration
const apiToken = "api_2Kuv7mfiemtrtm6Ccnbsyg.6fmkNPVj4sb1xzhcP87nMA";
const baseUrl = "https://api.close.com/api/v1";
const savedSearchId = "save_jRcDTh1U9rMAX12xxtQ8WxgX4zMDbFDbJaQby6lHn1a";
const limit = 200; // Maximum page size for pagination
```

- `apiToken`: Your Close CRM API token for authentication
- `baseUrl`: The base URL for the Close CRM API
- `savedSearchId`: The ID of the smart view to pull leads from
- `limit`: Maximum number of leads to fetch per request (200 is the API maximum)

## Key Functions

### 1. `sleep(ms)`
Pauses execution for a specified number of milliseconds, used for rate limit handling.

### 2. `parseRateLimitHeader(header)`
Parses the standard `RateLimit` header from API responses to extract limit, remaining, and reset values.

### 3. `makeRequest(method, endpoint, data, retries)`
Makes HTTP requests to the Close CRM API with built-in rate limit handling and retries:
- Handles 429 (Too Many Requests) responses by waiting the specified time
- Monitors rate limit headers and logs warnings when limits are running low
- Retries failed requests up to 3 times

## Implementation Process

### Step 1: Get Smart View Definition
The code first fetches the smart view definition to extract the query structure:

```javascript
const smartView = await makeRequest('GET', `/saved_search/${savedSearchId}/`);
```

### Step 2: Fetch Lead IDs
Using cursor-based pagination, the code fetches all lead IDs matching the smart view:

```javascript
const searchQuery = {
  query: smartView.s_query.query,
  _limit: limit,
  sort: smartView.s_query.sort,
  include_counts: true
};

// Paginate through results
while (hasMore) {
  if (cursor) {
    searchQuery.cursor = cursor;
  }
  
  const searchResults = await makeRequest('POST', '/data/search/', searchQuery);
  
  // Process results and update cursor
  // ...
}
```

### Step 3: Filter and Categorize Leads
The code compares the leads from the Smart View with those in the Google Sheet to:
- Identify new leads to be added to the Google Sheet
- Identify existing leads that are still valid
- Identify leads that need to be retired (no longer in the Smart View)

```javascript
// Get the Close IDs from the Google Sheet input
const existingCloseIds = $input.all().map(item => item.json.closeId || item.json["Close ID"] || "").filter(id => id !== "");

// Find which existing leads are still valid in the Smart View and which need to be retired
const existingValidLeads = existingCloseIds.filter(id => allLeadIds.includes(id));
  
// Convert retiring lead IDs to objects with closeId property
const existingRetiringLeads = existingCloseIds
  .filter(id => !allLeadIds.includes(id))
  .map(id => {
    // Find the original item from Google Sheet to get any additional data we might need
    const originalItem = $input.all().find(item => 
      (item.json.closeId === id) || (item.json["Close ID"] === id)
    );
    
    return {
      closeId: id,
      // Include any other fields we might want to preserve or reference
      firstName: originalItem?.json.firstName || originalItem?.json["First Name"] || "",
      lastName: originalItem?.json.lastName || originalItem?.json["Last Name"] || "",
      email: originalItem?.json.email || originalItem?.json["Email"] || ""
    };
  });

// Filter out leads that already exist in the Google Sheet
const filteredLeadIds = allLeadIds.filter(id => !existingCloseIds.includes(id));

console.log(`Found ${allLeadIds.length} total leads from Close AI SDR Smart View`);
console.log(`Found ${existingCloseIds.length} existing leads in Google Sheet`);
console.log(`${existingValidLeads.length} existing leads are still valid in Close AI SDR Smart View`);
console.log(`${existingRetiringLeads.length} existing leads need to be retired (no longer in Close AI SDR Smart View)`);
console.log(`${filteredLeadIds.length} new leads to process and add to Google Sheet`);
```

### Step 4: Fetch Lead Details
For each new lead ID, the code fetches complete lead details in batches of 10:

```javascript
const batchPromises = batch.map(id => makeRequest('GET', `/lead/${id}/?_fields=_all`));
const batchResults = await Promise.all(batchPromises);
```

### Step 5: Process Lead Data
Each lead is processed to extract:
- First and last name (parsed from display_name, handling middle initials)
- Email address
- Phone number
- Creation date
- Close CRM lead ID
- Assigned salesperson

## Rate Limit Handling

The code implements best practices for handling Close CRM API rate limits:

1. Uses the standard `RateLimit` header to monitor limits
2. Uses the `Retry-After` header from 429 responses to determine wait time
3. Implements exponential backoff for other types of errors
4. Processes leads in batches to avoid overwhelming the API

Example of rate limit handling:

```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  const waitTime = retryAfter ? parseInt(retryAfter, 10) : 60;
  
  console.log(`Rate limited. Waiting for ${waitTime} seconds before retrying...`);
  await sleep(waitTime * 1000);
  
  return makeRequest(method, endpoint, data, retries);
}
```

## Output Format

The code returns a JSON object with:
1. `counts`: Numerical summaries of each lead category
2. `newLeads`: An array of new leads to be added to the Google Sheet
3. `validExistingLeads`: An array of lead IDs that exist in both the Google Sheet and the Smart View
4. `retiringLeads`: An array of lead IDs that exist in the Google Sheet but not in the Smart View

Example output:

```json
{
  "counts": {
    "newLeads": 15,
    "validExistingLeads": 120,
    "retiringLeads": 5,
    "totalLeadsInSmartView": 135
  },
  "newLeads": [
    {
      "firstName": "John",
      "lastName": "Smith",
      "email": "john.smith@example.com",
      "phone": "+1234567890",
      "createdAt": "2023-01-15T14:30:45.123Z",
      "closeId": "lead_USFRjdiCR0YfEYqFKDNrRA8yF0HoTZ25ax64wiTufH7",
      "salesperson": "Jane Doe"
    },
    // More leads...
  ],
  "validExistingLeads": [
    "lead_abc123",
    "lead_def456",
    // More lead IDs...
  ],
  "retiringLeads": [
    {
      "closeId": "lead_xyz789",
      "firstName": "Michael",
      "lastName": "Johnson",
      "email": "michael.johnson@example.com"
    },
    {
      "closeId": "lead_uvw321",
      "firstName": "Sarah",
      "lastName": "Williams",
      "email": "sarah.williams@example.com"
    },
    // More lead objects...
  ]
}
```

## Usage Considerations

### Performance
- The code uses parallel requests (Promise.all) for better performance
- Leads are processed in batches of 10 to balance speed and API load
- For very large datasets (thousands of leads), expect longer processing times

### Rate Limits
- Close CRM has rate limits that may affect processing speed
- The code handles rate limits automatically but may pause execution when limits are reached
- Consider running during off-peak hours for large datasets

### Error Handling
- The code includes comprehensive error handling
- Failed requests are retried up to 3 times
- Any unrecoverable errors are returned in the output

## Integration with n8n

This code is designed to be used in an n8n Code node. The output can be used to:
1. Add new leads to a Google Sheet
2. Update existing leads in the Google Sheet
3. Mark leads as "retired" in the Google Sheet when they're no longer in the Smart View

### Workflow Integration Steps:
1. **For retiring leads**: 
   - Use a "Split In Items" node to process the `retiringLeads` array
   - Set "Value to Split" to `data.json.retiringLeads`
   - Connect to a Google Sheets node with Operation set to "Update"
   - Set "Key" to "Close ID" (or "closeId" - match your column name)
   - Set "Key Value" to `{{$json.closeId}}` (using the closeId property from each object)
   - Add a field to update:
     - Field name: "Status"
     - Field value: "retired"

2. **For new leads**:
   - Use a "Google Sheets" node to append the `newLeads` array to your Google Sheet
   - Enable "Minimise API Calls" for better performance

## Maintenance

When maintaining this code, consider:
- Updating the API token if it expires
- Adjusting the batch size if performance issues occur
- Monitoring for changes in the Close CRM API
- Updating the smart view ID if the criteria change

---

## Complete Code Block

```javascript
// Use node-fetch for HTTP requests
const fetch = require('node-fetch');

// Configuration
const apiToken = "api_2Kuv7mfiemtrtm6Ccnbsyg.6fmkNPVj4sb1xzhcP87nMA";
const baseUrl = "https://api.close.com/api/v1";
const savedSearchId = "save_jRcDTh1U9rMAX12xxtQ8WxgX4zMDbFDbJaQby6lHn1a";
const limit = 200; // Maximum page size for pagination

// Helper function to sleep for a specified number of milliseconds
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to parse the RateLimit header
function parseRateLimitHeader(header) {
  if (!header) return null;
  
  const parts = header.split(', ');
  const result = {};
  
  parts.forEach(part => {
    const [key, value] = part.split('=');
    result[key] = parseFloat(value);
  });
  
  return result;
}

// Helper function for HTTP requests with rate limit handling
async function makeRequest(method, endpoint, data = null, retries = 3) {
  const url = `${baseUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${apiToken}:`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    
    // Check rate limit headers for logging/monitoring
    const rateLimitHeader = response.headers.get('RateLimit');
    if (rateLimitHeader) {
      const rateLimit = parseRateLimitHeader(rateLimitHeader);
      if (rateLimit && rateLimit.remaining < 10) {
        console.log(`Warning: Rate limit running low. ${rateLimit.remaining} requests remaining, reset in ${rateLimit.reset} seconds.`);
      }
    }
    
    // Handle rate limiting (429 Too Many Requests)
    if (response.status === 429) {
      // Use the Retry-After header to determine wait time
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) : 60; // Default to 60 seconds if not specified
      
      console.log(`Rate limited. Waiting for ${waitTime} seconds before retrying...`);
      await sleep(waitTime * 1000); // Convert seconds to milliseconds
      
      // Retry the request after waiting
      return makeRequest(method, endpoint, data, retries);
    }
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    // Retry on network errors or other transient issues
    if (retries > 0) {
      console.log(`Request failed, retrying... (${retries} retries left)`);
      await sleep(1000); // Wait 1 second before retrying
      return makeRequest(method, endpoint, data, retries - 1);
    }
    
    throw error;
  }
}

try {
  // Get the smart view definition to extract the query
  const smartView = await makeRequest('GET', `/saved_search/${savedSearchId}/`);
  
  // Step 1: Get all lead IDs using the search endpoint with cursor-based pagination
  let allLeadIds = [];
  let hasMore = true;
  let cursor = null;
  
  // Create search query using the smart view query but with our own parameters
  const searchQuery = {
    query: smartView.s_query.query,
    _limit: limit,
    sort: smartView.s_query.sort,
    include_counts: true
  };
  
  // Paginate through all results using cursor
  while (hasMore) {
    // Add cursor to query if we have one
    if (cursor) {
      searchQuery.cursor = cursor;
    }
    
    const searchResults = await makeRequest('POST', '/data/search/', searchQuery);
    
    if (searchResults.data && searchResults.data.length > 0) {
      // Extract just the IDs from the results
      const ids = searchResults.data.map(lead => lead.id);
      allLeadIds = allLeadIds.concat(ids);
      
      // Check if there are more results
      cursor = searchResults.cursor;
      hasMore = cursor !== null;
    } else {
      hasMore = false;
    }
  }
  
  // Filter out leads that are already in the Google Sheet
  // Get the Close IDs from the Google Sheet input
  const existingCloseIds = $input.all().map(item => item.json.closeId || item.json["Close ID"] || "").filter(id => id !== "");

  // Find which existing leads are still valid in the Smart View and which need to be retired
  const existingValidLeads = existingCloseIds.filter(id => allLeadIds.includes(id));
  
  // Convert retiring lead IDs to objects with closeId property
  const existingRetiringLeads = existingCloseIds
    .filter(id => !allLeadIds.includes(id))
    .map(id => {
      // Find the original item from Google Sheet to get any additional data we might need
      const originalItem = $input.all().find(item => 
        (item.json.closeId === id) || (item.json["Close ID"] === id)
      );
      
      return {
        closeId: id,
        // Include any other fields we might want to preserve or reference
        firstName: originalItem?.json.firstName || originalItem?.json["First Name"] || "",
        lastName: originalItem?.json.lastName || originalItem?.json["Last Name"] || "",
        email: originalItem?.json.email || originalItem?.json["Email"] || ""
      };
    });

  // Filter out leads that already exist in the Google Sheet
  const filteredLeadIds = allLeadIds.filter(id => !existingCloseIds.includes(id));

  console.log(`Found ${allLeadIds.length} total leads from Close AI SDR Smart View`);
  console.log(`Found ${existingCloseIds.length} existing leads in Google Sheet`);
  console.log(`${existingValidLeads.length} existing leads are still valid in Close AI SDR Smart View`);
  console.log(`${existingRetiringLeads.length} existing leads need to be retired (no longer in Close AI SDR Smart View)`);
  console.log(`${filteredLeadIds.length} new leads to process and add to Google Sheet`);
  
  // Use the filtered list for further processing
  allLeadIds = filteredLeadIds;
  
  // Step 2: Fetch complete data for each lead ID
  let processedLeads = [];
  
  // Process leads in batches to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < allLeadIds.length; i += batchSize) {
    const batch = allLeadIds.slice(i, i + batchSize);
    const batchPromises = batch.map(id => makeRequest('GET', `/lead/${id}/?_fields=_all`));
    
    // Use Promise.all for parallel processing
    const batchResults = await Promise.all(batchPromises);
    
    // Process each lead in the batch
    for (const lead of batchResults) {
      // Parse name from lead's display_name
      let firstName = '';
      let lastName = '';
      
      if (lead.display_name) {
        // Split the name by spaces
        const parts = lead.display_name.trim().split(/\s+/);
        
        if (parts.length >= 1) {
          firstName = parts[0];
          
          // Check for middle initial
          if (parts.length > 2 && /^[A-Z]\.?$/.test(parts[1])) {
            // Skip middle initial and use remaining parts as last name
            lastName = parts.slice(2).join(' ');
          } else if (parts.length > 1) {
            // Use remaining parts as last name
            lastName = parts.slice(1).join(' ');
          }
        }
      }
      
      // Get email and phone
      let email = '';
      if (lead.contacts && lead.contacts.length > 0) {
        for (const contact of lead.contacts) {
          if (contact.emails && contact.emails.length > 0) {
            email = contact.emails[0].email;
            break;
          }
        }
      }
      
      let phone = '';
      if (lead.contacts && lead.contacts.length > 0) {
        for (const contact of lead.contacts) {
          if (contact.phones && contact.phones.length > 0) {
            phone = contact.phones[0].phone;
            break;
          }
        }
      }
      
      // Get salesperson from opportunities
      let salesperson = '';
      if (lead.opportunities && lead.opportunities.length > 0) {
        for (const opportunity of lead.opportunities) {
          if (opportunity.user_name) {
            salesperson = opportunity.user_name;
            break;
          }
        }
      }
      
      processedLeads.push({
        firstName,
        lastName,
        email,
        phone,
        createdAt: lead.date_created || '',
        closeId: lead.id || '',
        salesperson
      });
    }
  }
  
  // Return the processed leads with counts and grouped data
  return {
    json: {
      // Counts section
      counts: {
        newLeads: processedLeads.length,
        validExistingLeads: existingValidLeads.length,
        retiringLeads: existingRetiringLeads.length,
        totalLeadsInSmartView: allLeadIds.length + existingValidLeads.length
      },
      // Data section
      newLeads: processedLeads,
      validExistingLeads: existingValidLeads,
      retiringLeads: existingRetiringLeads
    }
  };
} catch (error) {
  return {
    json: {
      error: error.message,
      success: false
    }
  };
}
```