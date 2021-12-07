import { Events } from 'jellyfin-apiclient';
import ServerConnections from '../../components/ServerConnections';
import set from '../../dset';
import page from 'page';

export class LoadScripts {
    name = 'Jellyfin xposed plugin';
    type = '';
    id = 'xposed';
    priority = 1;

    constructor() {
        // modules that are useful but not exposed by babel plugin
        set(window, 'Xp.Events', Events);
        set(window, 'Xp.page', page);
        // after app load
        Events.on(
            ServerConnections,
            'localusersignedin',
            this.loadScripts.bind(this)
        );
    }

    async loadScripts() {
        console.log('[xposed] loading custom scripts');
        try {
            const resp = await fetch('config.json');
            const config = await resp.json();
            await Promise.all(
                (config.loadScripts ?? []).map(async (script) => {
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
                })
            );
        } catch (e) {
            console.error(e);
        } finally {
            console.log('[xposed] finished loading custom scripts');
        }
    }
}

export default LoadScripts;
