const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const lines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    if (key) process.env[key] = val;
  }
}

const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
  console.log("Listing models...");
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    console.log("Available models:");
    data.models.forEach(m => {
      console.log(`- ${m.name} (displayName: ${m.displayName}, protocols: ${m.supportedGenerationMethods.join(', ')})`);
    });
  } catch (err) {
    console.error("Failed to list models:", err);
  }
}

listModels();
