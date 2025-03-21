# Error Message Formatter for Slack Alerts

## Overview
This documentation describes the n8n Code node used to format workflow error messages for Slack notifications. The formatter extracts clean error messages from complex error structures and presents them in a Slack-friendly format.

## Code
```javascript
// Get the error data from the input
const errorData = $('Error Trigger').first().json;
const errorString = errorData.execution.error.message;
const closeID = $('Get Workflow').first().json.data.resultData.runData.Code[0].data.main[0][0].json['Close ID'];
const callLog = $('Get Workflow').first().json.data.resultData.runData.Code[0].data.main[0][0].json['Call Log'];

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

// Format the updated call log with error information
const updatedCallLog = `:: Error running workflow #${errorData.execution?.id || 'unknown'}
  :: Error: ${cleanErrorMessage || errorString || 'Unknown error'}
  :: Node: ${errorData.execution?.error?.node?.name ? errorData.execution?.error?.node?.name : "n/a"}
  :: Execution URL: ${errorData.execution?.url || 'n/a'}
${callLog ? '\n' + callLog : ''}`;

// Format the Slack message
const slackMessage = `🚨 *Workflow Error Alert*

*Workflow:* ${errorData.workflow?.name || null}
*Execution ID:* ${errorData.execution?.id || null}
*Node:* ${errorData.execution?.error?.node?.name ? errorData.execution?.error?.node?.name : "n/a"}
*Error Type:* ${errorData.execution?.error?.level ? errorData.execution?.error?.level : "n/a"} ${errorData.execution?.error?.description ? errorData.execution?.error?.description : "n/a"}

*Execution URL:* ${errorData.execution?.url || null}

*Error Message:*
\`\`\`
${cleanErrorMessage || null}
\`\`\``;

// Return the formatted message
return {
  json: {
    message: slackMessage,
    workflowName: errorData.workflow?.name || null,
    executionId: errorData.execution?.id || null,
    errorLevel: errorData.execution?.error?.level || null,
    errorDescription: errorData.execution?.error?.description || null,
    executionUrl: errorData.execution?.url || null,
    cleanErrorMessage: cleanErrorMessage || null,
    closeID: closeID || null,
    callLog: updatedCallLog
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
The code outputs a JSON object with the following properties:
- `message`: The formatted Slack message
- `workflowName`: The name of the workflow that encountered the error
- `executionId`: The execution ID of the failed workflow run
- `errorLevel`: The error level (e.g., "warning")
- `errorDescription`: The error description 
- `executionUrl`: The URL to the workflow execution
- `cleanErrorMessage`: The parsed, human-readable error message
- `closeID`: The Close CRM ID retrieved from the workflow execution data
- `callLog`: The updated call log with error information

This expanded output format allows downstream nodes to access individual components of the error data for custom processing, logging, or integration with other systems.

Example output:
```json
{
  "message": "🚨 *Workflow Error Alert*\n\n*Workflow:* Your Workflow Name\n*Execution ID:* 1545\n*Node:* HTTP Request\n*Error Type:* warning Error connecting to API\n\n*Execution URL:* https://your-n8n-instance/workflow/abc123/executions/1545\n\n*Error Message:*\n```\ncustomer.number must be a valid phone number in the E.164 format. Hot tip, you may be missing the country code (Eg. US: +1).\n```",
  "workflowName": "Your Workflow Name",
  "executionId": "1545",
  "errorLevel": "warning",
  "errorDescription": "Error connecting to API",
  "executionUrl": "https://your-n8n-instance/workflow/abc123/executions/1545",
  "cleanErrorMessage": "customer.number must be a valid phone number in the E.164 format. Hot tip, you may be missing the country code (Eg. US: +1).",
  "closeID": "lead_abc123456789",
  "callLog": ":: Error running workflow #1545
    :: Error: customer.number must be a valid phone number in the E.164 format. Hot tip, you may be missing the country code (Eg. US: +1).
    :: Node: HTTP Request
    :: Execution URL: https://your-n8n-instance/workflow/abc123/executions/1545"
}
```

## Customization

### Retrieving Additional Data
The code now retrieves the Close ID and call log from another node in the workflow using:
```javascript
const closeID = $('Get Workflow').first().json.data.resultData.runData.Code[0].data.main[0][0].json['Close ID'];
const callLog = $('Get Workflow').first().json.data.resultData.runData.Code[0].data.main[0][0].json['Call Log'];
```

You can follow this pattern to retrieve additional data from other nodes in your workflow:
1. Identify the node containing the data (e.g., 'Get Workflow')
2. Use the proper path to access the specific data you need
3. Store it in a variable for use in your output

### Modifying the Node Name
The code dynamically displays the name of the node where the error occurred, with a fallback to "n/a" if not available:
```javascript
*Node:* ${errorData.execution.error && errorData.execution.error.node && errorData.execution.error.node.name ? errorData.execution.error.node.name : "n/a"}
```

This ensures that the exact node causing the error is always shown in the Slack message or provides a clear indication when the information isn't available.

### Adding Custom Fields
To add more fields to the Slack message, add them to the template literal:
```javascript
const slackMessage = `🚨 *Workflow Error Alert*

*Workflow:* ${errorData.workflow.name}
*Execution ID:* ${errorData.execution.id}
*Node:* ${errorData.execution.error && errorData.execution.error.node && errorData.execution.error.node.name ? errorData.execution.error.node.name : "n/a"}
*Error Type:* ${errorData.execution.error && errorData.execution.error.level ? errorData.execution.error.level : "n/a"} ${errorData.execution.error && errorData.execution.error.description ? errorData.execution.error.description : "n/a"}

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

## Integration with Other Systems

### Using the Expanded Output
With the expanded output format, you can now easily integrate the error data with other systems beyond Slack:

#### CRM Integration
Use the `closeID` to update records in your CRM system:
```
[Error Formatter] → [HTTP Request to CRM API]
```

In the HTTP Request node, you can use the expression `{{$node["Error Formatter"].json.closeID}}` to access the Close ID.

#### Error Logging
Create comprehensive error logs by accessing specific error components:
```
[Error Formatter] → [Write to Error Log]
```

This allows you to structure your error logs with specific fields rather than just the formatted message.

#### Custom Notifications
Build different notification formats for different channels:
```
[Error Formatter] → [Email Node]
[Error Formatter] → [Slack Node]
[Error Formatter] → [MS Teams Node]
```

Each notification channel can access the specific error components they need, customizing the format for each platform.