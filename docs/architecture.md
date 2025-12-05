graph TB
    User[👤 User] -->|Submit Form| FormTrigger[n8n Form Trigger]
    FormTrigger -->|Image + Prompt + Language| FormatRequest[Function: Format Avatar Request]
    
    FormatRequest -->|API Payload| HeyGenAPI[HTTP: HeyGen /v2/realtime.start]
    HeyGenAPI -->|Session ID + Token| GenerateHTML[Function: Generate Landing Page]
    
    GenerateHTML -->|HTML Response| User
    User -->|Opens Page| Frontend[Frontend: index.html]
    
    Frontend -->|WebRTC Connect| LiveKit[LiveKit Server]
    LiveKit <-->|Audio/Video Stream| HeyGenAvatar[HeyGen Live Avatar]
    
    User -->|Speaks| Frontend
    Frontend -->|Audio Stream| HeyGenAvatar
    HeyGenAvatar -->|AI Response + TTS| Frontend
    
    HeyGenAvatar -->|Conversation End| Webhook[n8n Webhook: /avatar-transcript]
    Webhook -->|Full Transcript| CleanTranscript[Function: Clean & Format]
    
    CleanTranscript -->|Cleaned Text| LLM[LLM Node: Gemini/OpenRouter]
    LLM -->|Extracted: Name, Phone, Need| FormatSheet[Function: Format for Sheets]
    
    Webhook -->|Session Metadata| CalcUsage[Function: Calculate Usage & Cost]
    
    FormatSheet -->|Row Data| GoogleSheets[Google Sheets: Insert Row]
    CalcUsage -->|Usage Report| GoogleSheets
    
    GoogleSheets -->|Success| Notify[Optional: Slack/Email]
    
    style User fill:#e1f5ff
    style HeyGenAvatar fill:#ff9999
    style LLM fill:#99ff99
    style GoogleSheets fill:#ffff99
    style Frontend fill:#ffcc99