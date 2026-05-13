// @ts-check
require('reflect-metadata');
const startupLog = (milestone) => console.debug(`Frontend: ${milestone} [${(performance.now() / 1000).toFixed(3)} s since frontend page start]`);
startupLog('loading modules...');
const { Container } = require('@theia/core/shared/inversify');
const { FrontendApplicationConfigProvider } = require('@theia/core/lib/browser/frontend-application-config-provider');

FrontendApplicationConfigProvider.set({
    "applicationName": "NC-Edit7",
    "defaultTheme": {
        "light": "light",
        "dark": "dark"
    },
    "defaultIconTheme": "theia-file-icons",
    "electron": {
        "windowOptions": {},
        "showWindowEarly": true,
        "splashScreenOptions": {},
        "uriScheme": "theia"
    },
    "defaultLocale": "",
    "validatePreferencesSchema": true,
    "reloadOnReconnect": false,
    "uriScheme": "theia"
});


self.MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
        return './editor.worker.js';
    }
}

function load(container, jsModule) {
    return Promise.resolve(jsModule)
        .then(containerModule => container.load(containerModule.default));
}

async function preload(container) {
    try {
        await load(container, require('@theia/core/lib/browser/preload/preload-module'));
        const { Preloader } = require('@theia/core/lib/browser/preload/preloader');
        const preloader = container.get(Preloader);
        await preloader.initialize();
    } catch (reason) {
        console.error('Failed to run preload scripts.');
        if (reason) {
            console.error(reason);
        }
    }
}

module.exports = (async () => {
    const { messagingFrontendModule } = require('@theia/core/lib/electron-browser/messaging/electron-messaging-frontend-module');
    const container = new Container();
    container.load(messagingFrontendModule);
    

    startupLog('container created');

    await preload(container);
    startupLog('preloaded');

    
    const { MonacoInit } = require('@theia/monaco/lib/browser/monaco-init');
    ;

    const { FrontendApplication } = require('@theia/core/lib/browser');
    const { frontendApplicationModule } = require('@theia/core/lib/browser/frontend-application-module');
    const { loggerFrontendModule } = require('@theia/core/lib/browser/logger-frontend-module');

    container.load(frontendApplicationModule);
    undefined

    container.load(loggerFrontendModule);
    

    startupLog('core modules loaded');

    try {
        await load(container, require('@theia/core/lib/browser/i18n/i18n-frontend-module'));
        await load(container, require('@theia/core/lib/electron-browser/menu/electron-menu-module'));
        await load(container, require('@theia/core/lib/electron-browser/window/electron-window-module'));
        await load(container, require('@theia/core/lib/electron-browser/keyboard/electron-keyboard-module'));
        await load(container, require('@theia/core/lib/electron-browser/token/electron-token-frontend-module'));
        await load(container, require('@theia/core/lib/electron-browser/request/electron-browser-request-module'));
        await load(container, require('@theia/variable-resolver/lib/browser/variable-resolver-frontend-module'));
        await load(container, require('@theia/editor/lib/browser/editor-frontend-module'));
        await load(container, require('@theia/filesystem/lib/browser/filesystem-frontend-module'));
        await load(container, require('@theia/filesystem/lib/browser/download/file-download-frontend-module'));
        await load(container, require('@theia/filesystem/lib/browser/file-dialog/file-dialog-module'));
        await load(container, require('@theia/filesystem/lib/electron-browser/file-dialog/electron-file-dialog-module'));
        await load(container, require('@theia/workspace/lib/browser/workspace-frontend-module'));
        await load(container, require('@theia/markers/lib/browser/problem/problem-frontend-module'));
        await load(container, require('@theia/outline-view/lib/browser/outline-view-frontend-module'));
        await load(container, require('@theia/monaco/lib/browser/monaco-frontend-module'));
        await load(container, require('@theia/navigator/lib/browser/navigator-frontend-module'));
        await load(container, require('@theia/navigator/lib/electron-browser/electron-navigator-module'));
        await load(container, require('@theia/output/lib/browser/output-frontend-module'));
        await load(container, require('@theia/ai-core/lib/browser/ai-core-frontend-module'));
        await load(container, require('@theia/ai-mcp/lib/browser/mcp-frontend-module'));
        await load(container, require('@theia/bulk-edit/lib/browser/bulk-edit-frontend-module'));
        await load(container, require('@theia/callhierarchy/lib/browser/callhierarchy-frontend-module'));
        await load(container, require('@theia/console/lib/browser/console-frontend-module'));
        await load(container, require('@theia/process/lib/common/process-common-module'));
        await load(container, require('@theia/file-search/lib/browser/file-search-frontend-module'));
        await load(container, require('@theia/terminal/lib/browser/terminal-frontend-module'));
        await load(container, require('@theia/userstorage/lib/browser/user-storage-frontend-module'));
        await load(container, require('@theia/preferences/lib/browser/preference-frontend-module'));
        await load(container, require('@theia/terminal-manager/lib/browser/terminal-manager-frontend-module'));
        await load(container, require('@theia/task/lib/browser/task-frontend-module'));
        await load(container, require('@theia/test/lib/browser/view/test-view-frontend-module'));
        await load(container, require('@theia/debug/lib/browser/debug-frontend-module'));
        await load(container, require('@theia/editor-preview/lib/browser/editor-preview-frontend-module'));
        await load(container, require('@theia/messages/lib/browser/messages-frontend-module'));
        await load(container, require('@theia/notebook/lib/browser/notebook-frontend-module'));
        await load(container, require('@theia/scm/lib/browser/scm-frontend-module'));
        await load(container, require('@theia/search-in-workspace/lib/browser/search-in-workspace-frontend-module'));
        await load(container, require('@theia/timeline/lib/browser/timeline-frontend-module'));
        await load(container, require('@theia/typehierarchy/lib/browser/typehierarchy-frontend-module'));
        await load(container, require('@theia/plugin-ext/lib/plugin-ext-frontend-module'));
        await load(container, require('@theia/plugin-ext/lib/plugin-ext-frontend-electron-module'));
        await load(container, require('@theia/plugin-ext-vscode/lib/browser/plugin-vscode-frontend-module'));
        
        MonacoInit.init(container);
        ;
        startupLog('modules loaded');
        await start();
    } catch (reason) {
        console.error('Failed to start the frontend application.');
        if (reason) {
            console.error(reason);
        }
    }

    function start() {
        (window['theia'] = window['theia'] || {}).container = container;
        startupLog('resolving application');
        const application = container.get(FrontendApplication);
        startupLog('application resolved');
        return application.start();
    }
})();
