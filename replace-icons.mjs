import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directory = path.join(__dirname, 'src', 'app', '(dashboard)');

const emojiMap = {
  '🏨': { component: 'Hotel', size: 24 },
  '🍽️': { component: 'UtensilsCrossed', size: 24 },
  '💰': { component: 'Banknote', size: 24 },
  '🧾': { component: 'Receipt', size: 24 },
  '⚡': { component: 'Zap', size: 24 },
  '📊': { component: 'BarChart3', size: 24 },
  '📈': { component: 'TrendingUp', size: 24 },
  '📉': { component: 'TrendingDown', size: 24 },
  '📅': { component: 'CalendarDays', size: 24 },
  '⚙️': { component: 'Settings', size: 24 },
  '👥': { component: 'Users', size: 24 },
  '📋': { component: 'ClipboardList', size: 24 },
  '🗑': { component: 'Trash2', size: 16 }
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let componentsToImport = new Set();

  // Handle emptyIcon="..." 
  content = content.replace(/emptyIcon="([^"]+)"/g, (match, iconStr) => {
    // some icons like 👥 might be embedded. Let's find it in map.
    const iconKey = Object.keys(emojiMap).find(k => k === iconStr || iconStr.includes(k));
    if (iconKey) {
      const { component, size } = emojiMap[iconKey];
      componentsToImport.add(component);
      return `emptyIcon={<${component} size={48} className="opacity-50" />}`;
    }
    return match;
  });

  // Handle >emoji< inside spans/divs
  content = content.replace(/>([^<]+)</g, (match, text) => {
    let newText = text;
    for (const [emoji, info] of Object.entries(emojiMap)) {
      if (newText.includes(emoji)) {
        componentsToImport.add(info.component);
        // Replace emoji with component. Because it might be mixed with text, wrap in span if needed.
        // For simplicity, if it's exact match, replace with JSX. If mixed, use {<Icon/>} inline.
        // Since it's in JSX like > 🏨 New Check-In <, we can do:
        // > <Hotel className="inline mr-2" size={20}/> New Check-In <
        if (newText.trim() === emoji) {
          newText = text.replace(emoji, `<${info.component} size={${info.size}}/>`);
        } else {
          newText = text.replace(emoji, `<${info.component} className="inline-block mr-2" size={${info.size === 24 ? 20 : info.size}}/>`);
        }
      }
    }
    return `>${newText}<`;
  });

  if (content !== originalContent && componentsToImport.size > 0) {
    const importStatement = `import { ${Array.from(componentsToImport).join(', ')} } from "lucide-react";\n`;
    
    // Add import after the last import statement
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfLastImport = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfLastImport + 1) + importStatement + content.slice(endOfLastImport + 1);
    } else {
      content = importStatement + content;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(directory);
console.log('Done.');
