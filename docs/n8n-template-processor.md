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
let phone = $('Webhook').item.json.body.phone || "";

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

// Define the variable values using actual values from n8n nodes
const variableValues = {
  "first_name": $('Webhook').item.json.body.first_name,
  "last_name": $('Webhook').item.json.body.last_name,
  "email": $('Webhook').item.json.body.email,
  "phone": phone,
  "available_times": $('HTTP Request').item.json.data.startTimes,
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
- Webhook data (first_name, last_name, email, phone)
- HTTP Request data (available_times)
- Current UTC time

## Input Requirements
- `$input.first().json.content`: The template content with variables in `{{variable_name}}` format
- `$('Webhook').item.json.body`: Contains user data (first_name, last_name, email, phone)
- `$('HTTP Request').item.json.data.startTimes`: Available appointment times

## Output
The node outputs a JSON object containing:
- `processedContent`: The main content with variables replaced
- `processedContentJSON`: JSON-stringified version of the processed content
- `greeting`: The extracted greeting with variables replaced
- `greetingJSON`: JSON-stringified version of the greeting
- `formattedPhone`: The formatted phone number
- `remainingVariables`: Any template variables that weren't replaced
- `allVariablesReplaced`: Boolean indicating if all variables were replaced

## Usage in Workflow
This code node is designed to work in a workflow that:
1. Receives form submissions from the Test SDR form
2. Processes the template content for an AI assistant
3. Sends the processed content to an AI service via HTTP request

## Example
### Input Content
```
Greeting: Hey there {{first_name}}, this is Emma from myhomeIQ!

You are Emma, an AI-powered Sales Development Representative (SDR) for myhomeIQ.
The lead's first name is: {{first_name}}
The lead's last name is: {{last_name}}
The lead's email is: {{email}}
Currently the time in UTC is {{now}}.
```

### Output
```json
{
  "processedContent": "You are Emma, an AI-powered Sales Development Representative (SDR) for myhomeIQ.\nThe lead's first name is: John\nThe lead's last name is: Doe\nThe lead's email is: john.doe@example.com\nCurrently the time in UTC is 2023-06-15T14:30:45.123Z.",
  "processedContentJSON": "\"You are Emma, an AI-powered Sales Development Representative (SDR) for myhomeIQ.\\nThe lead's first name is: John\\nThe lead's last name is: Doe\\nThe lead's email is: john.doe@example.com\\nCurrently the time in UTC is 2023-06-15T14:30:45.123Z.\"",
  "greeting": "Hey there John, this is Emma from myhomeIQ!",
  "greetingJSON": "\"Hey there John, this is Emma from myhomeIQ!\"",
  "formattedPhone": "+19167927365",
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
    "name": "{{$('Webhook').item.json.body.first_name}}"
  },
  "phoneNumberId": "9a43e40d-65f4-482e-8196-a1a3812f0004"
}
```

## Maintenance Notes
- The code handles missing values gracefully but doesn't validate the format of emails or other fields
- Additional template variables can be added to the `variableValues` object as needed
- The phone formatting logic assumes US/Canada numbers (+1 country code) 