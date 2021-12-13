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

## Installing `jellyfin-xposed` to your Jellyfin server

For users' simplicity, Jellyfin (that is to say the [`linuxserver/jellyfin` image](https://hub.docker.com/r/linuxserver/jellyfin)) packages its frontend alongside with the server, while now you need to replace these files with those from `jellyfin-xposed`.

Here, you can either replace old files in-place with tarballs downloaded from [releases page](https://github.com/std4453/jellyfin-xposed/releases), or you can use `ghcr.io/std4453/jellyfin-xposed` docker image (choose your version on the [packages page](https://github.com/std4453/jellyfin-xposed/pkgs/container/jellyfin-xposed)), which serves the frontend on port 80 via [nginx](https://hub.docker.com/_/nginx).

In the latter case, you should serve all requests to prefix `/web` to the client (and removing the prefix), and others to the server.

`jellyfin-xposed` is bundled with a default [`config.json`](src/config.json), which loads no external scripts, you will have to modify the file yourself (if you're hosting it statically), or mount your modified config into the docker container. 

Eitherways, make sure that your config loads `xposed/plugin`, which is the prerequisite for the following actions.

## Writing plugins with `jellyfin-xposed`

> If you're just using `jellyfin-xposed`-powered plugins, you can skip this part.

Most core components of `jellyfin-web` are under `src/components`, like `playbackManager` and `appHost`.

Although access to these modules will be unavailable after the `webpack` build process, `jellyfin-xposed` exposes them under the `Xp` global variable, using a set of rules to convert module and export name to object paths. 

For further details, read comments in [`babel-plugin-xposed.js`](babel-plugin-xposed.js) and plugin config in [`babel.config.js`](babel.config.js).

Additionally, `page` and `jellyfin-apiclient.Events` are exported as `Xp.page` and `Xp.Events`, as they're used for adding routes and listening to Events. Meanwhile, you can monkey-patch functions on objects to override default functionalities, we're looking forward to providing a simple framework for developing `jellyfin-web`-based plugins.

Unfortunately, it is out of our ability to provide detailed documentation of the `jellyfin-web` internals, you'll have to read `jellyfin-web` source code to do that.

---

A basic plugin is a simple script which runs after all `Xp` variables are available, where you can hook `jellyfin-web` modules and modify the interface of a certain page.

An example could be found in [`jfdmk`](https://github.com/std4453/jfdmk).

However, it takes more effort to add an initial route, that is, a route that can act as the first route upon app startup.

The problem here is that Jellyfin trys to resolve the route directly after all plugins are loaded, by which time there's no guarentee that all the scripts provided to `jellyfin-xposed` are already loaded.

If the initial route is not present in the routing table of `jellyfin-web`, it will exit the app, so we can't wait until each plugin registers its own routes.

To solve this issue, `jellyfin-xposed` registers a route prefix `/xposed` on plugin load, so Jellyfin think that the route is already matched and will not exit the app.

Then, when individual scripts load, they can call `Xp.page()` to register their routes under `/xposed`, and the new routes will apply automatically.

---

As of `1.2.0`, `jellyfin-xposed` supports (and recommends) using app lifecycle hooks to control the behavior of plugins.

This feature requires plugins to reside as an ES Module with an object as its default export, like:

```javascript
export default {
  appInitialized() {
  },
};
```

The `appInitialized` hook will only be called after `jellyfin-web` has started and connected to a Jellyfin server. Then it would a great chance to do each plugin's work.

More lifecycle hooks will be added in the future.

## Installing plugins for `jellyfin-xposed`

The `config.json` file is used for configurating `jellyfin-xposed`, like:

```json
{
  "loadScripts": [
    "https://<host>/script.js"
  ],
  "loadModules": [
    "https://<host>/module.js"
  ]
}
```

The two types are used to distinguish between a script (without an export) and a module (with an export).

## Author

张海川 - Haichuan Zhang - [me@std4453.com](mailto:me@std4453.com) - [Homepage](https://blog.std4453.com:444)
