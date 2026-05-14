const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../../');
const extensionDir = path.resolve(__dirname, '../');
const bundleDir = path.join(extensionDir, 'bundle');
const filesToBundle = [
    {
        src: path.join(rootDir, 'THIRD_PARTY_NODE_LICENSES.md'),
        dest: path.join(extensionDir, 'THIRD_PARTY_NODE_LICENSES.md')
    },
    {
        src: path.join(rootDir, 'nc-edit7-desktop', 'THIRD_PARTY_PYTHON_LICENSES.md'),
        dest: path.join(extensionDir, 'THIRD_PARTY_PYTHON_LICENSES.md')
    }
];

// Folders to bundle
const foldersToBundle = [
    { src: path.join(rootDir, 'dist'), dest: path.join(bundleDir, 'dist') },
    { src: path.join(rootDir, 'backend'), dest: path.join(bundleDir, 'backend') },
    { src: path.join(rootDir, 'nc-edit7-desktop', 'python_embedded'), dest: path.join(bundleDir, 'python_embedded') }
];

// Helper to copy
function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        const stat = fs.lstatSync(path.join(from, element));
        if (stat.isFile()) {
            try {
                fs.copyFileSync(path.join(from, element), path.join(to, element));
            } catch (error) {
                console.warn(`Warning: Failed to copy file ${path.join(from, element)} -> ${path.join(to, element)}: ${error.message}`);
            }
        } else if (stat.isSymbolicLink()) {
            try {
                fs.symlinkSync(fs.readlinkSync(path.join(from, element)), path.join(to, element));
            } catch (error) {
                console.warn(`Warning: Failed to copy symlink ${path.join(from, element)} -> ${path.join(to, element)}: ${error.message}`);
            }
        } else if (stat.isDirectory()) {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

console.log('Bundling assets for self-contained extension...');
if (fs.existsSync(bundleDir)) {
    try {
        fs.rmSync(bundleDir, { recursive: true, force: true });
    } catch (error) {
        console.warn(`Warning: Failed to remove existing bundle directory, continuing with in-place update: ${error.message}`);
    }
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

filesToBundle.forEach(({ src, dest }) => {
    if (fs.existsSync(src)) {
        console.log(`Copying ${src} -> ${dest}`);
        fs.copyFileSync(src, dest);
    } else {
        console.warn(`Warning: Could not find ${src}`);
    }
});

const bundledPth = path.join(bundleDir, 'python_embedded', 'python311._pth');
/* Removed ncplot7py pth rewriting as it is now installed via pip */

console.log('Bundle complete.');
