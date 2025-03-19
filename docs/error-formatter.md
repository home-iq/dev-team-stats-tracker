# Error Message Formatter for Slack Alerts

## Overview
This documentation describes the n8n Code node used to format workflow error messages for Slack notifications. The formatter extracts clean error messages from complex error structures and presents them in a Slack-friendly format.

## Code
```javascript
// Get the error data from the input
const errorData = $input.first().json;
const errorString = errorData.execution.error.message;

// Extract just the clean error message
let cleanErrorMessage = errorString;

try {
  // Split on " - " to get the JSON part
  const parts = errorString.split(" - ");
  
  if (parts.length > 1) {
    // Get the JSON part (second part after split)
    let jsonString = parts[1];
    
    // Remove the outer quotes if present
    if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
      jsonString = jsonString.substring(1, jsonString.length - 1);
    }
    
    // Replace all escaped quotes with regular quotes
    jsonString = jsonString.replace(/\\"/g, '"');
    
    // Parse the JSON string into an object
    const errorObject = JSON.parse(jsonString);
    
    // Extract the message
    if (errorObject.message && Array.isArray(errorObject.message) && errorObject.message.length > 0) {
      cleanErrorMessage = errorObject.message[0];
    } else if (errorObject.message) {
      cleanErrorMessage = errorObject.message;
    }
  }
} catch (e) {
  console.log('Error parsing:', e.message);
  // Fall back to original message
}

// Format the Slack message
const slackMessage = `🚨 *Workflow Error Alert*

*Workflow:* ${errorData.workflow.name}
*Execution ID:* ${errorData.execution.id}
*Node:* Make the Call
*Error Type:* ${errorData.execution.error.level} ${errorData.execution.error.name}

*Execution URL:* ${errorData.execution.url}

*Error Message:*
\`\`\`
${cleanErrorMessage}
\`\`\``;

// Return the formatted message
return {
  json: {
    message: slackMessage
  }
};
```

## Functionality

### 1. Error Message Extraction
The code extracts clean, human-readable error messages from complex error structures. It specifically handles:
- HTTP response errors (e.g., "400 - {\"message\":[\"error details\"]}")
- Escaped JSON strings
- Multiple error message formats (arrays and strings)

### 2. Message Formatting
The formatter creates a Slack-friendly message with:
- An emoji header (🚨) for visibility
- Bold section headers for important information
- Markdown code blocks for error messages
- Clear organization of error details

### 3. Error Handling
If the message parsing fails for any reason, the code gracefully falls back to the original error message.

## Usage in Workflow

### Prerequisites
- A trigger node for workflow errors
- Input data containing workflow execution details

### Setup Steps
1. Add a Code node to your error handling workflow
2. Copy the code above into the Code node
3. Connect the output to a Slack node

### Expected Input
The code expects input in this format:
```json
{
  "execution": {
    "id": "1545",
    "url": "https://your-n8n-instance/workflow/abc123/executions/1545",
    "error": {
      "level": "warning",
      "name": "NodeOperationError",
      "message": "400 - \"{\\\"message\\\":[\\\"customer.number must be a valid phone number in the E.164 format. Hot tip, you may be missing the country code (Eg. US: +1).\\\"],\\\"error\\\":\\\"Bad Request\\\",\\\"statusCode\\\":400}\""
    }
  },
  "workflow": {
    "id": "abc123",
    "name": "Your Workflow Name"
  }
}
```

### Output
The code outputs a JSON object with a single property `message` containing the formatted Slack message:
```json
{
  "message": "🚨 *Workflow Error Alert*\n\n*Workflow:* Your Workflow Name\n*Execution ID:* 1545\n*Node:* Make the Call\n*Error Type:* warning NodeOperationError\n\n*Execution URL:* https://your-n8n-instance/workflow/abc123/executions/1545\n\n*Error Message:*\n```\ncustomer.number must be a valid phone number in the E.164 format. Hot tip, you may be missing the country code (Eg. US: +1).\n```"
}
```

## Customization

### Modifying the Node Name
By default, the code uses "Make the Call" as the node name. Update this line to reference the actual node where the error occurred:
```javascript
*Node:* ${errorData.execution.error.nodeName || "Make the Call"}
```

### Adding Custom Fields
To add more fields to the Slack message, add them to the template literal:
```javascript
const slackMessage = `🚨 *Workflow Error Alert*

*Workflow:* ${errorData.workflow.name}
*Execution ID:* ${errorData.execution.id}
*Node:* Make the Call
*Error Type:* ${errorData.execution.error.level} ${errorData.execution.error.name}
*Custom Field:* ${errorData.customValue}

*Execution URL:* ${errorData.execution.url}

*Error Message:*
\`\`\`
${cleanErrorMessage}
\`\`\``;
```

## Maintenance Notes

### Testing and Validation
When updating this code:
1. Test with different error message formats
2. Verify the Slack formatting is preserved
3. Check that the error extraction logic handles edge cases

### Common Error Formats
This code is designed to handle these common error formats:
- HTTP status codes with JSON error bodies
- Plain text error messages
- Array-based error messages

If you encounter new error formats, update the extraction logic accordingly.

### Slack Message Formatting
For Slack message formatting, refer to the [Slack Formatting Guide](https://api.slack.com/reference/surfaces/formatting) to ensure proper rendering of the message. 