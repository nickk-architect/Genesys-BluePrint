# ============================================================
# Decagon Conversations API Reference
# Docs Index: https://docs.decagon.ai/llms.txt
# Base URL: https://api.decagon.ai
# Auth: Authorization: Bearer YOUR_API_KEY
# Rate Limit: 1 request/second across all endpoints
# ============================================================


# ------------------------------------------------------------
# CREATE AND MANAGE
# ------------------------------------------------------------

# POST /conversation/new
# Create a new conversation
curl -X POST 'https://api.decagon.ai/conversation/new' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "+19992220000",
    "flow_id": "YOUR_FLOW_ID"
  }'

# POST /conversation/new_by_api_key
# Create a new conversation using an API key (simpler auth)
curl -X POST 'https://api.decagon.ai/conversation/new_by_api_key' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "+19992220000",
    "flow_id": "YOUR_FLOW_ID",
    "metadata": {
      "CCaaS_Flow_Id": "abc123",
      "Misc_Data": "hello world"
    }
  }'

# POST /conversation/get_or_create
# Get an existing conversation or create a new one
curl -X POST 'https://api.decagon.ai/conversation/get_or_create' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "+19992220000",
    "flow_id": "YOUR_FLOW_ID"
  }'

# POST /conversation/close
# Close a conversation
curl -X POST 'https://api.decagon.ai/conversation/close' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID"
  }'

# POST /conversation/delete
# Delete a conversation
curl -X POST 'https://api.decagon.ai/conversation/delete' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID"
  }'

# POST /conversation/mark_escalated
# Mark a conversation as escalated
curl -X POST 'https://api.decagon.ai/conversation/mark_escalated' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID"
  }'


# ------------------------------------------------------------
# READ MESSAGES
# ------------------------------------------------------------

# GET /conversation/history
# Get conversation message history
curl -G 'https://api.decagon.ai/conversation/history' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode 'conversation_id=YOUR_CONVERSATION_ID'

# GET /conversation/user
# Get all conversations for a specific user
curl -G 'https://api.decagon.ai/conversation/user' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode 'user_id=+19992220000'

# GET /conversation/num_unread_messages
# Get unread message count for a conversation
curl -G 'https://api.decagon.ai/conversation/num_unread_messages' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode 'conversation_id=YOUR_CONVERSATION_ID'

# POST /conversation/add_feedback
# Add feedback to a conversation
curl -X POST 'https://api.decagon.ai/conversation/add_feedback' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID",
    "feedback": "positive"
  }'


# ------------------------------------------------------------
# TRANSCRIPTS AND EXPORTS
# ------------------------------------------------------------

# GET /conversation/export
# Export conversation data (up to 100 at a time, paginated via cursor)
# Optionally filter by metadata (e.g. ANI / Caller)
curl -G 'https://api.decagon.ai/conversation/export' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode 'user_filters={"metadata_filter": {"Caller": "+19992220000"}}'

# GET /conversation/transcript
# Get a conversation transcript
curl -G 'https://api.decagon.ai/conversation/transcript' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode 'conversation_id=YOUR_CONVERSATION_ID'

# POST /conversation/summarize
# Generate a conversation summary on demand
curl -X POST 'https://api.decagon.ai/conversation/summarize' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID"
  }'

# GET /conversation/download_transcript
# Download a transcript file
curl -G 'https://api.decagon.ai/conversation/download_transcript' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode 'conversation_id=YOUR_CONVERSATION_ID' \
  -o transcript.txt

# POST /conversation/email_transcript
# Email a transcript to a recipient
curl -X POST 'https://api.decagon.ai/conversation/email_transcript' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID",
    "email": "recipient@example.com"
  }'

# GET /conversation/recording_url
# Get a voice recording URL for a conversation
curl -G 'https://api.decagon.ai/conversation/recording_url' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode 'conversation_id=YOUR_CONVERSATION_ID'


# ------------------------------------------------------------
# METADATA
# ------------------------------------------------------------

# POST /conversation/link
# Link a conversation to a user
curl -X POST 'https://api.decagon.ai/conversation/link' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID",
    "user_id": "+19992220000"
  }'

# POST /conversation/update_metadata
# Update conversation metadata
curl -X POST 'https://api.decagon.ai/conversation/update_metadata' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID",
    "metadata": {
      "genesys_conversation_id": "27ecfb06-7b9d-4e7a-8d94-b3d037a67ce6",
      "Caller": "+19992220000"
    }
  }'

# POST /conversation/upload
# Upload messages to backfill historical conversation data
curl -X POST 'https://api.decagon.ai/conversation/upload' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "conversation_id": "YOUR_CONVERSATION_ID",
    "messages": [
      { "role": "user", "content": "Hello, I need help with my account." },
      { "role": "assistant", "content": "Sure, I can help with that." }
    ]
  }'

# POST /conversation/delete_user_data
# Delete all data for a specific user (GDPR / data purge)
curl -X POST 'https://api.decagon.ai/conversation/delete_user_data' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "+19992220000"
  }'
