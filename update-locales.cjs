const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'client', 'src', 'locales');
const filesToUpdate = ['de.js', 'es.js', 'fa.js', 'it.js', 'ru.js', 'zh-cn.js'];

const newKeys = `
  "MongoDB AI": "MongoDB AI",
  "Gemini Active": "Gemini Active",
  "Clear Chat Logs": "Clear Chat Logs",
  "Close": "Close",
  "Welcome to MongoDB AI": "Welcome to MongoDB AI",
  "I can help you query, aggregate, insert, index, or analyze MongoDB data using natural language chat.": "I can help you query, aggregate, insert, index, or analyze MongoDB data using natural language chat.",
  "Type instructions ...": "Type instructions ...",
  "Web Speech recognition is not supported in this browser.": "Web Speech recognition is not supported in this browser.",
  "Listening... Speak into your microphone.": "Listening... Speak into your microphone.",
  "Voice recognition error.": "Voice recognition error.",
  "Voice transcribed successfully!": "Voice transcribed successfully!",
  "Failed to communicate with AI Copilot.": "Failed to communicate with AI Copilot.",
  "Chat history cleared.": "Chat history cleared.",
  "Failed to clear logs.": "Failed to clear logs."
};`;

filesToUpdate.forEach(file => {
  const filePath = path.join(localesDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace the last `};` with the new keys
    content = content.replace(/};\s*$/, ',\n' + newKeys);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
