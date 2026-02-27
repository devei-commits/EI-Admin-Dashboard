const fs = require('fs');
const path = require('path');

const dir = 'src/components/ordermanagementcomp';

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Changing border-amber-* which were missed in previous global search
    content = content.replace(/border-amber-300/g, 'border-slate-600');
    content = content.replace(/border-amber-400/g, 'border-slate-500');
    content = content.replace(/border-amber-200/g, 'border-slate-400');

    // Buttons with amber backgrounds
    content = content.replace(/bg-amber-400/g, 'bg-slate-700');

    // Action bar inputs adjustments to look good on slate-800 bg
    // We need to target the placeholder and input classes
    // specifically search inputs
    content = content.replace(/className="w-full px-3 py-2 border border-slate-600 rounded-lg text-sm focus:outline-none(.*)"/g, 'className="w-full px-3 py-2 bg-slate-900/50 text-slate-100 placeholder-slate-400 border border-slate-600 rounded-lg text-sm focus:outline-none$1"');

    content = content.replace(/className="px-2 py-1 border border-slate-600 rounded text-sm focus:outline-none(.*)"/g, 'className="px-2 py-1 bg-slate-900/50 text-slate-100 border border-slate-600 rounded text-sm focus:outline-none$1"');

    // Text colors on the dark bg table header bar (where "Show: X entries")
    content = content.replace(/text-gray-700/g, 'text-slate-300');
    content = content.replace(/text-gray-600/g, 'text-slate-400');
    content = content.replace(/text-gray-500/g, 'text-slate-500');

    // The table body alternating colors
    content = content.replace(/bg-gray-50/g, 'bg-slate-50');

    fs.writeFileSync(filePath, content);
}

fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.tsx')) {
        processFile(path.join(dir, file));
    }
});

processFile('src/pages/OrderHub.tsx');
processFile('src/pages/TaskManagement.tsx');
processFile('src/pages/UserManagement.tsx');

console.log('Fixed Order Hub styles.');
