# Exporting Conversations via API
# Docs: https://docs.decagon.ai/external/api-reference/exporting-conversations-via-api
#
# Use the `user_filters` parameter with a `metadata_filter` object to filter
# exported conversations by metadata values (e.g., "Caller"). The filter is passed
# as stringified JSON.

curl -G 'https://api.decagon.ai/conversation/export' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode 'user_filters={"metadata_filter": {"Caller": "+19992220000"}}'


# Creating a Conversation
# Docs: https://docs.decagon.ai/internal/api-data/chat-api-endpoints
#
# Use POST /conversation/new_by_api_key to create a new conversation with simple
# API key auth. Pass a flow_id and optional metadata (e.g., caller info, customer type).
# Note: user_id is the ANI (caller's phone number). Decagon uses the user_id to
# match conversations to a caller — when an incoming call's ANI matches an existing
# user_id, Decagon associates the new conversation with that caller's history.

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


# Summarizing a Conversation
#
# Use GET /conversation/summarize to retrieve an AI-generated summary of a completed
# conversation. Pass the conversation_id as a query parameter.
#
# Typical usage: after a call ends, pass the conversation_id returned from
# /conversation/new_by_api_key (or obtained via /conversation/export) to get
# a summary of what was discussed.

CONVERSATION_ID="YOUR_CONVERSATION_ID"

curl -G "https://api.decagon.ai/conversation/summarize" \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  --data-urlencode "conversation_id=${CONVERSATION_ID}"
