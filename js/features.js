// EpicScreen Premium Features Module
// AI Assistant, Voice Recognition, Watch Together Simulation, and Profile System.

import { ALL_MOVIES } from "./data.js?v=2";

// ==========================================
// 1. PROFILE SWITCHING SYSTEM
// ==========================================
export const PROFILES = [
  { id: "cinephile", name: "The Cinephile", avatar: "🔮", color: "#7C3AED", watchlist: [693134, 157336] },
  { id: "critic", name: "The Critic", avatar: "🍷", color: "#FFC857", watchlist: [872585, 238, 577922] },
  { id: "adrenaline", name: "Adrenaline Fan", avatar: "⚡", color: "#00E5FF", watchlist: [533535, 579974] },
  { id: "anime", name: "Otaku", avatar: "🦊", color: "#FF6B6B", watchlist: [129, 372058] }
];

let currentProfile = PROFILES[0];

export function getActiveProfile() {
  const saved = localStorage.getItem("epicscreen_current_profile");
  if (saved) {
    const found = PROFILES.find(p => p.id === saved);
    if (found) currentProfile = found;
  }
  return currentProfile;
}

export function switchProfile(profileId) {
  const found = PROFILES.find(p => p.id === profileId);
  if (found) {
    currentProfile = found;
    localStorage.setItem("epicscreen_current_profile", profileId);
    // Trigger custom event for UI update
    window.dispatchEvent(new CustomEvent("profileChanged", { detail: found }));
  }
}

// Watchlist/Favorites Management
export function getWatchlist() {
  const profile = getActiveProfile();
  const key = `epicscreen_watchlist_${profile.id}`;
  const list = localStorage.getItem(key);
  return list ? JSON.parse(list) : profile.watchlist;
}

export function toggleWatchlist(movieId) {
  const profile = getActiveProfile();
  const key = `epicscreen_watchlist_${profile.id}`;
  let list = getWatchlist();
  
  if (list.includes(movieId)) {
    list = list.filter(id => id !== movieId);
  } else {
    list.push(movieId);
  }
  
  localStorage.setItem(key, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("watchlistUpdated"));
}

// ==========================================
// 2. AI RECOMMENDATION ENGINE (CHATBOT)
// ==========================================
export function getAIRecommendations(userMessage) {
  const msg = userMessage.toLowerCase();
  let matches = [];
  let botReply = "";

  // Keywords analyzer
  if (msg.includes("sci-fi") || msg.includes("space") || msg.includes("future") || msg.includes("time")) {
    matches = ALL_MOVIES.filter(m => m.categories.includes("epicOriginals") || m.categories.includes("mindBend"));
    botReply = "I've detected a preference for bending the laws of physics and exploring the cosmos. Here are some mind-bending sci-fi masterclasses available on EpicScreen:";
  } else if (msg.includes("indian") || msg.includes("bollywood") || msg.includes("hindi") || msg.includes("telugu")) {
    matches = ALL_MOVIES.filter(m => m.categories.includes("indianBlockbusters"));
    botReply = "Namaste! Experience the grandeur, high-octane emotions, and stellar spectacles of Indian Cinema on EpicScreen:";
  } else if (msg.includes("anime") || msg.includes("japan") || msg.includes("miyazaki")) {
    matches = ALL_MOVIES.filter(m => m.categories.includes("animeUniverse"));
    botReply = "Entering the Anime Universe. Hand-drawn masterpieces, breathtaking soundtracks, and emotional tales from the finest creators:";
  } else if (msg.includes("scary") || msg.includes("horror") || msg.includes("thrill") || msg.includes("dark")) {
    matches = ALL_MOVIES.filter(m => m.categories.includes("horrorNights") || m.categories.includes("nightWatch"));
    botReply = "Prepare for the shadows. Here are atmospheric, spine-chilling selections for a perfect horror night:";
  } else if (msg.includes("romantic") || msg.includes("love") || msg.includes("cozy") || msg.includes("date")) {
    matches = ALL_MOVIES.filter(m => m.categories.includes("romantic") || m.categories.includes("cozy"));
    botReply = "Setting a heartwarming mood. Here are some of our finest romantic masterpieces and cozy evening picks:";
  } else if (msg.includes("action") || msg.includes("adrenaline") || msg.includes("fight")) {
    matches = ALL_MOVIES.filter(m => m.categories.includes("adrenaline"));
    botReply = "Buckle up. These high-velocity action blockbusters will keep your adrenaline pumping:";
  } else if (msg.includes("award") || msg.includes("oscar") || msg.includes("best")) {
    matches = ALL_MOVIES.filter(m => m.categories.includes("awardWinners") || m.categories.includes("criticsChoice"));
    botReply = "Indulge in cinematic brilliance. These award-winning titles represent the absolute pinnacle of filmmaking:";
  } else {
    // Default random recommendations
    matches = ALL_MOVIES.sort(() => 0.5 - Math.random()).slice(0, 4);
    botReply = "Welcome to EpicScreen's Neural Core. Based on your profile archetype, here is a curated set of cinematic recommendations for your evening:";
  }

  // Deduplicate matches and return top 4
  const uniqueMatches = Array.from(new Set(matches)).slice(0, 4);

  return {
    reply: botReply,
    movies: uniqueMatches
  };
}

// ==========================================
// 3. VOICE SEARCH (WEB SPEECH API)
// ==========================================
export function initVoiceSearch(onResultCallback, onStateChangeCallback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn("Speech recognition is not supported in this browser. Falling back to simulation.");
    return {
      supported: false,
      start: () => simulateVoiceSearch(onResultCallback, onStateChangeCallback)
    };
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    if (onStateChangeCallback) onStateChangeCallback("listening");
  };

  recognition.onspeechend = () => {
    recognition.stop();
  };

  recognition.onend = () => {
    if (onStateChangeCallback) onStateChangeCallback("idle");
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    if (onStateChangeCallback) onStateChangeCallback("error", event.error);
    // Fall back to simulation if permission denied
    if (event.error === "not-allowed") {
      simulateVoiceSearch(onResultCallback, onStateChangeCallback);
    }
  };

  recognition.onresult = (event) => {
    const result = event.results[0][0].transcript;
    if (onResultCallback) onResultCallback(result);
  };

  return {
    supported: true,
    start: () => {
      try {
        recognition.start();
      } catch (e) {
        recognition.stop();
      }
    }
  };
}

// Simulated voice search logic for visual feedback when microphone is unavailable
function simulateVoiceSearch(onResultCallback, onStateChangeCallback) {
  if (onStateChangeCallback) onStateChangeCallback("listening");
  
  const voicePhrases = [
    "Recommend some Christopher Nolan movies",
    "Show me Indian blockbusters like Kalki",
    "Find some anime masterpieces",
    "Play the trailer for Dune Part Two",
    "Recommend a cozy romantic drama"
  ];

  const randomPhrase = voicePhrases[Math.floor(Math.random() * voicePhrases.length)];

  setTimeout(() => {
    if (onStateChangeCallback) onStateChangeCallback("processing");
    setTimeout(() => {
      if (onResultCallback) onResultCallback(randomPhrase);
      if (onStateChangeCallback) onStateChangeCallback("idle");
    }, 1500);
  }, 2500);
}

// ==========================================
// 4. WATCH TOGETHER SIMULATION
// ==========================================
class WatchTogetherRoom {
  constructor(roomCode, hostName) {
    this.roomCode = roomCode;
    this.hostName = hostName;
    this.participants = [hostName, "Aria_Synth", "Leo_Vidal", "Kira_Neo"];
    this.chatLog = [
      { sender: "System", message: `Room ${roomCode} created by ${hostName}. Synchronized pipeline ready.`, time: "Just Now" }
    ];
    this.simulating = false;
    this.chatCallbacks = [];
  }

  addMessage(sender, message) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logItem = { sender, message, time };
    this.chatLog.push(logItem);
    this.chatCallbacks.forEach(cb => cb(logItem));
  }

  onNewMessage(callback) {
    this.chatCallbacks.push(callback);
  }

  startSimulation() {
    if (this.simulating) return;
    this.simulating = true;

    const chatSim = [
      { sender: "Aria_Synth", msg: "Hey guys! Glad to join the room. This quality is absolutely stunning! 🌟", delay: 3000 },
      { sender: "Leo_Vidal", msg: "Wow, is this playing in 4K Atmos? No frame drops at all. EpicScreen is insane.", delay: 8000 },
      { sender: "Kira_Neo", msg: "Perfect timing, I just grabbed some popcorn 🍿. Sync status look good on your end?", delay: 14000 },
      { sender: "Aria_Synth", msg: "Yeah, fully locked in. Let's start the stream!", delay: 20000 },
      { sender: "System", msg: "Host adjusted timeline offset. Synchronizing video streams... [00:00:00]", delay: 23000 }
    ];

    chatSim.forEach(event => {
      setTimeout(() => {
        if (this.simulating) {
          this.addMessage(event.sender, event.msg);
        }
      }, event.delay);
    });
  }

  stopSimulation() {
    this.simulating = false;
  }
}

export function createWatchTogetherRoom(hostName) {
  const code = "ES-" + Math.floor(100000 + Math.random() * 900000);
  const room = new WatchTogetherRoom(code, hostName);
  room.startSimulation();
  return room;
}
