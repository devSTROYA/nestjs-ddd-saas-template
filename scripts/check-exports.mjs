// Fails when a source file exports a name that no other file references.
// Names used only by tests or fakes pass. Barrels (index.ts) do not count as users and drizzle
// tables (pgTable) are skipped because drizzle-kit reads them.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['src', 'test'];
const TEST_FILE = /(\.(spec|int-spec|e2e-spec)\.ts|\/testing\/.*|\/test\/.*)$/;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.ts') ? [path] : [];
  });

const sources = new Map(
  SOURCE_DIRS.flatMap((dir) => walk(join(root, dir))).map((file) => [file, readFileSync(file, 'utf8')]),
);

const hasExportModifier = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

const isDrizzleTable = (declaration) =>
  declaration.initializer !== undefined &&
  ts.isCallExpression(declaration.initializer) &&
  declaration.initializer.expression.getText() === 'pgTable';

const exportedNames = (file, text) => {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  return sourceFile.statements.filter(hasExportModifier).flatMap((node) => {
    if (ts.isVariableStatement(node)) {
      return node.declarationList.declarations
        .filter((declaration) => ts.isIdentifier(declaration.name) && !isDrizzleTable(declaration))
        .map((declaration) => declaration.name.text);
    }
    return node.name && ts.isIdentifier(node.name) ? [node.name.text] : [];
  });
};

const isReferencedElsewhere = (name, file) => {
  const pattern = new RegExp(`\\b${name}\\b`);
  return [...sources].some(
    ([other, text]) => other !== file && !other.endsWith('/index.ts') && pattern.test(text),
  );
};

const unused = [...sources]
  .filter(([file]) => !TEST_FILE.test(file) && !file.endsWith('/index.ts'))
  .flatMap(([file, text]) =>
    exportedNames(file, text)
      .filter((name) => !isReferencedElsewhere(name, file))
      .map((name) => `${relative(root, file)}: ${name}`),
  );

if (unused.length > 0) {
  console.error('Exported but not used by any other file (drop the export):');
  console.error(unused.sort().join('\n'));
  process.exit(1);
}
