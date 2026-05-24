const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'app/(app)/messages/page.tsx');
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  // Backgrounds
  [/'#0b141a'/g, "'var(--bg-primary)'"],
  [/'#111b21'/g, "'var(--bg-card)'"],
  [/'#202c33'/g, "'var(--bg-elevated)'"],
  [/'#2a3942'/g, "'var(--bg-hover)'"],
  [/'#222e35'/g, "'var(--bg-elevated)'"],
  [/"#111b21"/g, '"var(--bg-card)"'],
  [/"#0b141a"/g, '"var(--bg-primary)"'],

  // Borders
  [/'#222d34'/g, "'var(--border-subtle)'"],
  [/'#313d45'/g, "'var(--border)'"],

  // Text
  [/'#e9edef'/g, "'var(--text-1)'"],
  [/'#8696a0'/g, "'var(--text-2)'"],
  [/'#aebac1'/g, "'var(--text-3)'"],
  [/'#d1d7db'/g, "'var(--text-2)'"],
  [/'#6b7c85'/g, "'var(--text-3)'"],

  // Accents
  [/'#00a884'/g, "'var(--accent)'"],
  [/'#005c4b'/g, "'var(--accent)'"], 
  [/'#182229'/g, "'var(--bg-card)'"], 
  [/'#3b4a54'/g, "'var(--bg-elevated)'"], 
  [/'#233138'/g, "'var(--bg-elevated)'"], 
  [/'#025144'/g, "'var(--accent)'"],

  // Gradients
  [/'linear-gradient\\(to right, transparent, #005c4b 20%\\)'/g, "'linear-gradient(to right, transparent, var(--accent) 20%)'"],
  [/'linear-gradient\\(to right, transparent, #202c33 20%\\)'/g, "'linear-gradient(to right, transparent, var(--bg-elevated) 20%)'"],
  [/'linear-gradient\\(180deg, #202c33 0%, #111b21 100%\\)'/g, "'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-card) 100%)'"],

  // Shadows/Backdrops
  [/'rgba\\(11,20,26,0\\.85\\)'/g, "'rgba(0,0,0,0.6)'"],
  [/'rgba\\(11,20,26,\\.26\\)'/g, "'rgba(0,0,0,0.3)'"],
  [/'rgba\\(11,20,26,\\.16\\)'/g, "'rgba(0,0,0,0.2)'"],
  [/'rgba\\(11,20,26,\\.13\\)'/g, "'rgba(0,0,0,0.1)'"],
  [/'rgba\\(11,20,26,\\.19\\)'/g, "'rgba(0,0,0,0.25)'"],
  [/'rgba\\(11,20,26,\\.24\\)'/g, "'rgba(0,0,0,0.3)'"],
];

for (const [regex, replacement] of replacements) {
  content = content.replace(regex, replacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Replaced colors successfully!');
