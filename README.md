# Resonance Voice Agent

## Overview

Resonance Voice Agent is an AI-powered mental health companion that provides natural, conversational support through voice interactions. The system combines artificial intelligence with evidence-based physical interventions and frequency therapy to help users navigate difficult emotional states.

## Features

### Core Functionality
- **Voice-Based Conversations**: Natural speech-to-text and text-to-speech interactions using OpenAI's Whisper and TTS models
- **AI Companion**: Powered by Anthropic Claude for empathetic, conversational responses
- **Real-Time Processing**: WebSocket-based communication for immediate responses
- **Session Tracking**: Automatic logging of user patterns, effective interventions, and session outcomes

### Physical Interventions
The system detects when conversation alone isn't sufficient and suggests appropriate physical interventions:
- **Cold Water Therapy**: For hyperactivation and panic states
- **Movement Exercises**: Shaking hands or jumping jacks for stuck/frozen feelings
- **Vagal Stimulation**: Humming exercises for numbness and disconnection
- **Grounding Techniques**: Lying down and feeling the floor for overwhelm

### Frequency Therapy
Integrated sound therapy with specific frequencies for different emotional states:
- **432 Hz**: For anxiety and racing thoughts
- **396 Hz**: For fear and grounding
- **528 Hz**: For numbness and gentle awakening
- **417 Hz**: For stuck feelings and shifting energy
- **639 Hz**: For anger and frustration

### Visual Interface
- **Dynamic Particle System**: Animated background that responds to emotional state
- **Breathing Visualization**: Guided breathing patterns with visual cues
- **State-Based Color Coding**: Interface colors change based on detected emotional state
- **Intervention Timers**: Visual countdowns for physical intervention guidance

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Web Framework**: Express.js
- **Real-Time Communication**: WebSocket (ws library)
- **AI Services**:
  - Anthropic Claude (claude-sonnet-4-20250514) for conversational AI
  - OpenAI Whisper for speech-to-text transcription
  - OpenAI TTS-1 with Nova voice for text-to-speech
- **Data Storage**: JSON file-based session storage
- **Audio Processing**: WebM audio format handling

### Frontend
- **Framework**: React 19
- **Styling**: Tailwind CSS with PostCSS
- **Icons**: Lucide React
- **Audio**: Web Audio API for real-time audio processing and frequency generation
- **Visualization**: HTML5 Canvas for particle animations and breathing guides

### Development Tools
- **Build Tool**: Create React App
- **Package Manager**: npm
- **Environment Management**: dotenv
- **Development Server**: Concurrent backend and frontend servers

## Prerequisites

Before running the Resonance Voice Agent, ensure you have the following installed:

- **Node.js**: Version 16.0.0 or higher
- **npm**: Version 7.0.0 or higher (comes with Node.js)
- **Git**: For version control

### API Keys Required
You will need API keys from the following services:
- **Anthropic**: For Claude AI conversational model
- **OpenAI**: For Whisper speech-to-text and TTS text-to-speech services

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/alexiszxcv/resonance-voice.git
cd resonance-voice-agent
```

### 2. Install Dependencies

#### Backend Dependencies
```bash
cd backend
npm install
```

#### Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 3. Environment Configuration

#### Backend Environment Setup
1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit the `.env` file and add your API keys:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
```

**Security Note**: Never commit the `.env` file to version control. It is already included in `.gitignore`.

#### API Key Acquisition
- **Anthropic API Key**: Sign up at [console.anthropic.com](https://console.anthropic.com) and generate an API key
- **OpenAI API Key**: Sign up at [platform.openai.com](https://platform.openai.com) and create an API key

## Usage

### Starting the Application

#### Development Mode
1. **Start the Backend Server**:
```bash
cd backend
npm run dev
```
This starts the server with nodemon for automatic restarts on file changes.

2. **Start the Frontend Application** (in a new terminal):
```bash
cd frontend
npm start
```

The application will be available at `http://localhost:3000` with the backend running on port 3001.

#### Production Mode
1. **Build the Frontend**:
```bash
cd frontend
npm run build
```

2. **Start the Backend**:
```bash
cd backend
npm start
```

### Using the Voice Agent

1. **Initial Connection**: The application automatically connects to the backend WebSocket server
2. **Voice Interaction**: Click the microphone button to start recording
3. **Real-Time Transcription**: Your speech is transcribed and displayed in real-time
4. **AI Response**: The system responds with voice and text
5. **Interventions**: When appropriate, the system suggests physical interventions or frequency therapy
6. **Session Management**: Sessions are automatically tracked and stored

### Interface Elements

- **Microphone Button**: Toggle voice recording on/off
- **Connection Status**: Shows WebSocket connection state
- **Conversation History**: Scrollable list of previous exchanges
- **Particle Background**: Animated visualization responding to emotional state
- **Breathing Guide**: Visual breathing pattern indicator
- **Intervention Panel**: Appears when physical interventions are suggested
- **Frequency Controls**: Manual frequency therapy activation

## Project Structure

```
resonance-voice-agent/
├── backend/
│   ├── server.js                 # Main Express/WebSocket server
│   ├── package.json              # Backend dependencies and scripts
│   ├── package-lock.json         # Backend dependency lock file
│   ├── .env.example              # Environment variables template
│   └── session_data.json         # User session data storage
├── frontend/
│   ├── public/
│   │   ├── index.html            # Main HTML template
│   │   ├── manifest.json         # PWA manifest
│   │   └── robots.txt            # Search engine crawling rules
│   └── src/
│       ├── VoiceAgent.js         # Main React component
│       ├── App.js                # Root React component
│       ├── App.css               # Application styles
│       ├── index.js              # React application entry point
│       └── index.css             # Global styles
├── package.json                  # Root package configuration
├── postcss.config.js             # PostCSS configuration
├── tailwind.config.js            # Tailwind CSS configuration
└── .gitignore                    # Git ignore rules
```

## API Documentation

### WebSocket Messages

#### Client to Server
- **Audio Data**: `{ type: 'audio', audio: base64EncodedAudio }`
- **Intervention Complete**: `{ type: 'intervention_complete' }`
- **Sound Choice**: `{ type: 'sound_choice', enabled: boolean }`
- **Session Complete**: `{ type: 'session_complete', state: string, frequency: number, duration: number, outcome: string }`
- **Save Note**: `{ type: 'save_note', text: string, state: string }`

#### Server to Client
- **Transcript**: `{ type: 'transcript', text: string }`
- **Response**: `{ type: 'response', text: string }`
- **Audio**: `{ type: 'audio', audio: base64EncodedAudio }`
- **Physical Intervention**: `{ type: 'physical_intervention', intervention: string, instructions: string }`
- **Frequency Offer**: `{ type: 'frequency_offer', frequency: number, description: string }`
- **Error**: `{ type: 'error', message: string }`

### REST Endpoints

The backend provides the following REST endpoints:

- `GET /` - Health check endpoint
- `POST /` - Reserved for future API expansion

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ANTHROPIC_API_KEY` | API key for Anthropic Claude | Yes | - |
| `OPENAI_API_KEY` | API key for OpenAI services | Yes | - |
| `PORT` | Server port number | No | 3001 |

### Tailwind Configuration

The project uses Tailwind CSS with custom configuration in `tailwind.config.js` for:
- Custom color palette for emotional states
- Extended spacing and animation utilities
- Custom component classes for the voice interface

### Audio Settings

- **Recording Format**: WebM audio
- **Sample Rate**: Browser default (typically 44.1kHz or 48kHz)
- **TTS Voice**: OpenAI Nova voice
- **Frequency Generation**: Web Audio API oscillators

## Data Storage

### Session Data Structure

User session data is stored in `backend/session_data.json`:

```json
{
  "user_id": {
    "sessions": [
      {
        "timestamp": "ISO_DATE_STRING",
        "state": "emotional_state",
        "frequency": 432,
        "duration": 900,
        "outcome": "helpful",
        "interventionsUsed": ["cold_water", "movement"]
      }
    ],
    "patterns": {
      "anxious": 5,
      "numb": 3
    },
    "effectiveInterventions": {
      "cold_water": 4,
      "movement": 2
    },
    "voiceNotes": [
      {
        "timestamp": "ISO_DATE_STRING",
        "text": "user_note",
        "state": "emotional_state"
      }
    ],
    "totalSessions": 8
  }
}
```

## Development

### Running Tests

```bash
cd frontend
npm test
```

### Building for Production

```bash
cd frontend
npm run build
```

### Code Style

The project follows standard React and Node.js conventions:
- ESLint configuration for code quality
- Prettier for code formatting (via Create React App)
- Standard JavaScript naming conventions

## Troubleshooting

### Common Issues

#### WebSocket Connection Failed
- Ensure the backend server is running on port 3001
- Check that firewall settings allow WebSocket connections
- Verify the frontend is connecting to the correct WebSocket URL

#### Audio Recording Not Working
- Grant microphone permissions in the browser
- Ensure HTTPS in production (required for microphone access)
- Check browser compatibility (Chrome, Firefox, Safari, Edge)

#### API Key Errors
- Verify API keys are correctly set in `.env` file
- Check API key validity and account limits
- Ensure proper environment variable loading

#### Audio Playback Issues
- Check system audio settings
- Verify Web Audio API support in browser
- Ensure no other applications are using audio devices
