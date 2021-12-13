import { Events } from 'jellyfin-apiclient';
import ServerConnections from '../../components/ServerConnections';
import set from '../../dset';
import page from 'page';

const usePromise = () => {
    let outResolve;
    let outReject;
    const promise = new Promise((resolve, reject) => {
        outResolve = resolve;
        outReject = reject;
    });
    return [promise, outResolve, outReject];
};

const hookKeys = ['appInitialized'];
export class LoadScripts {
    name = 'Jellyfin xposed plugin';
    type = '';
    id = 'xposed';
    priority = 1;

    hooks = {};

    registerHook(script, key, hook) {
        if (!this.hooks[key]) {
            this.hooks[key] = [];
        }
        this.hooks[key].push({
            script,
            hook
        });
    }

    runHooks(key, ...params) {
        console.log(`[xposed] running ${key} hooks`);
        if (this.hooks[key]) {
            for (const { script, hook } of this.hooks[key]) {
                try {
                    console.debug(`[xposed] running ${key} hooks for ${script}`);
                    hook(...params);
                } catch (e) {
                    console.error(`[xposed] error running ${key} hooks for ${script}`);
                    console.error(e);
                }
            }
        }
    }

    async loadModule(script) {
        try {
            console.log(`[xposed] loading module ${script}`);
            const module = await import(/* webpackIgnore: true*/ script);
            if (module?.default) {
                if (typeof module?.default === 'function') {
                    this.registerHook(script, 'appInitialized', module.default);
                } else {
                    for (const key of hookKeys) {
                        if (module.default[key]) {
                            this.registerHook(script, key, module.default[key]);
                        }
                    }
                }
            }
            console.log(`[xposed] loaded module ${script}`);
        } catch (e) {
            console.error(`[xposed] failed loading module ${script}:`);
            console.error(e);
        }
    }

    async loadScript(script) {
        try {
            console.log(`[xposed] loading script ${script}`);
            await new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = script;
                el.onload = () => resolve();
                el.onerror = (event) => reject(event);
                document.head.appendChild(el);
            });
            console.log(`[xposed] loaded script ${script}`);
        } catch (e) {
            console.error(`[xposed] failed loading script ${script}:`);
            console.error(e);
        }
    }

    async load() {
        const resp = await fetch('config.json');
        const config = await resp.json();
        await Promise.all([
            ...(config.loadModules ?? [])
                .map(this.loadModule.bind(this)),
            ...(config.loadScripts ?? [])
                .map(this.loadScript.bind(this)),
        ]);
        this.allLoadedResolve();
    }

    constructor() {
        // modules that are useful but not exposed by babel plugin
        set(window, 'Xp.Events', Events);
        set(window, 'Xp.page', page);

        const [allLoadedPromise, allLoadedResolve] = usePromise();
        this.allLoadedPromise = allLoadedPromise;
        this.allLoadedResolve = allLoadedResolve;
        const [appInitializedPromise, appInitializedResolve] = usePromise();
        this.appInitializedPromise = appInitializedPromise;
        this.appInitializedResolve = appInitializedResolve;

        // register /xposed/ route to prevent jumping back
        page('/xposed/*', async (ctx, next) => {
            ctx.handled = true;
            await this.allLoadedPromise;
            await this.appInitializedPromise;
            next();
        });

        this.load();

        // after app load
        Events.on(
            ServerConnections,
            'localusersignedin',
            async () => {
                await this.allLoadedPromise;
                this.runHooks('appInitialized');
                this.appInitializedResolve();
            }
        );
    }
}

export default LoadScripts;
