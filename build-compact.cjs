// Rebuild the standalone local fork: node build-compact.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const out = path.join(root, 'raptor-compact');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
let html = read('index.html');
const scripts = [];
html = html.replace(/<link\b[^>]*href="([^"?]+\.css)(?:\?[^" ]*)?"[^>]*>/g,
  (_, name) => `<style>\n/* ${name} */\n${read(name)}\n</style>`);
html = html.replace(/<script\b[^>]*src="([^"?]+\.js)(?:\?[^" ]*)?"[^>]*><\/script>/g,
  (_, name) => {
    let source = read(name);
    if (name === 'raptor-pet.js') {
      const sprite = fs.readFileSync(path.join(root, 'raptor-cutout.png')).toString('base64');
      source = source.replace(/(['"])raptor-cutout\.png(?:\?[^'"]*)?\1/g,
        JSON.stringify('data:image/png;base64,' + sprite));
    }
    if (name === 'raptor-ai.js') {
      source = source.replace(/\bkey\s*:\s*(['"])sk-[^'"]+\1/g, "key: ''");
      source = source.replace(/^.*\/\/.*(?:вшит|вшиты|Ключ вшит).*$/gm,
        '  // Compact fork: enter your own API key in the AI panel.');
    }
    scripts.push(`\n;\n// ===== ${name} =====\n${source}\n`);
    return scripts.length === 1 ? '<script src="app.js"></script>' : '';
  });
// Run the bundle where the last original external script ran. All DOM is
// already present; following inline scripts still execute after the bundle.
html = html.replace('<script src="app.js"></script>', '');
const inline = html.lastIndexOf('<script>');
if (inline < 0) throw new Error('Expected trailing inline initialization');
html = html.slice(0, inline) + '<script src="app.js"></script>\n' + html.slice(inline);
if (/\b(?:src|href)="[^"\s]+\.(?:css|png)(?:\?[^" ]*)?"/.test(html)) {
  throw new Error('Unbundled HTML asset');
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'app.js'), scripts.join(''));
fs.writeFileSync(path.join(out, 'llm-proxy.js'), read('llm-proxy.js'));
console.log(`Built ${scripts.length} scripts into ${out} (3 files)`);
