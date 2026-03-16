/**
 * Test setup: provides a localStorage mock and helpers for loading IIFE modules.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createContext, runInContext } from 'vm';

export function createLocalStorageMock() {
    const store = {};
    return {
        getItem: (key) => store[key] ?? null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); },
        _store: store,
    };
}

/**
 * Load one or more IIFE modules into a shared sandbox context.
 * Returns the sandbox object — access modules via sandbox.ModuleName.
 *
 * Because the source files use `const ModuleName = ...`, which doesn't
 * leak to the sandbox in vm, we rewrite `const ModuleName` to
 * `this.ModuleName` at the top level.
 */
export function loadModules(...filePaths) {
    const storage = createLocalStorageMock();

    const sandbox = {
        localStorage: storage,
        console: { error: () => {}, log: () => {}, warn: () => {} },
        Sync: undefined,
        Date: globalThis.Date,
        Math: globalThis.Math,
        Object: globalThis.Object,
        Array: globalThis.Array,
        String: globalThis.String,
        Number: globalThis.Number,
        parseInt: globalThis.parseInt,
        parseFloat: globalThis.parseFloat,
        isNaN: globalThis.isNaN,
        JSON: globalThis.JSON,
        Promise: globalThis.Promise,
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
        firebase: undefined,
    };

    const ctx = createContext(sandbox);

    for (const fp of filePaths) {
        const fullPath = resolve(fp);
        let code = readFileSync(fullPath, 'utf-8');
        // Replace top-level `const ModuleName = (` with `this.ModuleName = (`
        // This makes the IIFE result accessible on the sandbox
        code = code.replace(/^const\s+(\w+)\s*=\s*\(/m, 'this.$1 = (');
        // Also handle top-level functions like `function formatDateNL(...)`
        code = code.replace(/^function\s+(\w+)\s*\(/gm, 'this.$1 = function $1(');
        runInContext(code, ctx, { filename: fullPath });
    }

    return sandbox;
}
