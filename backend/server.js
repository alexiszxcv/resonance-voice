const express = require('express');
const WebSocket = require('ws');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const performanceMonitor = require('./performance-monitor');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/health', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Feedback endpoint
app.post('/feedback', limiter, (req, res) => {
  try {
    const { rating, feedback, userId } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const feedbackEntry = {
      timestamp: new Date().toISOString(),
      userId: userId || 'anonymous',
      rating: rating,
      feedback: feedback || '',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    // Save feedback to file
    const feedbackPath = path.join(__dirname, 'feedback.json');
    let feedbackData = [];

    try {
      if (fs.existsSync(feedbackPath)) {
        feedbackData = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading feedback file:', error);
    }

    feedbackData.push(feedbackEntry);

    // Keep only last 1000 feedback entries
    if (feedbackData.length > 1000) {
      feedbackData = feedbackData.slice(-1000);
    }

    fs.writeFileSync(feedbackPath, JSON.stringify(feedbackData, null, 2));

    res.status(200).json({ message: 'Feedback received successfully' });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Performance metrics endpoint
app.get('/metrics', limiter, (req, res) => {
  try {
    const stats = performanceMonitor.getStats();
    res.status(200).json({
      status: 'ok',
      stats: stats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const server = app.listen(process.env.PORT || 3001, () => {
  console.log(`Server running on port ${process.env.PORT || 3001}`);
});

const wss = new WebSocket.Server({ server });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Session storage
const STORAGE_PATH = path.join(__dirname, 'session_data.json');
let sessionData = {};

try {
  if (fs.existsSync(STORAGE_PATH)) {
    sessionData = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
  }
} catch (error) {
  console.error('Error loading session data:', error);
}

function saveSessionData() {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(sessionData, null, 2));
  } catch (error) {
    console.error('Error saving session data:', error);
  }
}

const conversations = new Map();
const sessionStates = new Map();

const FREQUENCY_MAP = {
  anxiety: { hz: 432, description: "slows racing thoughts", keywords: ['anxious', 'panic', 'overwhelm', 'racing'] },
  fear: { hz: 396, description: "grounds fear", keywords: ['scared', 'afraid', 'fear'] },
  numb: { hz: 528, description: "gently wakes things up", keywords: ['numb', 'empty', 'nothing', 'disconnected'] },
  stuck: { hz: 417, description: "helps shift stuck feelings", keywords: ['stuck', 'trapped', 'frozen'] },
  anger: { hz: 639, description: "settles frustration", keywords: ['angry', 'frustrated', 'irritated'] }
};

const SYSTEM_PROMPT = `You are Resonance. You're a companion for people going through hard moments.

How you are:
- Short responses. Usually 1-2 sentences. Sometimes just one.
- Conversational. Like texting a friend who gets it.
- You don't diagnose or explain their nervous system to them.
- You don't use therapy language unless they do.
- You ask more than you tell.

When someone's struggling:
- Acknowledge: "That sounds hard" or "I hear you"
- Reflect: "Sounds like a lot of uncertainty"
- Simple body check: "Where do you feel that?"
- Not: lectures about chronic activation patterns

Physical interventions (use when talk isn't working):
- Assess their physical state first: "How's your body? Heart racing? Dizzy?"
- Based on their answer, suggest appropriate action:
  * Hyperactivated/panic: "Want to try cold water on your wrists? Sometimes helps."
  * Frozen/stuck: "Want to shake it out? Just shake your hands hard for 20 seconds."
  * Numb/disconnected: "Hum with me? Low and long."
  * Overwhelmed: "Lie down if you can. Feel the floor."
- Keep it simple. Don't explain WHY.
- If they seem unsafe (dizzy, faint), suggest grounding not movement.
- Guide them: "I'll count. Ready? 1... 2... 3..."

When they're circling:
- "We're going over the same ground. Want to try something different?"
- Not: explanations about repetitive thinking patterns

Sound:
- "Want some 432Hz? Might help slow things down."
- Not: technical explanations

Be present. Be brief. Be real.`;

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  const connectionId = Date.now().toString();
  const userId = 'user_' + Math.random().toString(36).substring(7);
  
  conversations.set(connectionId, []);
  sessionStates.set(connectionId, {
    startTime: Date.now(),
    messageCount: 0,
    userWordCount: 0,
    lastUserMessage: '',
    soundEnabled: null,
    interventionCount: 0,
    physicalInterventionsUsed: []
  });
  
  if (!sessionData[userId]) {
    sessionData[userId] = {
      sessions: [],
      patterns: {},
      effectiveInterventions: {},
      voiceNotes: [],
      totalSessions: 0
    };
  }

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      const sessionState = sessionStates.get(connectionId);

      if (data.type === 'audio') {
        const startTime = Date.now();
        const audioBuffer = Buffer.from(data.audio, 'base64');
        
        console.log('Transcribing...');
        const transcriptionStart = Date.now();
        const transcription = await transcribeAudio(audioBuffer);
        const transcriptionTime = Date.now() - transcriptionStart;
        console.log('User:', transcription);

        ws.send(JSON.stringify({
          type: 'transcript',
          text: transcription
        }));

        const history = conversations.get(connectionId);
        const userData = sessionData[userId];

        // Track session metrics
        sessionState.messageCount += 1;
        const wordCount = transcription.split(' ').length;
        sessionState.userWordCount += wordCount;
        const sessionDuration = (Date.now() - sessionState.startTime) / 1000;

        // Build context
        let context = '';
        if (userData.totalSessions > 0) {
          const recentPatterns = Object.entries(userData.patterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([state, count]) => `${state} (${count}x)`);
          
          context = `\n\nPatterns: ${recentPatterns.join(', ')}.`;
          
          if (userData.voiceNotes.length > 0) {
            const recent = userData.voiceNotes[userData.voiceNotes.length - 1];
            context += ` They once said: "${recent.text}"`;
          }
        }

        // Speech pattern analysis
        const isLongMessage = wordCount > 100;
        const isRepetitive = detectRepetition(transcription, sessionState.lastUserMessage);
        
        // Add helpful context for Claude
        if (isLongMessage && sessionState.interventionCount === 0) {
          context += `\n\nThey're talking a lot. Might need physical intervention more than conversation.`;
          sessionState.interventionCount += 1;
        }
        
        if (isRepetitive && sessionState.interventionCount < 2) {
          context += `\n\nThey're circling the same thing. Consider suggesting something physical.`;
          sessionState.interventionCount += 1;
        }

        // Only suggest wrapping if session is very long and stuck
        if (sessionDuration > 900 && sessionState.interventionCount < 2) {
          context += `\n\nLong session. If they seem stuck, you can check if they want to wrap up.`;
        }

        sessionState.lastUserMessage = transcription;

        console.log('Claude thinking...');
        const aiStart = Date.now();
        const response = await getClaudeResponse(transcription, history, context);
        const aiTime = Date.now() - aiStart;
        console.log('Claude:', response);

        history.push(
          { role: 'user', content: transcription },
          { role: 'assistant', content: response }
        );

        ws.send(JSON.stringify({
          type: 'response',
          text: response
        }));

        // Detect physical intervention
        const interventionType = detectInterventionType(response);
        if (interventionType) {
          sessionState.physicalInterventionsUsed.push(interventionType);
          
          ws.send(JSON.stringify({
            type: 'physical_intervention',
            intervention: interventionType,
            instructions: response
          }));
        }

        // Detect frequency offer
        const frequencyOffer = detectFrequencyInResponse(response);
        if (frequencyOffer) {
          ws.send(JSON.stringify({
            type: 'frequency_offer',
            frequency: frequencyOffer.hz,
            description: frequencyOffer.description
          }));
        }

        console.log('Voice synthesis...');
        const ttsStart = Date.now();
        const audioStream = await textToSpeech(response);
        const ttsTime = Date.now() - ttsStart;
        
        ws.send(JSON.stringify({
          type: 'audio',
          audio: audioStream
        }));

        // Record performance metrics
        const totalTime = Date.now() - startTime;
        performanceMonitor.recordMetric({
          operation: 'audio_processing',
          transcriptionTime,
          aiTime,
          ttsTime,
          totalTime,
          wordCount,
          sessionDuration
        });
      }

      if (data.type === 'intervention_complete') {
        const responseText = "How's that feel?";
        
        ws.send(JSON.stringify({
          type: 'response',
          text: responseText
        }));
        
        const audioStream = await textToSpeech(responseText);
        ws.send(JSON.stringify({
          type: 'audio',
          audio: audioStream
        }));
      }

      if (data.type === 'sound_choice') {
        sessionState.soundEnabled = data.enabled;
      }

      if (data.type === 'session_complete') {
        userData.sessions.push({
          timestamp: new Date().toISOString(),
          state: data.state,
          frequency: data.frequency,
          duration: data.duration,
          outcome: data.outcome,
          interventionsUsed: sessionState.physicalInterventionsUsed
        });
        
        userData.totalSessions += 1;
        
        if (!userData.patterns[data.state]) userData.patterns[data.state] = 0;
        userData.patterns[data.state] += 1;
        
        if (data.outcome === 'helpful') {
          sessionState.physicalInterventionsUsed.forEach(intervention => {
            if (!userData.effectiveInterventions[intervention]) {
              userData.effectiveInterventions[intervention] = 0;
            }
            userData.effectiveInterventions[intervention] += 1;
          });
        }
        
        saveSessionData();
      }

      if (data.type === 'save_note') {
        userData.voiceNotes.push({
          timestamp: new Date().toISOString(),
          text: data.text,
          state: data.state
        });
        saveSessionData();
      }

    } catch (error) {
      console.error('Error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    conversations.delete(connectionId);
    sessionStates.delete(connectionId);
  });

  // Initial greeting
  setTimeout(async () => {
    const greeting = "Hey. What's going on?";
    
    ws.send(JSON.stringify({
      type: 'response',
      text: greeting
    }));

    const audioStream = await textToSpeech(greeting);
    ws.send(JSON.stringify({
      type: 'audio',
      audio: audioStream
    }));
  }, 1000);
});

async function transcribeAudio(audioBuffer) {
  try {
    const tempPath = path.join(__dirname, `temp_${Date.now()}.webm`);
    fs.writeFileSync(tempPath, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
    });

    fs.unlinkSync(tempPath);
    return transcription.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

async function getClaudeResponse(message, history, context = '') {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150, // Shorter responses
      system: SYSTEM_PROMPT + context,
      messages: [
        ...history,
        { role: 'user', content: message }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Claude error:', error);
    throw error;
  }
}

async function textToSpeech(text) {
  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer.toString('base64');
  } catch (error) {
    console.error('TTS error:', error);
    throw error;
  }
}

function detectFrequencyInResponse(text) {
  for (const [state, data] of Object.entries(FREQUENCY_MAP)) {
    if (text.includes(`${data.hz}Hz`) || text.includes(`${data.hz} Hz`)) {
      return data;
    }
  }
  return null;
}

function detectInterventionType(text) {
  const lower = text.toLowerCase();
  
  // Only detect if explicitly asking them to DO something physical
  // NOT just mentioning frequency/sound
  
  if (lower.includes('cold water on your wrists') || 
      (lower.includes('go ') && lower.includes('cold'))) {
    return 'cold_water';
  }
  if ((lower.includes('shake') && lower.includes('hands')) || 
      lower.includes('jumping jacks')) {
    return 'movement';
  }
  if (lower.includes('hum with me')) {
    return 'vagal';
  }
  if (lower.includes('lie down') && lower.includes('floor')) {
    return 'grounding';
  }
  
  // Don't trigger on frequency mentions
  return null;
}

function detectRepetition(current, previous) {
  if (!previous) return false;
  
  const currentWords = new Set(current.toLowerCase().split(' ').filter(w => w.length > 4));
  const previousWords = new Set(previous.toLowerCase().split(' ').filter(w => w.length > 4));
  
  const overlap = [...currentWords].filter(w => previousWords.has(w));
  return overlap.length > 5;
}

console.log('Voice agent backend ready - natural interventions');