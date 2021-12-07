# jellyfin-xposed

`jellyfin-xposed` is for enhancing the extendability of [`jellyfin-web`](https://github.com/jellyfin/jellyfin-web). Its name originates from the [Xposed framework](https://www.xda-developers.com/xposed-framework-hub/) for Android.

## Why `jellyfin-xposed`?

`jellyfin-web` is a behemoth web application written in vanilla JS, using no modern frontend framework, placing all code in a single repo and webpack to bundle them all.

Although `jellyfin-web` has a plugin system, as you might notice in [`config.json`](https://github.com/jellyfin/jellyfin-web/blob/v10.7.7/src/config.json#L27), the plugins bundled by webpack while building `jellyfin-web` core, and loaded on demand via [webpack dynamic import](https://webpack.js.org/guides/code-splitting/#dynamic-imports).

To lower code size, webpack transforms module names into corresponding numbers and use them dynamically imported modules to access their dependencies. 

However, this makes impossible to write code that access these bundled modules without being bundled together at build time. 

So you'll have to place your plugin code right into your fork of `jellyfin-web` repository, and must rebuild the whole project to deploy a new version of your plugin. In order to keep track of newest Jellyfin features, you must rebase your fork continuously onto the upstream, which is both tiresome and error-prone.

Apparantly that's not what we want.

If only `jellyfin-web` **exposes** its modules as global variables... 

And that is exactly what `jellyfin-xposed` does.

`jellyfin-xposed` exposes all modules under `src/components` under a global variable `Xp`, along with some other useful ones, and provides a simple way to config external plugins to be loaded at runtime.

It allows you to develop, build, test and deploy your plugin separately, and access `jellyfin-web` internals via the exported `Xp`, so you can write less hacky code to fulfill you needs.

And since modules are loaded only once, every modification you make to these exported objects will be seen immediatly by other `jellyfin-web` components. We recommend using [AOP](https://en.wikipedia.org/wiki/Aspect-oriented_programming) to patch internal objects, since `jellyfin-web` does not emit events very often.

`jellyfin-xposed` is inspired by the idea of [microfrontends](https://micro-frontends.org/), although such would be too heavy a solution for our requirements. If `jellyfin-web` migrates to a modern framework, we might reconsider our solutions.

## How does `jellyfin-xposed` work?

To minimize the effort to implement such an system while keeping track of upstream updates, `jellyfin-xposed` implements a [babel](https://babeljs.io/) [plugin](babel-plugin-xposed.js) to write all exports in a module onto a global object. 

As long as the upstream babel config does not change (which shouldn't happen too often), `jellyfin-xposed` will work without a modification.

We also build a [github actions workflow](.github/workflows/main.yml) to automatically fetch upstream and build and push a docker image with `jellyfin-xposed`, and only requires an update of `jellyfin-web` tag to upgrade to the newest version.

Lastly, we add a simple plugin [`xposed/plugin`](src/plugins/xposed/plugin.js) which finds scripts to load from config and loads them after Jellyfin is initialized.

## How to use `jellyfin-xposed`?

First you have to divide your Jellyfin deployment into two parts, a.k.a. frontend and backend.

`jellyfin-web` is fully static after build, so it could be served easily with any static file server. 

Originally, Jellyfin serves the frontend under `web/`, other paths should be sent to the backend. After the splitting, you might need a reverse proxy to serve both parts under one domain. Now verify that your deployment is correct.

Then, you need to replace your `jellyfin-web` files with `jellyfin-xposed` files, you can either replace new files in-place of the old ones, or you can use `ghcr.io/std4453/jellyfin-xposed` docker image (choose your version on the [packages page](https://github.com/std4453/jellyfin-xposed/pkgs/container/jellyfin-xposed)), which serves the frontend on port 80 via [nginx](https://hub.docker.com/_/nginx).

`jellyfin-xposed` is bundled with a default [`config.json`](src/config.json), which loads no external scripts, you will have to modify the file yourself (if you're hosting it statically), you mount your modified config into the docker container. 

Eitherways, make sure that your config loads `xposed/plugin`.

Finally, deploy your `jellyfin-xposed`-powered plugin as a single JS file, and add its URL to `loadScripts` in `config.json`, now refresh Jellyfin and you're free to go!

## Writing plugins with `jellyfin-xposed`

All modules under `src/components` are exported under the `Xp` global variable, using a set of rules to convert module and export name to object paths. For further details, read comments in [`babel-plugin-xposed.js`](babel-plugin-xposed.js) and plugin config in [`babel.config.js`](babel.config.js).

Additionally, `page` and `jellyfin-apiclient.Events` are exported as `Xp.page` and `Xp.Events`, as they're used for adding routes and listening to Events. Meanwhile, you can monkey-patch functions on objects to override default functionalities, we're looking forward to providing a simple framework for developing `jellyfin-web`-based plugins.

Unfortunately, it is out of our ability to provide detailed documentation of the `jellyfin-web` internals, you'll have to read `jellyfin-web` source code to do that.

You can find an example plugin at [`jfdmk`](https://github.com/std4453/jfdmk).

## Author

张海川 - Haichuan Zhang - [me@std4453.com](mailto:me@std4453.com) - [Homepage](https://blog.std4453.com:444)
