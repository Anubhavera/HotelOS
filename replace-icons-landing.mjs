import fs from 'fs';

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
  '📱': { component: 'Smartphone', size: 24 },
  '🔒': { component: 'Lock', size: 24 },
  '❤️': { component: 'Heart', size: 16 },
  '🚀': { component: 'Rocket', size: 20 },
};

let content = fs.readFileSync('src/app/page.tsx', 'utf8');
let originalContent = content;
let componentsToImport = new Set();

content = content.replace(/icon:\s*["']([^"']+)["']/g, (match, iconStr) => {
    let newStr = iconStr;
    Object.entries(emojiMap).forEach(([emoji, info]) => {
        if(iconStr.includes(emoji)) {
            componentsToImport.add(info.component);
            newStr = iconStr.replace(emoji, `<${info.component} size={24} className="text-primary" />`);
        }
    });
    return `icon: ${newStr !== iconStr ? newStr : '"'+iconStr+'"'}`;
});

content = content.replace(/>([^<]+)</g, (match, text) => {
    let newText = text;
    for (const [emoji, info] of Object.entries(emojiMap)) {
      if (newText.includes(emoji)) {
        componentsToImport.add(info.component);
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
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfLastImport = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, endOfLastImport + 1) + importStatement + content.slice(endOfLastImport + 1);
    } else {
      content = importStatement + content;
    }
    fs.writeFileSync('src/app/page.tsx', content, 'utf8');
    console.log('Updated src/app/page.tsx');
}
