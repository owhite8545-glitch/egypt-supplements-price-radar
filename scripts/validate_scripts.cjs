const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const scriptRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/gi;
let m;
let i = 0;
while ((m = scriptRegex.exec(html)) !== null) {
  i++;
  const attrs = m[1].trim();
  const code = m[2];
  console.log(`Script ${i}: attrs = "${attrs}", inner length = ${code.length}`);
  if (code.trim() && !attrs.includes('src=')) {
    try {
      new vm.Script(code);
      console.log(`  -> Script ${i} compiled successfully without errors!`);
    } catch(err) {
      console.error(`  -> ERROR in Script ${i}:`, err.message);
      process.exit(1);
    }
  }
}
