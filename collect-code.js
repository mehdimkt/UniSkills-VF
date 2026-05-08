import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossiers à ignorer
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', 'storage', 'electron'];
const ignoreFiles = ['package-lock.json', 'yarn.lock', 'collect-code.js', 'code-complet.txt'];

// Extensions à inclure
const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.html', '.py'];

let output = '=' .repeat(80) + '\n';
output += '📁 STRUCTURE DU PROJET\n';
output += '=' .repeat(80) + '\n\n';

// Fonction pour lister la structure
function getTree(dir, prefix = '') {
  let tree = '';
  
  if (!fs.existsSync(dir)) return tree;
  
  const items = fs.readdirSync(dir);
  
  // Filtrer les dossiers ignorés
  const filtered = items.filter(item => !ignoreDirs.includes(item));
  
  filtered.forEach((item, index) => {
    const fullPath = path.join(dir, item);
    const isLast = index === filtered.length - 1;
    
    try {
      const isDirectory = fs.statSync(fullPath).isDirectory();
      
      if (isDirectory && !ignoreDirs.includes(item)) {
        tree += `${prefix}${isLast ? '└── ' : '├── '}📁 ${item}/\n`;
        tree += getTree(fullPath, `${prefix}${isLast ? '    ' : '│   '}`);
      } else if (!ignoreFiles.includes(item)) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          tree += `${prefix}${isLast ? '└── ' : '├── '}📄 ${item}\n`;
        }
      }
    } catch (err) {
      console.error(`Erreur lecture ${fullPath}:`, err.message);
    }
  });
  
  return tree;
}

// Générer l'arborescence
output += getTree(__dirname);
output += '\n\n';

output += '=' .repeat(80) + '\n';
output += '📝 CONTENU DES FICHIERS IMPORTANTS\n';
output += '=' .repeat(80) + '\n\n';

// Fonction pour lire les fichiers
function readFiles(dir) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    if (ignoreDirs.includes(item)) continue;
    
    const fullPath = path.join(dir, item);
    
    try {
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        readFiles(fullPath);
      } else {
        const ext = path.extname(item);
        if (extensions.includes(ext) && !ignoreFiles.includes(item)) {
          // Ignorer les fichiers de build et cache
          if (fullPath.includes('.next') || fullPath.includes('dist') || fullPath.includes('__pycache__')) return;
          if (fullPath.includes('.vite') || fullPath.includes('cache')) return;
          
          output += '\n' + '─'.repeat(80) + '\n';
          output += `📄 FICHIER: ${fullPath.replace(__dirname, '.')}\n`;
          output += '─'.repeat(80) + '\n\n';
          
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            output += content + '\n';
          } catch (err) {
            output += `❌ Erreur de lecture: ${err.message}\n`;
          }
        }
      }
    } catch (err) {
      console.error(`Erreur accès ${fullPath}:`, err.message);
    }
  }
}

readFiles(__dirname);

// Sauvegarder dans un fichier
const outputFile = 'code-complet.txt';
fs.writeFileSync(outputFile, output);

console.log(`✅ Code rassemblé dans ${outputFile}`);
console.log(`📊 Taille: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
console.log('\n📋 Copie-colle le contenu de ce fichier pour me l\'envoyer');