const fs = require('fs');
const os = require('os');
const path = require('path');

function detectLanIp() {
  const interfaces = os.networkInterfaces();
  const preferred = ['en0', 'en1', 'Ethernet', 'Wi-Fi'];

  for (const name of preferred) {
    const entries = interfaces[name] || [];
    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  throw new Error('Could not detect a LAN IPv4 address');
}

const ip = process.env.METRO_HOST || detectLanIp();
const plistPath = path.join(__dirname, '..', 'ios', 'VibeVoiceNative', 'Info.plist');
const plist = fs.readFileSync(plistPath, 'utf8');

const metroKey = '<key>MetroHost</key>';
const metroIndex = plist.indexOf(metroKey);

if (metroIndex === -1) {
  throw new Error('Could not find MetroHost entry in Info.plist');
}

const stringStart = plist.indexOf('<string>', metroIndex);
const stringEnd = plist.indexOf('</string>', stringStart);

if (stringStart === -1 || stringEnd === -1) {
  throw new Error('Could not parse MetroHost string in Info.plist');
}

const updated =
  plist.slice(0, stringStart) +
  `<string>${ip}</string>` +
  plist.slice(stringEnd + '</string>'.length);

fs.writeFileSync(plistPath, updated);
console.log(`Updated MetroHost to ${ip}`);
