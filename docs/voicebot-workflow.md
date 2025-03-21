# AI SDR Voice Agent - System Design & Settings

## Overview

This document provides a comprehensive explanation of our AI SDR Voice Agent. This automated system enables an AI voice agent (Emma) to handle scheduling of sales demos and meetings via phone calls, by checking availability windows, retrieving booking times, and managing the entire booking process.

While the current implementation focuses on outbound sales calls and appointment scheduling, this architecture provides a robust foundation for future AI-powered voice interactions. The system's modular design and integration capabilities create opportunities for:

- **Interactive Sales Demonstrations**: Real-time voice AI could guide prospects through product demos, responding to questions and showcasing features based on expressed interests
- **Customer Support Automation**: The same architecture could power inbound support calls with contextual knowledge of customer history
- **Application Voice Control**: This framework could enable voice-based interaction with software applications, allowing users to navigate and operate tools through natural conversation
- **Multi-channel Communication**: The voice interaction system could be extended to work across phone, web interfaces, and mobile applications while maintaining conversation context
- **Proactive Customer Engagement**: Beyond reactive scheduling, the system could evolve to identify opportunities for outreach based on customer behavior patterns

By establishing this voice agent infrastructure with its data integration, prompt management, and result tracking components, the organization is positioned to expand AI-powered voice capabilities as our technology and business needs evolve.

## Technology Components

The system integrates several key technologies that work together to enable automated voice interactions:

### n8n
- Orchestrates the entire workflow
- Manages the flow of data between different services
- Handles scheduling, webhooks, and error management

### Cloudflare
- Hosts our worker functions for the system
- Provides the serverless deployment environment
- Team members Alex and Gavin have been invited as users with access
- Functions are deployed directly from our GitHub repository
- Enables secure, scalable API endpoints for Calendly integration

### Voice API Integration
VAPI is one of several components in our technology stack that enables voice interaction capabilities:

- Handles the voice synthesis and transcription aspects
- Provides an API for initiating and managing calls
- Uses our Twilio phone number for outbound calling
- Orchestrates multiple AI technologies:
  - **LLM**: GPT-4o (chosen for lowest latency and best conversational abilities)
  - **Speech-to-Text**: Deepgram with Nova 2 model for accurate transcription
  - **Voice Synthesis**: Eleven Labs with Eleven Turbo v2.5 (Voice ID: TbMNBJ27fH2U0VgpSNko)
- Our development and production assistants:
  - [Emma - PROD](https://dashboard.vapi.ai/assistants/c10e09b1-92b6-4880-a33c-77c7c96f125f)
  - [Emma - DEV](https://dashboard.vapi.ai/assistants/cd9d20f9-5915-4b42-b9dd-27fe67160e53)

### Twilio
- Provides the phone number infrastructure for outbound calling
- Connects the AI voice agent to the telephone network
- Enables making calls to prospects' phone numbers

### Close CRM
- Primary source of lead data for the system
- Provides smart views to filter and select appropriate leads
- Syncs with Google Sheets through the "Voice Agent - Close Sync" workflow
- Stores the results of voice agent interactions
- Enables ongoing relationship management with prospects

### Google Sheets
- Serves as the system of record for all lead and call data
- Tracks call history, status, and outcomes
- Maintains a log of all interactions

### Calendly
- Provides scheduling infrastructure
- Exposes available time slots for booking
- Handles the actual appointment creation

### Slack
- Our Emma slackbot Delivers real-time notifications about call outcomes to our emma-sdr channel
- Alerts Jon directly to errors or issues requiring attention

## Main Workflows

The system operates in two separate environments with distinct resources:

### Production Environment
- **Workflow URL**: https://myhomeiq-n8n.smallmighty.co/workflow/y4W8KJqan1DikVt9
- **Google Sheet**: Uses the "Call Sheet PROD" tab in [this spreadsheet](https://docs.google.com/spreadsheets/d/14Oz0SdiwiPLbkBUmHU3AWRau-wLDyUZhwFBNxln8em0/edit?gid=0#gid=0)
- **Prompt Source**: Pulls conversation prompts from [this Google Doc](https://docs.google.com/document/d/1L1DfLgrw4Oi7iFFp4MgWwzKKo5EJyfNkb7NDhDoDNUU/edit?tab=t.7pbvh4cgqcxb#heading=h.s9al0b992gon)

### Development Environment
- **Workflow URL**: https://myhomeiq-n8n.smallmighty.co/workflow/6PoIIkfFQNg5t0xF
- **Google Sheet**: Uses the "Call Sheet DEV" tab in the same spreadsheet as production
- **Prompt Source**: Pulls conversation prompts from [this Google Doc](https://docs.google.com/document/d/1_p30S4o61R3l1-PwKUaelNfeQQzocY04Hhys4S-yIao/edit?tab=t.7pbvh4cgqcxb#heading=h.s9al0b992gon)

## Related Workflows

The system comprises multiple interconnected workflows:

### Voice Agent - Close Sync
- **Workflow URL**: https://myhomeiq-n8n.smallmighty.co/workflow/7mbjaCaEp8dHdPZI
- **Purpose**: Pulls unbooked leads from Close CRM every five minutes
- **Data Source**: [Close CRM Smart View](https://app.close.com/leads/save_jRcDTh1U9rMAX12xxtQ8WxgX4zMDbFDbJaQby6lHn1a/share_6NCfU6nmKPKT6IOCTOexxz/)
- **Process**: 
  - Reads existing leads from Google Sheets
  - Processes the data with Code1 node
  - Uses Split nodes to separate lead data
  - Adds new leads to the sheet 
  - Updates retiring leads status

### Voice Agent - Prompt Tester
- **Workflow URL**: https://myhomeiq-n8n.smallmighty.co/workflow/9TjKLFgUp09EbLc5
- **Web Interface**: https://myhomeiq.pages.dev/test-sdr
- **Purpose**: Allows testing of the voice agent prompts and interactions
- **Process**:
  - Accepts webhook inputs from the test interface
  - Sets test variables
  - Retrieves Calendly times
  - Fetches prompt templates from the development Google Doc
  - Prepares call variables
  - Makes a test call through the VAPI API

## Google Sheet Data Structure

The system uses a Google Sheet to track call data and lead status. The sheet contains the following key columns:

### Lead Information
- **Status**: Current status of the lead (e.g., "active" or "retired")
- **Booked**: Indicates if a booking was successful during the call. Empty means not booked.
- **Close ID**: Unique identifier from the Close CRM (e.g., "lead_NT4Ow1Li")
- **Role**: Contact's role (e.g., "loan officer")
- **First Name**: Contact's first name
- **Last Name**: Contact's last name
- **Email**: Contact's email address
- **Phone**: Contact's phone number
- **Salesperson**: Assigned salesperson (e.g., "Tawd Frensley")

### Call Data
- **Created At**: When the lead was created in the system
- **Last Called At**: Timestamp of the most recent call
- **Call Status**: Current status of the call (e.g., "Call Completed", "In Progress...")
- **Call Count**: Number of calls made to this lead
- **Call Log**: Detailed history of call interactions (partially visible in the rightmost column)

The sheet serves as both the source of lead data for making calls and the destination for call outcome tracking. The system creates a comprehensive call history in the Call Log column, including timestamps, durations, recording links, and booking details when successful.

## Lead Selection Logic

The system employs specific criteria to determine which leads should be called, prioritizing the most promising opportunities while avoiding excessive contact:

### Selection Criteria

1. **Most Recently Created First**: Leads are sorted by their creation date in descending order, ensuring that the newest (hottest) leads receive priority attention

2. **Call Frequency Limits**: The system ensures each lead receives no more than one call attempt within a 24-hour period

3. **Status Filtering**: Leads with the following characteristics are automatically excluded:
   - Leads not marked as "active" in the Status column
   - Leads marked as "Do Not Call"
   - Leads that have already been booked
   - Leads that have been called within the past 24 hours

4. **Retirement Process**: The Close Sync workflow automatically retires leads from the active calling pool when:
   - They no longer appear in the list of unbooked leads from Close CRM
   - This happens when leads are marked as booked in Close, disqualified, or otherwise removed from the Smart View

### Implementation Details

This logic is implemented through a multi-step process:

1. The **Close Sync** workflow pulls leads from Close CRM and updates the Google Sheet
2. The **Lead Processing Function** in the main workflow:
   - Sorts all leads by "Created At" date in descending order
   - Filters out leads based on the criteria above
   - Selects the most recently created eligible lead
   - Normalizes phone numbers and adds appropriate calendar URLs
3. The selected lead is then passed to the call execution phase

This approach ensures that the system always prioritizes the freshest leads while maintaining appropriate contact frequency and respecting lead status changes.

## Integrated System Overview

The complete lead processing and booking system involves multiple interconnected workflows that work together to create a seamless automated sales development process:

### Complete Data Flow

1. **Lead Acquisition (Voice Agent - Close Sync)**
   - Runs every 5 minutes to pull fresh leads from Close CRM
   - Filters leads based on criteria defined in the Close smart view
   - Writes new leads to the PROD Google Sheet tab
   - Updates status of existing leads as needed

2. **Call Scheduling (Voice Agent - Booking SDR Emma)**
   - Triggered by schedule or webhook
   - Checks if current time is within call window
   - Retrieves leads ready for calling from Google Sheet

3. **Call Execution**
   - Updates sheet to show call is in progress
   - Retrieves available Calendly times
   - Makes the call via VAPI with prepared prompt and available times
   - AI agent engages in conversation with the prospect
   - If successful, books an appointment via Calendly integration (bookCalendlyTime tool setup in VAPI & called by model)

4. **Call Tracking and Results**
   - Updates Google Sheet with call status, duration, and recording link
   - For successful bookings, extracts and formats appointment details
   - Sends notifications via Slack for call outcomes
   - May trigger additional error workflow if needed before proceeding to next lead. 

5. **Testing and Refinement (Voice Agent - Prompt Tester)**
   - Allows team members to test conversation flows without calling real leads
   - Uses development environment to simulate and refine the AI agent's responses
   - Helps optimize scripts and conversation paths

### System Architecture Benefits

- **Separation of Environments**: Production and development environments maintain isolation to protect live data
- **Real-time Monitoring**: Call statuses, results, and booking information are immediately visible in Google Sheets
- **Integrated Notifications**: Slack notifications alert the team to important events
- **Detailed Record Keeping**: All call history is preserved with timestamps, durations, and recordings
- **Automated Follow-up**: Successful bookings can trigger additional workflows for confirmation

This integrated system creates a complete loop from lead acquisition to successful booking, with each workflow handling a specific part of the process while sharing data through the central Google Sheet.

## Main Workflow Components and Flow

The workflow consists of several key stages that process a call from initiation to completion:

### 1. Initiation Triggers

#### Schedule Trigger
- Initiates the workflow at predetermined times
- Ensures calls are only made during appropriate business hours and on business days
- Utilizes the call window checker to verify if the current time is valid for outbound calls

#### Webhook
- Provides an alternative entry point that can be triggered via API
- Allows for manual initiation or integration with other systems

### 2. Initial Call Setup and Verification

#### Check Call Window
- Evaluates whether the current time is appropriate for making calls
- Implements logic to check:
  - Current time is within business hours (11 AM - 7 PM Eastern Time)
  - Current day is a weekday (Monday-Friday)
  - Current day is not a US federal holiday
  - Not a Friday before or Monday after a holiday weekend

#### Call? Decision Node
- Routes the workflow based on whether the call window check passes
- If outside the appropriate call window, the workflow stops 
- If within the call window, proceeds to the next stage

### 3. Lead Data Processing

#### Google Sheets (read sheet)
- Retrieves lead data from a Google Sheet
- Loads information such as contact names, phone numbers, and previous interaction history
- Provides data needed to personalize the conversation

#### Code (Pre-Call Processing)
- Formats and prepares lead data for use in the voice call
- May include validation of phone numbers and generation of personalized greeting templates

### 4. Scheduling Information

#### Set Working Status (update sheet)
- Updates the Google Sheet to indicate that a call is in progress
- Marks the lead as being actively worked on to prevent duplicate outreach

#### Get Calendly Times (GET: https://myhomelq.pages....)
- Retrieves available time slots from Calendly
- Uses the custom `get-calendly-times.ts` Cloudflare Worker (see [Cloudflare Workers](#cloudflare-workers) section)
- Returns formatted time slots that the voice agent can present to the prospect
- Includes ISO 8601 timestamps needed for the booking process

#### Retrieve Prompt (get: document)
- Fetches the conversation prompt/script for the voice agent
- Includes personalized elements and specific instructions for the AI
- Contains templates for how to present available times and handle objections

### 5. Voice Call Execution

#### Wait
- Pauses the workflow until external events (like webhook callbacks) occur
- Allows time for the call to be initiated and completed

#### Prep Call Vars
- Sets up variables needed for the call
- Formats parameters such as phone numbers, greeting templates, and available times

#### Make the Call (POST: https://api.vapi.ai/call)
- Initiates the actual voice call using the VAPI API
- Passes all necessary parameters including the phone number and conversation context

#### Code1
- Processes the initial call response
- Handles any immediate errors or special conditions

### 6. Call Tracking and Data Capture

#### Google Sheets1 (update: sheet)
- Updates the status of the call in progress
- Records initial call metadata

#### Get Call Status (GET)
- Polls the VAPI API to check on the current status of the call
- Determines if the call is still in progress, completed, or failed

#### If (Decision Node)
- Routes the workflow based on the call status
- Different paths for completed calls versus calls still in progress

### 7. Call Completion and Follow-up

#### Get Full Call Data
- Retrieves complete call information once the call is finished
- Includes call duration, recording URL, and conversation transcript

#### Code2
- Processes the complete call data
- Extracts key information such as whether a booking was made

#### Google Sheets2 (update: sheet)
- Final update to the tracking spreadsheet with complete call results
- Records outcomes including booking status, call duration, and links to recordings

#### Slack (post: message)
- Sends a notification to Slack with call results
- Alerts the team about successful bookings or calls requiring follow-up

#### Trigger Workflow (GET: https://myhomeiq-n8n.sm...)
- Optionally triggers another workflow based on the call outcome
- May initiate confirmation emails, calendar invites, or other follow-up processes

### 8. Error Handling

#### Error Trigger
- Captures any errors that occur during the workflow
- Ensures failures are properly documented

#### Get Workflow (get: execution)
- Retrieves details about the failed execution

#### Prep Message
- Formats error information for notification

#### Update Sheet Row (update: sheet)
- Records the error in the tracking spreadsheet

#### Slack1 (post: message)
- Alerts the team about workflow errors via Slack

## Key Technologies and Integrations

### VAPI (Voice API)
- Handles voice communication aspects of the system
- Processes natural language and manages conversations
- Provides API endpoints for call management
- Uses Twilio for outbound calling

### Twilio
- Provides the phone number infrastructure for outbound calling
- Connects the AI voice agent to the telephone network
- Enables making calls to prospects' phone numbers

### Calendly
- Provides scheduling infrastructure
- Exposes available time slots for booking
- Handles the actual appointment creation

### Cloudflare
- Hosts our worker functions for the system
- Provides the serverless deployment environment
- Team members Alex and Gavin have been invited as users with access
- Functions are deployed directly from our GitHub repository
- Enables secure, scalable API endpoints for Calendly integration

### Google Sheets
- Serves as the system of record for all lead and call data
- Tracks call history, status, and outcomes
- Maintains a log of all interactions

### n8n
- Orchestrates the entire workflow
- Manages the flow of data between different services
- Handles scheduling, webhooks, and error management

### Slack
- Delivers real-time notifications about call outcomes
- Alerts the team to errors or issues requiring attention

## Booking Process Details

When the AI voice agent (Emma) successfully books a meeting:

1. The call data is analyzed for booking information
2. Booking details (date, time, salesperson) are extracted
3. The Google Sheet is updated with booking status
4. A Slack notification is sent with the booking details
5. A confirmation may be triggered through additional workflows

### Custom bookCalendlyTime Tool

A key technology enabling the booking capability is the custom `bookCalendlyTime` tool:

- **Purpose**: Allows the voice assistant to book Calendly appointments in real-time during calls
- **Implementation**: Implemented as a Cloudflare Worker (see detailed information in the [Cloudflare Workers](#cloudflare-workers) section)
- **Integration with VAPI**: Registered as a custom tool with the VAPI assistant
- **Process Flow**:
  1. Assistant identifies customer's preferred time from conversation
  2. Tool is invoked with the necessary parameters
  3. Appointment is booked automatically via headless browser automation
  4. Booking confirmation is returned to the assistant
  5. Assistant communicates the successful booking to the customer

This integration creates a seamless booking experience without requiring the customer to visit a website or fill out forms themselves.

## Maintenance and Troubleshooting

### Common Issues
- Call window checks failing (check holiday calendar and time zone settings)
- VAPI API errors (verify API keys and rate limits)
- Calendly availability issues (check Calendly account status)

### Monitoring
- All workflow executions are stored in n8n
- The workflow logs all call activity to Google Sheets
- Error notifications are sent to Slack
- Call recordings and transcripts are available for quality review

### Key Technical Interactions:

1. **Lead Processing**:
   - n8n Close Sync workflow retrieves leads from Close CRM
   - Data is stored in Google Sheets for access by the calling workflow

2. **Call Orchestration**:
   - n8n SDR Emma workflow prepares call data and parameters
   - Cloudflare `get-calendly-times.ts` worker retrieves available time slots
   - Call script is pulled from Google Docs
   - VAPI initiates the call with appropriate context and scheduling information

3. **Conversation Management**:
   - VAPI handles real-time conversation using GPT-4o for intelligence
   - Deepgram Nova 2 transcribes the prospect's speech
   - Eleven Labs generates Emma's voice responses

4. **Booking Process**:
   - When a prospect agrees to a time, VAPI invokes the `bookCalendlyTime` tool
   - Cloudflare `book-calendly-time.ts` worker handles the Calendly booking
   - Booking confirmation is returned to VAPI to relay to the prospect
   - n8n workflow updates Google Sheets and sends Slack notifications



## Conclusion

The "Voice Agent - Booking SDR Emma" workflow automates the entire process of scheduling sales demos via phone calls. By combining multiple technologies including n8n workflows, Google Workspace, Calendly, Close CRM, and voice API capabilities, it enables efficient lead processing while maintaining detailed records of all interactions.

This integrated system represents an innovative approach to customer engagement—one where automation and AI assist in streamlining sales processes while maintaining personalized interactions. As the component technologies and integration workflows continue to evolve, the possibilities for sophisticated business applications will expand dramatically across multiple channels and use cases.

## API Reference and Services

The system integrates several essential services that each play important roles in the overall workflow:

### VAPI (Voice API)
- **Purpose**: Provides voice communication capabilities
- **Environments**:
  - **Production Assistant**: [Emma - PROD](https://dashboard.vapi.ai/assistants/c10e09b1-92b6-4880-a33c-77c7c96f125f)
  - **Development Assistant**: [Emma - DEV](https://dashboard.vapi.ai/assistants/cd9d20f9-5915-4b42-b9dd-27fe67160e53)
- **Technology Stack**:
  - **Large Language Model**: GPT-4o for conversation intelligence
  - **Speech Recognition**: Deepgram Nova 2 model
  - **Voice Synthesis**: Eleven Labs Eleven Turbo v2.5 with voice ID TbMNBJ27fH2U0VgpSNko
  - **Telephony**: Twilio for outbound calling using our dedicated phone number
- **Custom Tools**:
  - `bookCalendlyTime`: Custom tool that enables the voice assistant to book appointments directly during the call
- **Endpoints Used**:
  - `POST: https://api.vapi.ai/call` - Initiates a voice call
  - `GET: [call status endpoint]` - Retrieves call status

### Twilio
- **Purpose**: Telephony service provider
- **Integration**: Integrated with VAPI to enable outbound calling
- **Features**:
  - Provides dedicated phone number for the voice agent
  - Handles telephone network connectivity
  - Enables caller ID presentation to prospects

### n8n Workflow Engine
- **Purpose**: Central workflow orchestration platform
- **Key Functions**:
  - Connects all system components
  - Manages timing and scheduling logic
  - Processes data between services
  - Handles error conditions and retries
- **Environments**:
  - Production workflows described in the Environment Setup section
  - Development workflows for testing

### Calendly
- **Purpose**: Appointment scheduling platform
- **Integration Points**:
  - Web page for available time slots
  - Booking functionality via tool calls
- **Configuration**: 
  - Uses timezone-aware timestamps
  - Formatted times for natural conversation

### Close CRM
- **Purpose**: Lead management system
- **Integration**: 
  - Smart view provides filtered leads
  - Webhook integration for status updates
- **Identifier**: Unique Close IDs track leads across systems

### Google Workspace
- **Google Sheets**: Data storage and tracking
- **Google Docs**: Dynamic prompt management
- **Integration**: Read/write operations via n8n

## Cloudflare Workers

The system leverages two custom Cloudflare Workers that handle critical functionality for Calendly integration:

### get-calendly-times.ts

This worker provides an API endpoint for retrieving available Calendly time slots:

- **Purpose**: Provides a consistent interface for fetching available Calendly appointment times
- **Endpoint**: Used in both the main workflow and prompt tester
- **Implementation Details**:
  - Retrieves available times for a specified Calendly event type
  - Uses the Calendly API with proper authentication
  - Calculates a date range from 15 minutes in the future to 7 days later
  - Returns a formatted list of available time slots with their ISO timestamps
  - Sorts times chronologically for easy presentation by the voice agent
- **Parameters**:
  - `url`: The Calendly event type ID to fetch times for
  - `Authorization`: Bearer token for Calendly API authentication
- **Response Format**:
  - Provides both comma-delimited string of start times
  - Includes detailed time objects with full Calendly data

### book-calendly-time.ts

This worker implements the custom tool used by the VAPI assistant to book appointments:

- **Purpose**: Enables the voice assistant to programmatically book Calendly appointments
- **Implementation**: Sophisticated Cloudflare Worker that uses Browserless to automate form submission
- **Key Features**:
  - Authentication via `x-vapi-secret` header
  - Headless browser automation with Browserless
  - Form-filling logic for different Calendly form formats
  - Error detection for unavailable time slots
  - Detailed debug information for troubleshooting
- **Parameter Details**:
  - `start_time`: ISO 8601 timestamp from Calendly availability
  - `first_name`: Customer's first name
  - `last_name`: Customer's last name
  - `email`: Customer's email address
  - `calendar_web_url`: Base Calendly URL for the meeting type
  - `phone`: Customer's phone number
- **Technical Implementation**:
  - Uses a headless browser to navigate to Calendly appointment page
  - Intelligently handles form fields (full name or first/last name fields)
  - Properly fills phone fields with appropriate delays
  - Clicks "Schedule Event" button and verifies successful booking
  - Returns detailed result with booking status and confirmation URL

These Cloudflare Workers provide crucial middleware that connects the VAPI assistant's capabilities with the Calendly scheduling system, enabling a fully automated booking experience without requiring direct user interaction with Calendly's web interface.

## Configuration Details

### n8n Credentials
The workflows require the following credential configurations in n8n:
- Google Sheets access
- Google Docs access
- VAPI API credentials
- Close CRM API access
- Slack webhook URL

### Call Window Configuration
The call window checker uses the following parameters:
- Business hours: 11 AM - 7 PM Eastern Time
- Business days: Monday-Friday
- Exclusions: US federal holidays and observed holidays

### Webhook Integration
- The webhook endpoints in the workflows can be triggered via HTTP POST requests
- For testing purposes, the Prompt Tester webhook can be accessed via the test interface
- Production webhooks should only be called by authorized systems

## Document Maintenance

This documentation should be updated when:
1. New integrations are added to the workflow
2. Call scripts or prompts are significantly modified
3. Data structure in the Google Sheet changes
4. New workflows are added to the system
5. API endpoints or credentials are updated
6. VAPI assistant configurations are modified

> Code management and documentation repository: https://github.com/home-iq/dev-team-stats-tracker

Last updated: March 20, 2025 

## Infrastructure and Hosting

The system is hosted on dedicated infrastructure to ensure performance and reliability:

### Server Environment

- **Provider**: Hetzner Cloud
- **Management**: Deployed and managed via Coolify
- **IP Addressing**: See [Security Section](#credentials) for server access details
- **Location**: Hetzner data center

### Service Hosting

The server hosts several critical components of the system:

- **n8n Instance**: 
  - Authentication credentials available in the [Security Section](#credentials)
  - Runs all the workflow automation
  - Configuration persistence via internal database

- **Browserless Service**:
  - Provides headless browser capabilities for Calendly interactions
  - Used by the book-calendly-time.ts Cloudflare Worker
  - Enables automated form filling and appointment booking
  - Access token available in the [Security Section](#credentials)

### API Integration Security

The system uses secure API integration methods for all services:

- **Close CRM**: Credentials available in the [Security Section](#credentials)
- **Calendly**: API token available in the [Security Section](#credentials)
- **VAPI**: Secret key available in the [Security Section](#credentials)
- **Cloudflare Workers**: Environment variables stored in Cloudflare dashboard for each worker

## CREDENTIALS

**IMPORTANT**: This section contains sensitive information that can be accessed securely here: https://docs.google.com/document/d/1kmBrVdI3BEglhO79IHj9lvi8TtCBswrmYEgDb1Ff8kI/edit?tab=t.cyj23j21idqk#heading=h.2l0rddie5g73


### Infrastructure Maintenance

Regular maintenance should include:

- Rotating API credentials on a scheduled basis
- Server updates and security patches
- Backup of n8n workflows and configurations
- Monitoring of service performance and availability

This infrastructure setup provides a secure and reliable foundation for the voice agent system while maintaining separation between development and production environments.