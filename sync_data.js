const fs = require('fs');
const https = require('https');
const path = require('path');

const FIREBASE_DB_URL = "https://psychology-5d4e1-default-rtdb.firebaseio.com";

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

function putFirebase(endpointPath, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FIREBASE_DB_URL}/${endpointPath}.json`);
    const payload = JSON.stringify(cleanForFirebase(data));

    const req = https.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body || '{}'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const targetFile = process.argv[2] || path.join(__dirname, 'test_results_40_users.json');

  if (!fs.existsSync(targetFile)) {
    console.log(`[Info] No file found at ${targetFile}. Standard app auto-sync is active in app.js.`);
    return;
  }

  console.log(`[Sync] Reading local data from ${targetFile}...`);
  const raw = fs.readFileSync(targetFile, 'utf8');
  const parsed = JSON.parse(raw);

  const items = Array.isArray(parsed) ? parsed : (parsed.sessions || parsed.users || []);
  console.log(`[Sync] Found ${items.length} records to sync to Firebase.`);

  let successCount = 0;
  for (const item of items) {
    const id = item.id ? (String(item.id).startsWith("ses_") ? item.id : `ses_imp_${item.id}`) : `ses_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sessionRecord = item.participantName ? item : {
      id,
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

    try {
      await putFirebase(`sessions/${id}`, sessionRecord);
      successCount++;
    } catch (e) {
      console.warn(`[Warning] Could not sync record ${id}: ${e.message}`);
    }
  }

  console.log(`[Success] Synced ${successCount}/${items.length} records safely to Firebase!`);
}

main().catch(err => {
  console.error("[Error] Sync script encountered an error:", err.message);
});
