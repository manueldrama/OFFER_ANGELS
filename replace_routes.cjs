const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    // match string literals starting exactly with /angels
    // e.g. '/angels', "/angels/login", `/angels/${id}`
    content = content.replace(/(['"`])\/angels\/?(.*?)(\1)/g, (match, quote, rest) => {
        return quote + '/' + rest + quote;
    });

    if (content !== original) {
        fs.writeFileSync(f, content, 'utf8');
        console.log('Updated ' + f);
    }
});
