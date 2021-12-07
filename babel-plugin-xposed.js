const path = require('path');

// modules exported via this plugin are converted like:
//
// First, everything happens in a global object with name
// ${globalObject}.${exposeRoot}, for example, 'window.Xp'.
//
// Then, an object with same structure as the directory
// tree is constructed, so if your files are like:
//
// foo
// |-bar
// | |-baz.js
// |-abc.js
//
// These objects will be available:
//
// window.Xp.foo.bar.baz
// window.Xp.foo.abc
//
// After that, each one of these objects may contain one
// default export and multiple named exports.
// To avoid collision, ${defaultPath} is used to hold the default
// export and ${namedPath} is used to hold the named exports,
// so if your foo/bar/baz.js contain the following content:
//
// export default { gg: 123 };
// export const a = 456;
// const b = 789;
// export { b as bbbbb };
//
// And if you use 'xposed' as namedPath and 'xposed_default' as
// defaultPath, then you will have:
//
// window.Xp.foo.bar.baz.xposed_default.gg = 123
// window.Xp.foo.bar.baz.xposed.a = 456;
// window.Xp.foo.bar.baz.xposed.bbbbb = 456;
//
// You can choose some shorter names for default and named exports
// to shorten the generated code, such as '_' and 'x'.
// In this way, you MUST first make sure that these shorter names won't
// collide, which means that:
// - There's no file named 'x.js' or '_.js' in your project
// - There's no folder named 'x' or '_' in your project
// This shouldn't be too difficult.
//
// One additional option supported is to eliminate last element if
// the last two are identical, since some might like to name their
// files foo/foo.js (instead of foo/index.js).
// As long as the aforementioned rules are followed, you're safe to
// open this option.
//
// Finally, this plugin requires lodash '_.set' to function, you're
// free to choose your favourite version, or even 'dset' which is way
// smaller. Make sure that the package can be imported as if you've
// written in your code.

module.exports = function({ types: t }) {
    return {
        visitor: {
            Program(_path, { filename, opts: {
                exposeRoot,
                sourceRoot,
                globalObject = 'window',
                namedPath = 'xposed',
                defaultPath = 'xposed_default',
                eliminateDuplicate = false,
                lodashSetPackage = 'lodash-es/set',
                logMapping = false
            } }) {
                if (!filename.startsWith(sourceRoot)) {
                    this.disabled = true;
                    return;
                }

                let setImport = lodashSetPackage;
                if (lodashSetPackage.startsWith('.')) {
                    const setPackagePath = path.resolve(lodashSetPackage);
                    const fileDir = path.dirname(filename);
                    const relativePath = path.relative(fileDir, setPackagePath);
                    setImport = relativePath;
                }
                const setDecl =
                    _path.scope.generateUidIdentifier('_xposed_lodash_set');
                _path.unshiftContainer(
                    'body',
                    t.importDeclaration(
                        [t.importDefaultSpecifier(setDecl)],
                        t.stringLiteral(setImport)
                    )
                );
                const relative = path.relative(sourceRoot, filename);
                const parts = [exposeRoot, ...relative.split(path.sep)];
                const basename = path.basename(
                    filename,
                    path.extname(filename)
                );
                parts[parts.length - 1] = basename;

                if (eliminateDuplicate &&
                    parts.length >= 2 &&
                    parts[parts.length - 1] === parts[parts.length - 2]) {
                    parts.pop();
                }

                this.buildSet = (exportName, value) => {
                    const finalParts = exportName === 'default' ?
                        [...parts, defaultPath] :
                        [...parts, namedPath, exportName];
                    const joinedPath = finalParts.join('.');
                    if (logMapping) {
                        console.log(`${relative}::${exportName} -> ${joinedPath}`);
                    }
                    return t.callExpression(setDecl, [
                        t.identifier(globalObject),
                        t.stringLiteral(joinedPath),
                        value
                    ]);
                };
            },
            ExportDefaultDeclaration(path) {
                if (this.disabled) {
                    return;
                }

                const decl = path.node.declaration;
                if (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) {
                    if (!decl.id) {
                        decl.id = path.scope.generateUidIdentifier(
                            '_xposed_export_default'
                        );
                    }
                    path.insertAfter(this.buildSet('default', decl.id));
                } else {
                    const id = path.scope.generateUidIdentifier(
                        '_xposed_export_default'
                    );
                    path.insertBefore(
                        t.variableDeclaration('const', [
                            t.variableDeclarator(
                                id,
                                path.node.declaration
                            )
                        ])
                    );
                    path.insertBefore(this.buildSet('default', id));
                    path.node.declaration = id;
                }
                path.skip();
            },
            ExportNamedDeclaration(path) {
                if (this.disabled) {
                    return;
                }

                const decl = path.node.declaration;
                if (decl) {
                    if (t.isVariableDeclaration(decl)) {
                        decl.declarations.forEach((declaration) => {
                            const name = declaration.id.name;
                            path.insertAfter(
                                this.buildSet(name, declaration.id)
                            );
                        });
                    } else if (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) {
                        const name = decl.id.name;
                        path.insertAfter(this.buildSet(name, decl.id));
                    }
                }
                path.node.specifiers.forEach((specifier) => {
                    path.insertAfter(
                        this.buildSet(specifier.exported.name, specifier.local)
                    );
                });
            }
        }
    };
};
