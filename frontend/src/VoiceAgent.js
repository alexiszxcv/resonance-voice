import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Heart, Waves, Clock, Droplet, Zap, Wind } from 'lucide-react';

function VoiceAgent() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentState, setCurrentState] = useState(null);
  const [particles, setParticles] = useState([]);
  const [frequencyActive, setFrequencyActive] = useState(false);
  const [currentFrequency, setCurrentFrequency] = useState(null);
  const [frequencyOffer, setFrequencyOffer] = useState(null);
  const [breathPhase, setBreathPhase] = useState(0);
  const [showPostSession, setShowPostSession] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [physicalIntervention, setPhysicalIntervention] = useState(null);
  const [interventionTimer, setInterventionTimer] = useState(0);
  const [interventionInstructions, setInterventionInstructions] = useState('');

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const canvasRef = useRef(null);
  const frequencyOscillatorsRef = useRef([]);
  const frequencyGainRef = useRef(null);
  const animationRef = useRef(null);
  const interventionTimerRef = useRef(null);

  const states = {
    anxious: { color: { r: 239, g: 68, b: 68 }, targetColor: { r: 249, g: 115, b: 22 } },
    numb: { color: { r: 99, g: 102, b: 241 }, targetColor: { r: 168, g: 85, b: 247 } },
    scattered: { color: { r: 234, g: 179, b: 8 }, targetColor: { r: 251, g: 146, b: 60 } },
    default: { color: { r: 15, g: 23, b: 42 }, targetColor: { r: 88, g: 28, b: 135 } }
  };

  const interventionIcons = {
    cold_water: Droplet,
    movement: Zap,
    vagal: Wind,
    grounding: Heart
  };

  // Session timer
  useEffect(() => {
    if (!sessionStartTime) return;
    
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      setSessionDuration(elapsed);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  // Intervention countdown
  useEffect(() => {
    if (!physicalIntervention) return;
    
    setInterventionTimer(0);
    interventionTimerRef.current = setInterval(() => {
      setInterventionTimer(prev => prev + 1);
    }, 1000);
    
    return () => {
      if (interventionTimerRef.current) {
        clearInterval(interventionTimerRef.current);
      }
    };
  }, [physicalIntervention]);

  // Initialize
  useEffect(() => {
    connectWebSocket();
    initParticles();
    animateBreath();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (interventionTimerRef.current) clearInterval(interventionTimerRef.current);
      stopFrequency();
    };
  }, []);

  // Particle animation
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p, i) => {
        const chaos = currentState === 'scattered' ? 2 : currentState === 'anxious' ? 1.5 : 1;
        p.x += p.vx * chaos;
        p.y += p.vy * chaos;
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${frequencyActive ? 0.4 : 0.2})`;
        ctx.fill();
        
        if (!currentState) {
          particles.forEach((p2, j) => {
            if (j <= i) return;
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 150) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * (1 - dist / 150)})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          });
        }
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  }, [particles, currentState, frequencyActive]);

  const initParticles = () => {
    const newParticles = [];
    for (let i = 0; i < 50; i++) {
      newParticles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1
      });
    }
    setParticles(newParticles);
  };

  const animateBreath = () => {
    const breathe = () => {
      setBreathPhase(prev => (prev + 0.02) % (Math.PI * 2));
      requestAnimationFrame(breathe);
    };
    breathe();
  };

  const connectWebSocket = () => {
    wsRef.current = new WebSocket('ws://localhost:3001');

    wsRef.current.onopen = () => {
      console.log('Connected');
      setIsConnected(true);
      setSessionStartTime(Date.now());
    };

    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'transcript') {
        setTranscript(data.text);
        addToHistory('user', data.text);
        setTranscript('');
      }

      if (data.type === 'response') {
        addToHistory('agent', data.text);
        detectState(data.text);
      }

      if (data.type === 'frequency_offer') {
        console.log('Frequency offered:', data);
        setFrequencyOffer({
          hz: data.frequency,
          description: data.description
        });
      }

      if (data.type === 'physical_intervention') {
        console.log('Physical intervention:', data);
        setPhysicalIntervention(data.intervention);
        setInterventionInstructions(data.instructions);
      }

      if (data.type === 'audio') {
        await playAudio(data.audio);
      }
    };

    wsRef.current.onclose = () => setIsConnected(false);
    wsRef.current.onerror = (error) => console.error('WS error:', error);
  };

  const addToHistory = (speaker, text) => {
    setConversationHistory(prev => [...prev, { speaker, text, timestamp: Date.now() }]);
  };

  const detectState = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('anxiety') || lower.includes('anxious') || lower.includes('overwhelm')) {
      setCurrentState('anxious');
    } else if (lower.includes('numb') || lower.includes('empty')) {
      setCurrentState('numb');
    } else if (lower.includes('scattered') || lower.includes('chaos')) {
      setCurrentState('scattered');
    }
  };

  const completeIntervention = () => {
    if (interventionTimerRef.current) {
      clearInterval(interventionTimerRef.current);
    }
    
    wsRef.current.send(JSON.stringify({
      type: 'intervention_complete',
      intervention: physicalIntervention,
      duration: interventionTimer
    }));
    
    setPhysicalIntervention(null);
    setInterventionTimer(0);
    setInterventionInstructions('');
  };

  const acceptFrequency = () => {
    if (!frequencyOffer) return;
    
    console.log('Accepting frequency:', frequencyOffer.hz);
    playFrequency(frequencyOffer.hz);
    setFrequencyActive(true);
    setCurrentFrequency(frequencyOffer.hz);
    setFrequencyOffer(null);
    
    wsRef.current.send(JSON.stringify({
      type: 'sound_choice',
      enabled: true,
      frequency: frequencyOffer.hz
    }));
  };

  const declineFrequency = () => {
    console.log('Declining frequency');
    setFrequencyOffer(null);
    
    wsRef.current.send(JSON.stringify({
      type: 'sound_choice',
      enabled: false
    }));
  };

  const playFrequency = (hz) => {
    console.log('Playing frequency:', hz);
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    // Stop any existing frequency
    stopFrequency();

    const ctx = audioContextRef.current;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.2;
    masterGain.connect(ctx.destination);
    frequencyGainRef.current = masterGain;

    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    const merger = ctx.createChannelMerger(2);

    leftOsc.frequency.value = hz;
    rightOsc.frequency.value = hz + 8; // Binaural beat

    leftOsc.connect(merger, 0, 0);
    rightOsc.connect(merger, 0, 1);
    merger.connect(masterGain);

    leftOsc.start();
    rightOsc.start();

    frequencyOscillatorsRef.current = [leftOsc, rightOsc];
    
    console.log('Frequency started');
  };

  const stopFrequency = () => {
    frequencyOscillatorsRef.current.forEach(osc => {
      try { 
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    frequencyOscillatorsRef.current = [];
    setFrequencyActive(false);
    console.log('Frequency stopped');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64Audio = reader.result.split(',')[1];
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'audio',
              audio: base64Audio
            }));
          }
        };
        
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

    } catch (error) {
      console.error('Mic error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = async (base64Audio) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    audioQueueRef.current.push(base64Audio);
    
    if (!isPlayingRef.current) {
      await processAudioQueue();
    }
  };

  const processAudioQueue = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const base64Audio = audioQueueRef.current.shift();

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        processAudioQueue();
      };

      source.start(0);

    } catch (error) {
      console.error('Error playing audio:', error);
      isPlayingRef.current = false;
      setIsSpeaking(false);
      processAudioQueue();
    }
  };

  const endSession = () => {
    setShowPostSession(true);
    
    wsRef.current.send(JSON.stringify({
      type: 'session_complete',
      state: currentState,
      frequency: currentFrequency,
      duration: sessionDuration,
      outcome: 'helpful'
    }));
  };

  const saveNote = (text) => {
    wsRef.current.send(JSON.stringify({
      type: 'save_note',
      text,
      state: currentState
    }));
    
    setShowPostSession(false);
    setSessionStartTime(Date.now());
    setSessionDuration(0);
    setCurrentState(null);
    setCurrentFrequency(null);
    setConversationHistory([]);
    setPhysicalIntervention(null);
    stopFrequency();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stateColors = currentState && states[currentState] ? states[currentState] : states.default;
  const breathScale = 1 + Math.sin(breathPhase) * 0.1;

  const containerStyle = {
    minHeight: '100vh',
    background: `linear-gradient(135deg, 
      rgb(${stateColors.color.r}, ${stateColors.color.g}, ${stateColors.color.b}), 
      rgb(${stateColors.targetColor.r}, ${stateColors.targetColor.g}, ${stateColors.targetColor.b}))`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    position: 'relative',
    overflow: 'hidden',
    transition: 'background 2s ease'
  };

  if (showPostSession) {
    return (
      <div style={{
        ...containerStyle,
        background: 'linear-gradient(135deg, rgb(34, 197, 94), rgb(16, 185, 129))'
      }}>
        <canvas ref={canvasRef} style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }} />
        
        <div style={{
          maxWidth: '32rem',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{ textAlign: 'center' }}>
            <Heart size={64} style={{ color: 'white', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '2rem', fontWeight: '300', color: 'white', marginBottom: '1rem' }}>
              How's your system now?
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem' }}>
              We were together for {formatTime(sessionDuration)}
            </p>
          </div>

          <textarea
            placeholder="Want to leave a note for yourself about what helped?"
            style={{
              width: '100%',
              height: '8rem',
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '0.75rem',
              color: 'white',
              fontSize: '1rem',
              resize: 'none',
              outline: 'none'
            }}
            id="voice-note"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => {
                const note = document.getElementById('voice-note').value;
                saveNote(note || "I made it through");
              }}
              style={{
                width: '100%',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '9999px',
                color: 'white',
                fontSize: '1.125rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
            <button
              onClick={() => saveNote("Session complete")}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '48rem',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        position: 'relative',
        zIndex: 10
      }}>
        
        {/* Session Timer - only show after a minute */}
        {sessionStartTime && sessionDuration > 60 && (
          <div style={{ 
            textAlign: 'center', 
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem'
          }}>
            <Clock size={12} />
            {formatTime(sessionDuration)}
          </div>
        )}

        {!isConnected && (
          <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
            Connecting...
          </div>
        )}

        {/* Breathing Orb */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '10rem',
            height: '10rem',
            margin: '0 auto',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${breathScale})`,
            transition: 'transform 1s ease',
            position: 'relative'
          }}>
            <Heart 
              size={48} 
              style={{
                color: 'white',
                transform: isSpeaking ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.5s'
              }}
            />
            
            {frequencyActive && (
              <div style={{
                position: 'absolute',
                inset: '-10px',
                borderRadius: '9999px',
                border: '2px solid rgba(255, 255, 255, 0.5)',
                animation: 'pulse 2s infinite'
              }} />
            )}
          </div>
          
          {frequencyActive && (
            <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.875rem', marginTop: '1rem', fontWeight: '500' }}>
              {currentFrequency}Hz playing
            </p>
          )}
        </div>

        {/* Physical Intervention - Only for actual physical exercises */}
        {physicalIntervention && (
          <div style={{
            padding: '2rem',
            background: 'rgba(99, 102, 241, 0.4)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              {React.createElement(interventionIcons[physicalIntervention] || Heart, {
                size: 32,
                style: { color: 'white', margin: '0 auto' }
              })}
            </div>
            
            <div style={{
              fontSize: '2rem',
              fontWeight: '300',
              color: 'white',
              marginBottom: '1rem'
            }}>
              {interventionTimer}s
            </div>

            <button
              onClick={completeIntervention}
              style={{
                padding: '0.75rem 2rem',
                background: 'rgba(255, 255, 255, 0.3)',
                border: 'none',
                borderRadius: '9999px',
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* Frequency Offer */}
        {frequencyOffer && !physicalIntervention && (
          <div style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <Waves size={28} style={{ color: 'white', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'white', marginBottom: '1rem', fontSize: '0.95rem' }}>
                {frequencyOffer.hz}Hz - {frequencyOffer.description}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={acceptFrequency}
                  style={{
                    padding: '0.6rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.4)',
                    border: 'none',
                    borderRadius: '9999px',
                    color: 'white',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Yeah
                </button>
                <button
                  onClick={declineFrequency}
                  style={{
                    padding: '0.6rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    borderRadius: '9999px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conversation */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          maxHeight: '24rem',
          overflowY: 'auto'
        }}>
          {conversationHistory.slice(-6).map((entry, i) => (
            <div 
              key={i}
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                backdropFilter: 'blur(8px)',
                background: entry.speaker === 'agent' 
                  ? 'rgba(255, 255, 255, 0.2)' 
                  : 'rgba(255, 255, 255, 0.1)',
                color: 'white'
              }}
            >
              <p style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', opacity: 0.8 }}>
                {entry.speaker === 'agent' ? 'Resonance' : 'You'}
              </p>
              <p style={{ lineHeight: '1.5' }}>{entry.text}</p>
            </div>
          ))}
        </div>

        {transcript && (
          <div style={{
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '0.75rem',
            backdropFilter: 'blur(8px)',
            color: 'white',
            fontStyle: 'italic'
          }}>
            <p>{transcript}...</p>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={!isConnected || isSpeaking || physicalIntervention}
            style={{
              width: '6rem',
              height: '6rem',
              borderRadius: '9999px',
              border: 'none',
              cursor: (isConnected && !isSpeaking && !physicalIntervention) ? 'pointer' : 'not-allowed',
              background: isRecording ? 'rgb(239, 68, 68)' : 'rgba(255, 255, 255, 0.2)',
              transform: isRecording ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.3s',
              opacity: (!isConnected || isSpeaking || physicalIntervention) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isRecording ? (
              <Mic size={40} color="white" />
            ) : (
              <MicOff size={40} color="white" />
            )}
          </button>

          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem', textAlign: 'center' }}>
            {isRecording ? 'Listening...' : isSpeaking ? 'Speaking...' : physicalIntervention ? 'Doing the exercise...' : 'Hold to speak'}
          </p>

          {conversationHistory.length > 2 && !physicalIntervention && !showPostSession && (
            <button
              onClick={endSession}
              style={{
                padding: '0.75rem 2rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '9999px',
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              I'm Better Now
            </button>
          )}
        </div>

        {conversationHistory.length === 0 && isConnected && (
          <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
            Hold the button and tell me what's happening
          </p>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

export default VoiceAgent;