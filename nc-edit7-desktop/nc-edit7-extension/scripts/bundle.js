const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../../');
const extensionDir = path.resolve(__dirname, '../');
const bundleDir = path.join(extensionDir, 'bundle');

// Folders to bundle
const foldersToBundle = [
    { src: path.join(rootDir, 'dist'), dest: path.join(bundleDir, 'dist') },
    { src: path.join(rootDir, 'backend'), dest: path.join(bundleDir, 'backend') },
    { src: path.join(rootDir, 'ncplot7py'), dest: path.join(bundleDir, 'ncplot7py') },
    { src: path.join(rootDir, 'nc-edit7-desktop', 'python_embedded'), dest: path.join(bundleDir, 'python_embedded') }
];

// Helper to copy
function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        const stat = fs.lstatSync(path.join(from, element));
        if (stat.isFile()) {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        } else if (stat.isSymbolicLink()) {
            fs.symlinkSync(fs.readlinkSync(path.join(from, element)), path.join(to, element));
        } else if (stat.isDirectory()) {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

console.log('Bundling assets for self-contained extension...');
if (fs.existsSync(bundleDir)) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

foldersToBundle.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
        console.log(`Copying ${src} -> ${dest}`);
        copyFolderSync(src, dest);
    } else {
        console.warn(`Warning: Could not find ${src}`);
    }
});

console.log('Bundle complete.');
