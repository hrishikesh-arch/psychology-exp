const STORAGE_KEY = "digital_bystander_experiment_v2";
const ADMIN_PASSCODE = "ADMIN2026";
const HELP_OFFSET_MS = 45000;
const TIMEOUT_MS = 180000;
const HELP_CUE_1 = "Who is conducting";
const HELP_CUE_2 = "What is the duration of the meeting";
const HELP_CUE_3 = "what is the meeting joining Code";

const app = document.getElementById("app");

const firebaseConfig = {
  apiKey: "AIzaSyAqhHJGJyykiKSU-IgIa321Rm0zN97d9rE",
  authDomain: "psychology-5d4e1.firebaseapp.com",
  databaseURL: "https://psychology-5d4e1-default-rtdb.firebaseio.com",
  projectId: "psychology-5d4e1",
  storageBucket: "psychology-5d4e1.firebasestorage.app",
  messagingSenderId: "883810074062",
  appId: "1:883810074062:web:6d691817fa94cb94beff9f",
  measurementId: "G-MHTHP5PE9W"
};
function cleanForFirebase(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirebase(item));
  }
  const cleanObj = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleanObj[key] = cleanForFirebase(value);
    }
  }
  return cleanObj;
}

if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    firebase.analytics();
    syncLocalAndFirebase();
  } catch (e) {
    console.warn("Firebase init failed:", e);
  }
}

function syncLocalAndFirebase() {
  if (typeof firebase === 'undefined' || typeof firebase.database !== 'function') return;
  try {
    const db = firebase.database();
    
    // Listen to sessions from Firebase and merge into localStorage
    db.ref('sessions').on('value', (snapshot) => {
      const data = snapshot.val() || {};
      const fbSessions = Object.values(data);
      const state = loadState();
      let changed = false;

      fbSessions.forEach(fs => {
        if (!fs || !fs.id) return;
        const existingIdx = state.sessions.findIndex(s => s.id === fs.id);
        if (existingIdx === -1) {
          state.sessions.push(fs);
          changed = true;
        } else if (fs.status === "COMPLETED" && state.sessions[existingIdx].status !== "COMPLETED") {
          state.sessions[existingIdx] = fs;
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }

      pushUnsyncedSessionsToFirebase(state);
    }, (err) => {
      console.warn("Firebase sessions listener error (check security rules):", err);
    });

    // Listen to groups from Firebase
    db.ref('groups').on('value', (snapshot) => {
      const data = snapshot.val() || {};
      const fbGroups = Object.values(data);
      const state = loadState();
      let changed = false;

      fbGroups.forEach(fg => {
        if (!fg || !fg.id) return;
        if (!state.groups.some(lg => lg.id === fg.id)) {
          state.groups.push(fg);
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    }, (err) => {
      console.warn("Firebase groups listener error (check security rules):", err);
    });

  } catch (e) {
    console.warn("Firebase sync setup error:", e);
  }
}

function pushUnsyncedSessionsToFirebase(state) {
  if (typeof firebase === 'undefined' || typeof firebase.database !== 'function') return;
  try {
    const db = firebase.database();
    const current = state || loadState();
    if (Array.isArray(current.sessions)) {
      current.sessions.forEach(session => {
        if (session && session.id) {
          const cleaned = cleanForFirebase(session);
          db.ref('sessions/' + session.id).set(cleaned).catch(e => console.warn("FB Session push error:", e));
        }
      });
    }
    if (Array.isArray(current.groups)) {
      current.groups.forEach(group => {
        if (group && group.id) {
          const cleaned = cleanForFirebase(group);
          db.ref('groups/' + group.id).set(cleaned).catch(e => console.warn("FB Group push error:", e));
        }
      });
    }
  } catch (e) {
    console.warn("Failed to push unsynced sessions to Firebase:", e);
  }
}

let timers = [];
let countdownTimer = null;
let replyingTo = null;

const bots = [
  { name: "Dr. Maya", role: "creator", color: "#0f766e" },
  { name: "Aarav", role: "member", color: "#2563eb" },
  { name: "Nisha", role: "member", color: "#7c3aed" },
  { name: "Kabir", role: "member", color: "#ca8a04" },
  { name: "Meera", role: "member", color: "#db2777" },
  { name: "Dev", role: "member", color: "#ea580c" },
  { name: "Ananya", role: "member", color: "#0891b2" },
  { name: "Rohan", role: "member", color: "#16a34a" },
  { name: "Ishita", role: "member", color: "#9333ea" },
  { name: "Arjun", role: "member", color: "#0369a1" },
  { name: "Tara", role: "member", color: "#be123c" }
];

const botScripts = [
  [
    [2500, "Dr. Maya", "Everyone in?"],
    [7500, "Rohan", "yes"],
    [13000, "Ishita", "yep"],
    [20500, "Tara", "where is the set up thing?"],
    [28500, "Dev", "it's on the main page link"]
  ]
];

const postHelpScript = [];

function loadState() {
  const fallback = { groups: [], sessions: [], events: [] };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  try {
    if (typeof firebase !== 'undefined' && typeof firebase.database === 'function') {
      const db = firebase.database();
      if (Array.isArray(state.sessions)) {
        state.sessions.forEach(session => {
          if (session && session.id) {
            const cleaned = cleanForFirebase(session);
            db.ref('sessions/' + session.id).set(cleaned).catch(e => console.warn("FB Session error", e));
          }
        });
      }
      if (Array.isArray(state.groups)) {
        state.groups.forEach(group => {
          if (group && group.id) {
            const cleaned = cleanForFirebase(group);
            db.ref('groups/' + group.id).set(cleaned).catch(e => console.warn("FB Group error", e));
          }
        });
      }
    }
  } catch (e) {
    console.warn("Firebase sync failed:", e);
  }
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeGroup(code, name, readReceipts, bystanderCount = 10, memberCount = 12) {
  return {
    id: createId("grp"),
    code,
    name,
    creator: "Dr. Maya",
    memberCount,
    bystanderCount,
    readReceipts,
    createdAt: new Date().toISOString()
  };
}

function ensureDefaultGroups(state) {
  if (state.groups.length) return state;
  state.groups = [makeGroup("GROUP4", "Group 4", true), makeGroup("GROUP5", "Group 5", false)];
  saveState(state);
  return state;
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
}

function renderFrame(content, wide = false) {
  app.innerHTML = `
    <div class="${wide ? "app-frame wide" : "app-frame"}">
      <header class="site-bar">
        <div class="site-brand">
          <div class="site-mark">G4</div>
          <div>
            <h1>Group Chat Study</h1>
          </div>
        </div>
        <nav>
          <button class="ghost-btn" data-view="participant">Participant</button>
          <button class="ghost-btn" data-view="admin">Admin</button>
        </nav>
      </header>
      ${content}
    </div>
  `;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      clearTimers();
      if (button.dataset.view === "admin") {
        if (sessionStorage.getItem("study_admin") === "true") {
          renderAdminDashboard();
        } else {
          renderAdminLogin();
        }
      } else {
        renderOnboarding();
      }
    });
  });
}

function renderOnboarding(error = "") {
  clearTimers();
  renderFrame(`
    <section class="entry-grid">
      <div class="entry-copy">
        <div class="phone-preview">
          <div class="preview-top"></div>
          <div class="preview-bubble incoming">Can everyone see the setup guide?</div>
          <div class="preview-bubble outgoing">Yes, I joined.</div>
          <div class="preview-bubble incoming">Please keep the group open.</div>
        </div>
        <h2>Join the study group chat</h2>
        <p>This prototype simulates a group chat for a controlled psychology experiment. The live-looking members are scripted study accounts, and the final version should include faculty-approved consent and debrief text.</p>
      </div>
      <form class="entry-card" id="profileForm">
        <h2>Participant Details</h2>
        <label><span>Name</span><input id="participantName" autocomplete="name" required></label>
        <label><span>Phone number</span><input id="participantPhone" inputmode="tel" autocomplete="tel" required></label>
        <label><span>Email address</span><input id="participantEmail" type="email" autocomplete="email" required></label>
        <label><span>Profile photo optional</span><input id="participantPhoto" type="file" accept="image/*"></label>
        ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
        <button class="primary-btn" type="submit">Continue</button>
      </form>
    </section>
  `);

  document.getElementById("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const participant = {
      name: document.getElementById("participantName").value.trim(),
      phone: document.getElementById("participantPhone").value.trim(),
      email: document.getElementById("participantEmail").value.trim(),
      photo: await readPhoto(document.getElementById("participantPhoto").files[0])
    };
    if (!participant.name || !participant.phone || !participant.email) {
      renderOnboarding("Please enter your name, phone number, and email.");
      return;
    }
    renderJoinGate(participant);
  });
}

function readPhoto(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function renderJoinGate(participant, error = "") {
  const state = ensureDefaultGroups(loadState());
  const uniqueGroups = [];
  const seenNames = new Set();
  for (const group of state.groups) {
    if (!seenNames.has(group.name)) {
      seenNames.add(group.name);
      uniqueGroups.push(group);
    }
  }

  const groupOptions = uniqueGroups
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((group) => `<option value="${escapeHtml(group.code)}">${escapeHtml(group.name)}</option>`)
    .join("");

  renderFrame(`
    <section class="join-card">
      <div class="group-invite">
        ${avatarMarkup("Group", "", "group-avatar")}
        <h2>Group Chat Task</h2>
        <p>12 members</p>
        <p class="invite-text">You have been invited to join this online group chat task.</p>
      </div>
      <form class="join-form" id="joinForm">
        <label>
          <span>Select Group</span>
          <select id="groupCode" required>
            ${groupOptions}
          </select>
        </label>
        ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
        <div class="action-row">
          <button class="secondary-btn" type="button" id="declineJoin">Decline</button>
          <button class="primary-btn" type="submit">Join Group</button>
        </div>
      </form>
    </section>
  `);

  document.getElementById("declineJoin").addEventListener("click", renderDeclined);
  document.getElementById("joinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const code = document.getElementById("groupCode").value;
    const group = state.groups.find((item) => item.code === code);
    if (!group) {
      renderJoinGate(participant, "That group code was not found.");
      return;
    }
    startSession(participant, group);
  });
}

function renderDeclined() {
  renderFrame(`
    <section class="plain-card">
      <h2>You left the invitation</h2>
      <p>No study session was started.</p>
      <button class="primary-btn" id="startAgain">Back to entry</button>
    </section>
  `);
  document.getElementById("startAgain").addEventListener("click", renderOnboarding);
}

function startSession(participant, group) {
  const state = loadState();
  const conditionMessage = group.readReceipts 
    ? "Group task started. Read receipts are ON, that means everyone can see who all have read the messages."
    : "Group task started. Read receipts are OFF, that means the reading status remains anonymous.";

  const now = Date.now();
  const messages = [
    { id: createId("msg"), at: new Date(now - 300000).toISOString(), sender: "Dr. Maya", text: "Hello everyone", kind: "bot", seenCount: group.bystanderCount },
    { id: createId("msg"), at: new Date(now - 240000).toISOString(), sender: "Dr. Maya", text: "Good morning", kind: "bot", seenCount: group.bystanderCount },
    { id: createId("msg"), at: new Date(now - 1000).toISOString(), text: conditionMessage, kind: "system" }
  ];

  const session = {
    id: createId("ses"),
    participantName: participant.name,
    participantPhone: participant.phone,
    participantEmail: participant.email,
    participantPhoto: participant.photo,
    groupId: group.id,
    groupCode: group.code,
    groupName: group.name,
    creator: group.creator,
    condition: group.readReceipts ? "READ_RECEIPTS_ON" : "NO_AWARENESS_CUE",
    readReceipts: group.readReceipts,
    memberCount: group.memberCount,
    bystanderCount: group.bystanderCount,
    status: "WAITING",
    entryTime: new Date().toISOString(),
    helpCueShownAt: null,
    completedAt: null,
    
    // New 3-step state
    cueState: 0,
    latencies: [null, null, null],
    responded: [null, null, null],
    
    latencySeconds: null, // We keep this for backward compatibility or avg
    timeoutDeadline: null,
    messages: messages,
    scriptIndex: 0
  };
  state.sessions.push(session);
  saveState(state);
  logEvent(session.id, "SESSION_STARTED", { condition: session.condition });
  renderChat(session.id);
}

function renderChat(sessionId) {
  clearTimers();
  const session = loadState().sessions.find((item) => item.id === sessionId);
  if (!session) {
    renderOnboarding("Session could not be found.");
    return;
  }
  renderFrame(`
    <section class="messenger" style="grid-template-rows: 100%;">
      <aside class="chat-list">
        <div class="list-head">
          ${avatarMarkup(session.participantName, session.participantPhoto)}
          <div class="list-icons"><span></span><span></span><span></span></div>
        </div>
        <div class="search-box">Search or start new chat</div>
        <button class="thread active">
          ${avatarMarkup("Group 4", "", "thread-avatar")}
          <span><strong>${escapeHtml(session.groupName)}</strong><small id="threadPreview">Group task started</small></span>
        </button>
        <div class="member-panel">
          <h3>Members</h3>
          ${memberListMarkup(session)}
        </div>
      </aside>
      <section class="chat-window" style="min-height: 0;">
        <header class="chat-head">
          <div class="chat-title">
            ${avatarMarkup(session.groupName, "", "thread-avatar")}
            <div><h2>${escapeHtml(session.groupName)}</h2><p>${session.memberCount} members</p></div>
          </div>
          <div class="chat-actions"><button title="Search">⌕</button><button title="Menu">⋮</button></div>
        </header>
        <div class="messages" id="messages"></div>
        <div class="composer-container" style="display: flex; flex-direction: column; background: var(--panel);">
          <div id="replyPreview" class="reply-preview" style="display: none;">
            <div class="reply-preview-content">
              <div id="replyPreviewSender" class="reply-preview-sender"></div>
              <div id="replyPreviewText" class="reply-preview-text"></div>
            </div>
            <button type="button" id="cancelReply" title="Cancel reply">✕</button>
          </div>
          <form class="composer" id="composer" style="width: 100%;">
            <button type="button" title="Attach">＋</button>
            <input id="messageInput" placeholder="Type a message" autocomplete="off">
            <button class="send-btn" type="submit" title="Send">➤</button>
          </form>
        </div>
      </section>
    </section>
  `, true);

  document.getElementById("composer").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addParticipantMessage(sessionId, text);
    cancelReply();
  });

  document.getElementById("cancelReply").addEventListener("click", cancelReply);
  
  document.getElementById("messages").addEventListener("click", (event) => {
    if (event.target.classList.contains("reply-btn")) {
      const msgId = event.target.dataset.msgId;
      const session = loadState().sessions.find((item) => item.id === sessionId);
      const msg = session?.messages.find(m => m.id === msgId);
      if (msg) {
        replyingTo = { id: msg.id, sender: msg.sender || (msg.kind === "system" ? "System" : session.groupName), text: msg.text };
        document.getElementById("replyPreview").style.display = "flex";
        document.getElementById("replyPreviewSender").textContent = replyingTo.sender;
        document.getElementById("replyPreviewText").textContent = replyingTo.text;
        document.getElementById("messageInput").focus();
      }
    }
  });

  function cancelReply() {
    replyingTo = null;
    const preview = document.getElementById("replyPreview");
    if (preview) preview.style.display = "none";
  }

  timers.push(setInterval(() => updateReadReceipts(sessionId), 2500));
  scheduleMessages(sessionId);
  drawMessages(sessionId);
}

function scheduleMessages(sessionId) {
  const session = loadState().sessions.find((item) => item.id === sessionId);
  if (!session || session.status === "COMPLETED") return;
  const alreadyShown = new Set(session.messages.map((message) => message.scriptKey).filter(Boolean));
  const baseScript = botScripts[session.scriptIndex] || botScripts[0];
  const allScript = [
    ...baseScript.map((line, index) => ({ line, key: `pre_${index}` })),
    ...postHelpScript.map((line, index) => ({ line, key: `post_${index}` }))
  ];

  allScript.forEach(({ line, key }) => {
    if (alreadyShown.has(key)) return;
    const [delay, sender, rawText, kind] = line;
    
    // trigger cue 1 after the last pre script finishes
    if (key === "pre_" + (baseScript.length - 1)) {
      timers.push(setTimeout(() => triggerCue(sessionId, 1), delay + 4000));
    }
    
    timers.push(setTimeout(() => {
      const latest = loadState().sessions.find((item) => item.id === sessionId);
      if (!latest || latest.status === "COMPLETED") return;
      const text = rawText.replaceAll("{{name}}", latest.participantName);
      addMessage(sessionId, { sender, text, kind: kind || "bot", scriptKey: key });
    }, delay));
  });
}

function addMessage(sessionId, msgObj) {
  const state = loadState();
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const newMsg = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    sender: msgObj.sender,
    text: msgObj.text,
    kind: msgObj.kind,
    at: new Date().toISOString(),
    scriptKey: msgObj.scriptKey,
    replyTo: msgObj.replyTo,
    seenCount: Math.floor(Math.random() * 4) + 1
  };
  session.messages.push(newMsg);
  if (session.status === "WAITING" && msgObj.kind !== "system") session.status = "NORMAL_CONVERSATION";
  saveState(state);
  drawMessages(sessionId);
}

function addParticipantMessage(sessionId, text) {
  const state = loadState();
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session || session.status === "COMPLETED") return;
  const sentAt = new Date();
  const msgObj = {
    id: createId("msg"),
    at: sentAt.toISOString(),
    sender: session.participantName,
    text,
    kind: "participant"
  };
  if (replyingTo) {
    msgObj.replyTo = replyingTo;
  }
  session.messages.push(msgObj);
  
  if (session.cueState > 0 && session.responded[session.cueState - 1] === null) {
    const step = session.cueState;
    session.responded[step - 1] = 1;
    const latency = Number(((sentAt - new Date(session.helpCueShownAt)) / 1000).toFixed(1));
    session.latencies[step - 1] = latency;
    session.latencySeconds = latency; // backward compatibility
    
    logEvent(sessionId, `RESPONDED_CUE_${step}`, { latencySeconds: latency, text: text });
    
    let botReplyText = "";
    const normalizedText = text.toLowerCase().replace(/\s/g, '');
    if (step === 1) {
      if (normalizedText.includes("drmaya") || normalizedText.includes("maya")) {
        botReplyText = "Oh right, Dr Maya, thanks!";
      } else {
        botReplyText = "Hmm, are you sure? I thought it was Dr Maya.";
      }
    } else if (step === 2) {
      if (normalizedText.includes("5") || normalizedText.includes("five")) {
        botReplyText = "Ah 5 mins, got it.";
      } else {
        botReplyText = "Hmm, I thought it was 5 mins.";
      }
    } else if (step === 3) {
      if (normalizedText.includes("meeting123") || normalizedText.includes("123")) {
        botReplyText = "meeting123, perfect. Thanks!";
      } else {
        botReplyText = "Ah, meeting123. Thanks anyway!";
      }
    }
    
    const delay = calculateDelay(botReplyText);
    timers.push(setTimeout(() => {
      const currentAsker = loadState().sessions.find(x => x.id === sessionId)?.currentAsker || "Samir";
      addMessage(sessionId, { sender: currentAsker, text: botReplyText, kind: "bot" });
      
      timers.push(setTimeout(() => {
        if (step < 3) {
          triggerCue(sessionId, step + 1);
        } else {
          const endState = loadState();
          const endSession = endState.sessions.find((item) => item.id === sessionId);
          if (endSession && endSession.status !== "COMPLETED") {
            endSession.status = "COMPLETED";
            endSession.completedAt = new Date().toISOString();
            saveState(endState);
            renderDebrief(sessionId);
          }
        }
      }, 3000));
    }, delay));
  } else {
    triggerDynamicBotReply(sessionId, text);
  }
  
  saveState(state);
  logEvent(sessionId, "PARTICIPANT_MESSAGE", { text });
  drawMessages(sessionId);
}

function calculateDelay(text) {
  let delay = 7000 + Math.random() * 4000 + (text.length * 100);
  if (delay < 8000) delay = 8000;
  if (delay > 15000) delay = 15000;
  return delay;
}

function triggerDynamicBotReply(sessionId, userText) {
  const responses = [
    { keywords: ["help", "code", "guide"], replies: ["I think the code is just GROUP4.", "Try refreshing the page?", "Yeah, I saw it in the setup."] },
    { keywords: ["hi", "hello", "hey", "sup"], replies: ["Hey!", "Hi there", "Hello", "Hey, what's up?"] },
    { keywords: ["what", "where", "how", "why"], replies: ["Not sure tbh.", "Maybe check the instructions?", "I'm figuring it out too.", "Good question."] },
    { keywords: ["yes", "yeah", "yep", "sure", "ok"], replies: ["Okay cool.", "Makes sense.", "Got it.", "Nice."] },
    { keywords: ["no", "nope", "nah"], replies: ["Oh ok.", "Alright.", "Hmm.", "Fair enough."] },
    { keywords: ["thanks", "thank"], replies: ["No problem!", "You got it.", "Anytime."] }
  ];
  
  let chosenReplies = ["Yeah.", "I agree.", "Oh okay.", "Interesting.", "Haha yeah.", "Let's see.", "Wait, really?"];
  
  const textLower = userText.toLowerCase();
  for (let rule of responses) {
    if (rule.keywords.some(k => textLower.includes(k))) {
      chosenReplies = rule.replies;
      break;
    }
  }
  
  const replyText = chosenReplies[Math.floor(Math.random() * chosenReplies.length)];
  const availableBots = bots.filter(b => b.role === "member");
  const randomBot = availableBots[Math.floor(Math.random() * availableBots.length)];
  
  const delay = calculateDelay(replyText);
  timers.push(setTimeout(() => {
    addMessage(sessionId, { sender: randomBot.name, text: replyText, kind: "bot" });
  }, delay));
}

function triggerCue(sessionId, step) {
  const state = loadState();
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session || session.status === "COMPLETED") return;
  
  session.cueState = step;
  if (step === 1) {
    session.status = "SCENARIO_TRIGGERED";
    session.helpCueShownAt = new Date().toISOString();
  }
  const timeoutLength = (step === 3) ? 120000 : 90000;
  session.timeoutDeadline = new Date(Date.now() + timeoutLength).toISOString();
  
  let sender, text;
  if (step === 1) {
    sender = "Samir";
    text = HELP_CUE_1;
  } else if (step === 2) {
    sender = session.currentAsker || "Samir";
    text = HELP_CUE_2;
  } else if (step === 3) {
    sender = session.currentAsker || "Samir";
    text = HELP_CUE_3;
  }
  
  session.currentAsker = sender;
  saveState(state);
  
  addMessage(sessionId, { sender, text, kind: "help" });
  logEvent(sessionId, `CUE_${step}_SHOWN`, { cue: text });
  
  startCountdown(sessionId);
  timers.push(setTimeout(() => handleCueTimeout(sessionId, step), timeoutLength));
}

function handleCueTimeout(sessionId, step) {
  const state = loadState();
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session || session.status === "COMPLETED" || session.cueState !== step || session.responded[step - 1] === 1) return;
  
  session.responded[step - 1] = 0;
  saveState(state);
  logEvent(sessionId, `TIMED_OUT_CUE_${step}`);
  
  if (step === 1) {
    addMessage(sessionId, { sender: "Samir", text: "no one doesn't even know who's conducting", kind: "bot" });
    timers.push(setTimeout(() => {
      addMessage(sessionId, { sender: "Rohan", text: "it's conducted by Dr Maya", kind: "bot" });
      const newState = loadState();
      const s = newState.sessions.find(x => x.id === sessionId);
      if (s) { s.currentAsker = "Rohan"; saveState(newState); }
      timers.push(setTimeout(() => triggerCue(sessionId, 2), 3000));
    }, 4000));
  } else if (step === 2) {
    addMessage(sessionId, { sender: "Rohan", text: "does nobody know the duration?", kind: "bot" });
    timers.push(setTimeout(() => {
      addMessage(sessionId, { sender: "Ishita", text: "Duration is 5 mins", kind: "bot" });
      const newState = loadState();
      const s = newState.sessions.find(x => x.id === sessionId);
      if (s) { s.currentAsker = "Ishita"; saveState(newState); }
      timers.push(setTimeout(() => triggerCue(sessionId, 3), 3000));
    }, 4000));
  } else if (step === 3) {
    const newState = loadState();
    const s = newState.sessions.find(x => x.id === sessionId);
    s.status = "COMPLETED";
    s.completedAt = new Date().toISOString();
    saveState(newState);
    renderDebrief(sessionId);
  }
}

function drawMessages(sessionId) {
  const state = loadState();
  const session = state.sessions.find((item) => item.id === sessionId);
  const container = document.getElementById("messages");
  if (!session || !container) return;
  
  const oldScrollTop = container.scrollTop;
  const oldScrollHeight = container.scrollHeight;
  const isNearBottom = oldScrollHeight - oldScrollTop <= container.clientHeight + 100;

  container.innerHTML = session.messages.map((message) => {
    if (message.kind === "system") return `<div class="system-message">${escapeHtml(message.text)}</div>`;
    const own = message.kind === "participant";
    const help = message.kind === "help";
    const receipt = session.readReceipts
      ? `<span class="ticks">✓✓</span><span class="seen-text" data-msg-id="${message.id}">Seen by ${message.seenCount !== undefined ? message.seenCount : session.bystanderCount} others</span>`
      : "";
    const replySnippet = message.replyTo
      ? `<div class="replied-snippet">
           <div class="replied-snippet-sender">${escapeHtml(message.replyTo.sender)}</div>
           <div class="replied-snippet-text">${escapeHtml(message.replyTo.text)}</div>
         </div>`
      : "";
    return `
      <article class="bubble ${own ? "own" : ""} ${help ? "help" : ""}">
        ${replySnippet}
        ${own ? "" : `<div class="bubble-sender" style="color:${findMemberColor(message.sender)}">${escapeHtml(message.sender)}</div>`}
        <div class="bubble-text">${escapeHtml(message.text)}</div>
        <div class="bubble-meta"><span>${formatClock(message.at)}</span>${receipt}<button type="button" class="reply-btn" data-msg-id="${message.id}" title="Reply">↩</button></div>
      </article>
    `;
  }).join("");
  
  if (isNearBottom || oldScrollHeight === 0) {
    container.scrollTop = container.scrollHeight;
  } else {
    container.scrollTop = oldScrollTop;
  }
  
  const status = document.getElementById("sessionStatus");
  if (status) status.textContent = statusLabel(session);
  const preview = document.getElementById("threadPreview");
  if (preview) {
    const last = session.messages.at(-1);
    preview.textContent = last ? last.text.slice(0, 42) : "Group task started";
  }
  if (session.helpCueShownAt && session.status !== "COMPLETED") startCountdown(sessionId);
}

function updateReadReceipts(sessionId) {
  const state = loadState();
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session || !session.readReceipts) return;
  
  let changed = false;
  session.messages.forEach(msg => {
    if (msg.seenCount === undefined) {
      msg.seenCount = Math.floor(Math.random() * 4) + 1;
      changed = true;
    }
  });

  session.messages.forEach(msg => {
    if (msg.seenCount < session.bystanderCount) {
      if (Math.random() < 0.5) { 
        msg.seenCount += Math.floor(Math.random() * 2) + 1;
        if (msg.seenCount > session.bystanderCount) msg.seenCount = session.bystanderCount;
        changed = true;
      }
    }
  });
  
  let maxSeen = 0;
  for (let i = session.messages.length - 1; i >= 0; i--) {
    let msg = session.messages[i];
    if (msg.seenCount > maxSeen) {
      maxSeen = msg.seenCount;
    } else if (msg.seenCount < maxSeen) {
      msg.seenCount = maxSeen;
      changed = true;
    }
  }

  if (changed) {
    saveState(state);
    session.messages.forEach(msg => {
      const span = document.querySelector(`span.seen-text[data-msg-id="${msg.id}"]`);
      if (span) {
        const own = msg.kind === "participant";
        span.textContent = `Seen by ${msg.seenCount} others${own ? "" : ` and ${escapeHtml(session.participantName)}`}`;
      }
    });
  }
}

function renderDebrief(sessionId) {
  clearTimers();
  const session = loadState().sessions.find((item) => item.id === sessionId);
  const result = session?.responded
    ? `Your reply was recorded ${session.latencySeconds} seconds after the target message.`
    : "No reply was recorded within the observation window.";
  renderFrame(`
    <section class="plain-card">
      <h2>Debrief</h2>
      <p>This was a simulated group chat for a digital bystander effect study. The other visible members were scripted study accounts, not live participants.</p>
      <p>${result}</p>
      <p class="fine-print">Before real data collection, replace this text with your faculty or ethics-board-approved debrief, investigator contact, and data withdrawal instructions.</p>
      <div class="action-row"><button class="primary-btn" id="newSession">New Session</button><button class="secondary-btn" id="openAdmin">Open Admin</button></div>
    </section>
  `);
  document.getElementById("newSession").addEventListener("click", renderOnboarding);
  document.getElementById("openAdmin").addEventListener("click", renderAdminLogin);
}

function renderAdminLogin(error = "") {
  clearTimers();
  renderFrame(`
    <form class="entry-card admin-login" id="adminForm">
      <h2>Administrator Access</h2>
      <p style="color:var(--gray-600);margin-bottom:1rem;font-size:0.95rem;">Enter the administrative passcode to access study metrics and session logs.</p>
      <label><span>Secret passcode</span><input id="adminPasscode" type="password" placeholder="Enter passcode" autofocus required></label>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <button class="primary-btn" type="submit">Unlock Dashboard</button>
    </form>
  `);
  document.getElementById("adminForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const passcode = document.getElementById("adminPasscode").value.trim();
    if (passcode.toUpperCase() !== ADMIN_PASSCODE.toUpperCase()) {
      renderAdminLogin("Incorrect passcode. Please enter ADMIN2026.");
      return;
    }
    sessionStorage.setItem("study_admin", "true");
    renderAdminDashboard();
  });
}

function renderAdminDashboard() {
  const state = ensureDefaultGroups(loadState());
  const groupRows = state.groups.map((group) => {
    const sessions = state.sessions.filter((session) => session.groupId === group.id);
    return `
      <tr>
        <td><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.code)}</small></td>
        <td>${escapeHtml(group.creator)}</td>
        <td>${group.bystanderCount}</td>
        <td>${group.readReceipts ? '<span class="badge ok">Read receipts</span>' : '<span class="badge warn">No cue</span>'}</td>
        <td>${sessions.length}</td>
      </tr>
    `;
  }).join("");
  const sessionRows = state.sessions.map((session) => {
    const validLats = (session.latencies || []).filter(l => l !== null);
    const avgLat = validLats.length ? (validLats.reduce((a, b) => a + b, 0) / validLats.length).toFixed(1) + "s" : "--";
    const statusClass = session.status === "COMPLETED" ? (validLats.length > 0 ? "ok" : "danger") : "warn";
    
    const lat1 = session.latencies?.[0] != null ? `${session.latencies[0]}s` : (session.responded?.[0] === 0 ? "Timeout" : "--");
    const lat2 = session.latencies?.[1] != null ? `${session.latencies[1]}s` : (session.responded?.[1] === 0 ? "Timeout" : "--");
    const lat3 = session.latencies?.[2] != null ? `${session.latencies[2]}s` : (session.responded?.[2] === 0 ? "Timeout" : "--");
    
    const b1 = session.responded?.[0] !== null && session.responded?.[0] !== undefined ? session.responded[0] : "--";
    const b2 = session.responded?.[1] !== null && session.responded?.[1] !== undefined ? session.responded[1] : "--";
    const b3 = session.responded?.[2] !== null && session.responded?.[2] !== undefined ? session.responded[2] : "--";
    
    return `
      <tr>
        <td><strong>${escapeHtml(session.participantName)}</strong><small>${escapeHtml(session.participantEmail || "")}</small></td>
        <td>${escapeHtml(session.participantPhone || "")}</td>
        <td>${escapeHtml(session.groupCode)}</td>
        <td>${escapeHtml(session.condition)}</td>
        <td><span class="badge ${statusClass}">${escapeHtml(statusLabel(session))}</span></td>
        <td>${b1}</td>
        <td>${b2}</td>
        <td>${b3}</td>
        <td>${lat1}</td>
        <td>${lat2}</td>
        <td>${lat3}</td>
        <td><strong>${avgLat}</strong></td>
      </tr>
    `;
  }).join("");
  const transcriptCards = state.sessions.map(transcriptMarkup).join("");

  renderFrame(`
    <section class="admin-grid">
      <form class="entry-card" id="groupForm">
        <h2>Create Group Code</h2>
        <label><span>Group name</span><input id="groupName" value="Group 4" required></label>
        <label><span>Creator name</span><input id="creatorName" value="Dr. Maya" required></label>
        <label><span>Permanent group code</span><input id="newCode" value="GROUP4-${Math.random().toString(36).slice(2, 6).toUpperCase()}" required></label>
        <label><span>Bot bystanders</span><input id="bystanderCount" type="number" min="1" max="30" value="10" required></label>
        <label><span>Visible member count</span><input id="memberCount" type="number" min="2" max="40" value="12" required></label>
        <label><span>Awareness cue condition</span><select id="readReceipts"><option value="true">Read receipts visible</option><option value="false">No read receipts</option></select></label>
        <button class="primary-btn" type="submit">Create</button>
      </form>
      <div class="admin-main">
        <div class="admin-toolbar">
          <button class="primary-btn" id="exportCsv">Export CSV</button>
          <button class="secondary-btn" id="syncFirebaseBtn">Push Local Data to Firebase</button>
          <button class="secondary-btn" id="importJsonBtn">Import JSON Backup</button>
          <input type="file" id="importJsonInput" accept=".json" style="display:none">
          <button class="secondary-btn" id="refreshAdmin">Refresh</button>
          <button class="danger-btn" id="clearData">Wipe All Data</button>
        </div>
        <section class="table-card"><h2>Groups</h2><div class="table-wrap"><table><thead><tr><th>Group</th><th>Creator</th><th>Bots</th><th>Condition</th><th>Sessions</th></tr></thead><tbody id="groupTableBody">${groupRows || '<tr><td colspan="5" class="empty">No groups yet.</td></tr>'}</tbody></table></div></section>
        <section class="table-card"><h2>Participant Sessions <small id="fbSyncStatus" style="font-weight:normal;color:var(--green-600);">(Syncing from Firebase...)</small></h2><div class="table-wrap"><table><thead><tr><th>Participant</th><th>Phone</th><th>Group</th><th>Condition</th><th>Status</th><th>B1</th><th>B2</th><th>B3</th><th>Lat 1</th><th>Lat 2</th><th>Lat 3</th><th>Avg</th></tr></thead><tbody id="sessionTableBody">${sessionRows || '<tr><td colspan="12" class="empty">No participant data yet.</td></tr>'}</tbody></table></div></section>
        <section class="table-card"><h2>Chat Transcripts</h2><div class="transcript-list" id="transcriptListBody">${transcriptCards || '<div class="empty">No chats have reached the admin account yet.</div>'}</div></section>
      </div>
    </section>
  `, true);

  if (typeof firebase !== 'undefined') {
    try {
      if (typeof firebase.database === 'function') {
        firebase.database().ref('sessions').on('value', (snapshot) => {
          const data = snapshot.val() || {};
          const allSessions = Object.values(data);
          allSessions.sort((a, b) => b.at ? b.at.localeCompare(a.at) : -1);
          
          const sBody = document.getElementById("sessionTableBody");
          const tBody = document.getElementById("transcriptListBody");
          const sStatus = document.getElementById("fbSyncStatus");
          
          if (sBody) {
            const rows = allSessions.map((session) => {
              const validLats = (session.latencies || []).filter(l => l !== null);
              const avgLat = validLats.length ? (validLats.reduce((a, b) => a + b, 0) / validLats.length).toFixed(1) + "s" : "--";
              const statusClass = session.status === "COMPLETED" ? (validLats.length > 0 ? "ok" : "danger") : "warn";
              
              const lat1 = session.latencies?.[0] != null ? `${session.latencies[0]}s` : (session.responded?.[0] === 0 ? "Timeout" : "--");
              const lat2 = session.latencies?.[1] != null ? `${session.latencies[1]}s` : (session.responded?.[1] === 0 ? "Timeout" : "--");
              const lat3 = session.latencies?.[2] != null ? `${session.latencies[2]}s` : (session.responded?.[2] === 0 ? "Timeout" : "--");
              
              const b1 = session.responded?.[0] !== null && session.responded?.[0] !== undefined ? session.responded[0] : "--";
              const b2 = session.responded?.[1] !== null && session.responded?.[1] !== undefined ? session.responded[1] : "--";
              const b3 = session.responded?.[2] !== null && session.responded?.[2] !== undefined ? session.responded[2] : "--";
              
              return `
                <tr>
                  <td><strong>${escapeHtml(session.participantName)}</strong><small>${escapeHtml(session.participantEmail || "")}</small></td>
                  <td>${escapeHtml(session.participantPhone || "")}</td>
                  <td>${escapeHtml(session.groupCode)}</td>
                  <td>${escapeHtml(session.condition)}</td>
                  <td><span class="badge ${statusClass}">${escapeHtml(statusLabel(session))}</span></td>
                  <td>${b1}</td>
                  <td>${b2}</td>
                  <td>${b3}</td>
                  <td>${lat1}</td>
                  <td>${lat2}</td>
                  <td>${lat3}</td>
                  <td><strong>${avgLat}</strong></td>
                </tr>
              `;
            }).join("");
            sBody.innerHTML = rows || '<tr><td colspan="9" class="empty">No participant data yet.</td></tr>';
          }
          
          if (tBody) {
            const cards = allSessions.map(transcriptMarkup).join("");
            tBody.innerHTML = cards || '<div class="empty">No chats have reached the admin account yet.</div>';
          }
          
          if (sStatus) sStatus.textContent = "(Live Firebase Sync Active)";
        });

        firebase.database().ref('groups').on('value', (snapshot) => {
          const data = snapshot.val() || {};
          const allGroups = Object.values(data);
          const gBody = document.getElementById("groupTableBody");
          if (gBody) {
            const rows = allGroups.map((group) => {
              return `
                <tr>
                  <td><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.code)}</small></td>
                  <td>${escapeHtml(group.creator)}</td>
                  <td>${group.bystanderCount}</td>
                  <td>${group.readReceipts ? '<span class="badge ok">Read receipts</span>' : '<span class="badge warn">No cue</span>'}</td>
                  <td>Synced</td>
                </tr>
              `;
            }).join("");
            gBody.innerHTML = rows || '<tr><td colspan="5" class="empty">No groups yet.</td></tr>';
          }
        });
      }
    } catch (e) {
      console.warn("Firebase Admin dashboard sync failed:", e);
    }
  }

  document.getElementById("groupForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const updated = loadState();
    const groupName = document.getElementById("groupName").value.trim() || "Group 4";
    const group = makeGroup(
      document.getElementById("newCode").value.trim().toUpperCase(),
      groupName,
      document.getElementById("readReceipts").value === "true",
      Number(document.getElementById("bystanderCount").value),
      Number(document.getElementById("memberCount").value)
    );
    group.creator = document.getElementById("creatorName").value.trim() || "Dr. Maya";
    if (!group.code || updated.groups.some((item) => item.code === group.code)) return;
    updated.groups.push(group);
    saveState(updated);
    renderAdminDashboard();
  });
  document.getElementById("exportCsv").addEventListener("click", exportCsv);
  document.getElementById("syncFirebaseBtn").addEventListener("click", () => {
    const state = loadState();
    pushUnsyncedSessionsToFirebase(state);
    alert(`Triggered sync to Firebase for ${state.sessions.length} local session(s).`);
  });

  document.getElementById("importJsonBtn").addEventListener("click", () => {
    document.getElementById("importJsonInput").click();
  });

  document.getElementById("importJsonInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        const state = loadState();
        let addedCount = 0;

        const items = Array.isArray(imported) ? imported : (imported.sessions || imported.users || []);
        items.forEach(item => {
          if (!item) return;
          const sessionId = item.id ? (String(item.id).startsWith("ses_") ? item.id : `ses_imp_${item.id}_${Date.now()}`) : createId("ses");
          if (!state.sessions.some(s => s.id === sessionId || (s.participantEmail && item.email && s.participantEmail === item.email))) {
            const formattedSession = item.participantName ? item : {
              id: sessionId,
              participantName: item.name || "Participant",
              participantPhone: item.phone || "",
              participantEmail: item.email || "",
              groupId: "grp_default",
              groupCode: item.group || "GROUP4",
              groupName: item.group || "Group 4",
              condition: "READ_RECEIPTS_ON",
              status: item.completed ? "COMPLETED" : "NORMAL_CONVERSATION",
              latencies: [item.durationMs ? Number((item.durationMs / 1000).toFixed(1)) : null, null, null],
              responded: [item.q1Answered ? 1 : 0, item.q2Answered ? 1 : 0, item.q3Answered ? 1 : 0],
              messages: []
            };
            state.sessions.push(formattedSession);
            addedCount++;
          }
        });

        if (addedCount > 0) {
          saveState(state);
          pushUnsyncedSessionsToFirebase(state);
          alert(`Successfully imported and queued ${addedCount} data records to Firebase!`);
          renderAdminDashboard();
        } else {
          alert("No new records were added (records may already exist).");
        }
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("refreshAdmin").addEventListener("click", renderAdminDashboard);
  document.getElementById("clearData").addEventListener("click", () => {
    if (confirm("Are you sure you want to wipe ALL data including Firebase? This cannot be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      if (typeof firebase !== 'undefined' && typeof firebase.database === 'function') {
        firebase.database().ref().remove().then(() => {
          window.location.reload();
        }).catch(() => {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }
  });
}

function transcriptMarkup(session) {
  const messages = session.messages.length
    ? session.messages.map((message) => `
      <div class="admin-message ${message.kind === "participant" ? "from-user" : ""}">
        <span>${formatClock(message.at)} · ${escapeHtml(message.sender)}</span>
        <p>${escapeHtml(message.text)}</p>
      </div>
    `).join("")
    : '<div class="empty">No messages yet.</div>';
  return `
    <article class="transcript-card">
      <header>
        <div>
          <strong>${escapeHtml(session.participantName)}</strong>
          <small>${escapeHtml(session.groupCode)} · ${escapeHtml(session.condition)}</small>
        </div>
        <span class="badge ${session.status === "COMPLETED" ? ((session.latencies || []).some(l => l !== null) ? "ok" : "danger") : "warn"}">${escapeHtml(statusLabel(session))}</span>
      </header>
      <div class="admin-chat-log">${messages}</div>
    </article>
  `;
}

function memberListMarkup(session) {
  const participant = { name: session.participantName, role: "you", photo: session.participantPhoto, color: "#128c7e" };
  return [participant, ...bots].slice(0, session.memberCount).map((member) => `
    <div class="member-row">
      ${avatarMarkup(member.name, member.photo || "", "small-avatar", member.color)}
      <span><strong>${escapeHtml(member.name)}</strong><small>${member.role === "creator" ? "Group creator" : member.role === "you" ? "You" : "Member"}</small></span>
    </div>
  `).join("");
}

function avatarMarkup(name, photo = "", className = "avatar", color = "") {
  const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "G";
  if (photo) return `<span class="${className} avatar-img"><img src="${escapeHtml(photo)}" alt=""></span>`;
  const style = color ? ` style="background:${escapeHtml(color)}"` : "";
  return `<span class="${className}"${style}>${escapeHtml(initials)}</span>`;
}

function findMemberColor(name) {
  return bots.find((member) => member.name === name)?.color || "#128c7e";
}

function startCountdown(sessionId) {
  if (countdownTimer) clearInterval(countdownTimer);
  const timer = document.getElementById("timer");
  if (!timer) return;
  countdownTimer = setInterval(() => {
    const session = loadState().sessions.find((item) => item.id === sessionId);
    if (!session || !session.timeoutDeadline || session.status === "COMPLETED") {
      clearInterval(countdownTimer);
      return;
    }
    const remaining = Math.max(0, new Date(session.timeoutDeadline) - new Date());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, 250);
}

function logEvent(sessionId, type, details = {}) {
  const state = loadState();
  state.events.push({ id: createId("evt"), sessionId, type, details, timestamp: new Date().toISOString() });
  saveState(state);
}

function exportCsv() {
  const state = loadState();
  const header = ["participant_name", "phone", "email", "group_code", "condition", "responded_1", "responded_2", "responded_3", "latency_1", "latency_2", "latency_3", "avg_latency", "entry_time", "completed_at"];
  const rows = state.sessions.map((session) => {
    const validLats = (session.latencies || []).filter(l => l !== null);
    const avgLat = validLats.length ? (validLats.reduce((a, b) => a + b, 0) / validLats.length).toFixed(1) : "";
    return [
      session.participantName,
      session.participantPhone,
      session.participantEmail,
      session.groupCode,
      session.condition,
      session.responded?.[0],
      session.responded?.[1],
      session.responded?.[2],
      session.latencies?.[0],
      session.latencies?.[1],
      session.latencies?.[2],
      avgLat,
      session.entryTime,
      session.completedAt
    ].map(csvCell);
  });
  const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `digital-bystander-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function statusLabel(session) {
  if (session.status === "COMPLETED") {
    const validLats = (session.latencies || []).filter(l => l !== null);
    if (validLats.length > 0) {
      const avgLat = (validLats.reduce((a, b) => a + b, 0) / validLats.length).toFixed(1);
      return `Responded (Avg ${avgLat}s)`;
    }
    return "Did not respond in time";
  }
  return session.status;
}

function formatClock(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function checkInitialRoute() {
  if (window.location.hash === "#admin" || window.location.search.includes("admin")) {
    if (sessionStorage.getItem("study_admin") === "true") {
      renderAdminDashboard();
    } else {
      renderAdminLogin();
    }
  } else {
    renderOnboarding();
  }
}

window.addEventListener("hashchange", checkInitialRoute);
checkInitialRoute();
