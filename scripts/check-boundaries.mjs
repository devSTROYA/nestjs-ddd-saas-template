// Fails when an import crosses a module boundary without going through the other module's barrel.
//   - a module may import another module only as `@modules/<name>` (never a deep alias or a relative path)
//   - src/common never imports a module
// Documented exceptions (docs/decisions.md), all by relative path:
//   - a file under infrastructure/persistence may import another module's *.schema.ts (foreign keys, and
//     read-side joins in query adapters; drizzle-kit does not resolve tsconfig aliases)
//   - a *.module.ts may import another module's *.module.ts (barrels export no Nest modules)
//   - an *.int-spec.ts or *.e2e-spec.ts may import anything, because it wires real adapters
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');
const MODULES = join(SRC, 'modules');
const COMMON = join(SRC, 'common');
const ALIAS = '@modules/';

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.ts') ? [path] : [];
  });

// The module that owns a path, 'common', or null for the composition root (src/*.ts).
const ownerOf = (path) => {
  const inModules = relative(MODULES, path);
  if (!inModules.startsWith('..')) return inModules.split(sep)[0];
  return relative(COMMON, path).startsWith('..') ? null : 'common';
};

const specifiersOf = (sourceFile) => {
  const found = [];
  const visit = (node) => {
    const specifier =
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
        ? node.moduleSpecifier
        : ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments[0]
          ? node.arguments[0]
          : null;
    if (specifier && ts.isStringLiteralLike(specifier)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(specifier.getStart(sourceFile));
      found.push({ text: specifier.text, line: line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
};

const targetOf = (file, specifier) => {
  if (specifier.startsWith(ALIAS)) {
    const [name, ...deep] = specifier.slice(ALIAS.length).split('/');
    return { owner: name, deep: deep.length > 0 };
  }
  if (specifier.startsWith('.')) {
    const path = resolve(dirname(file), specifier);
    return { owner: ownerOf(path), path, deep: false, relative: true };
  }
  return null;
};

const isDocumentedException = (file, specifier) =>
  /\.(int|e2e)-spec\.ts$/.test(file) ||
  (/\.module\.ts$/.test(file) && /\.module\.js$/.test(specifier)) ||
  (file.includes(`${sep}infrastructure${sep}persistence${sep}`) && /\.schema\.js$/.test(specifier));

const violations = walk(SRC).flatMap((file) => {
  const owner = ownerOf(file);
  if (owner === null) return [];
  const sourceFile = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  return specifiersOf(sourceFile).flatMap(({ text, line }) => {
    const target = targetOf(file, text);
    if (!target?.owner || target.owner === owner) return [];
    const where = `${relative(root, file)}:${line}`;
    if (owner === 'common' && target.owner !== 'common') {
      return [`${where}: common must not import a module (${text})`];
    }
    if (target.owner === 'common') return [];
    if (target.deep)
      return [`${where}: deep alias, import from '@modules/${target.owner}' (${text})`];
    if (target.relative && !isDocumentedException(file, text)) {
      return [
        `${where}: relative import into module '${target.owner}', use '@modules/${target.owner}' (${text})`,
      ];
    }
    return [];
  });
});

if (violations.length > 0) {
  console.error('Module boundary violations:');
  console.error(violations.sort().join('\n'));
  process.exit(1);
}
