/**
 * Data-herkomst-scan (STATUS.md sectie 34-vervolg): bevestigt statisch dat
 * elke aanroep van readAuthorizedRecipient/readMaliciousAddresses/getMint/
 * getAccount in dit project zijn account-bytes van een live
 * connection-fetch krijgt — nooit van een lokaal geconstrueerde Buffer,
 * array-literal of testfixture. Dat is de daadwerkelijke aanname achter de
 * `tolerable_risk`-dispositie voor bigint-buffer (sectie 34): de functie
 * draait wel, maar de trigger-voorwaarde (attacker-controlled bytes) doet
 * zich niet voor omdat de data altijd on-chain-programma-gevalideerd is.
 *
 * AST-gebaseerd (TypeScript compiler-API), bewust geen regex: moet
 * betrouwbaar multi-line-aanroepen, geneste expressies en (in principe)
 * hernoemde bindings aankunnen. Een regex zou een over meerdere regels
 * geformatteerde aanroep kunnen missen, of een argument dat toevallig op
 * "connection" lijkt zonder het echt te zijn ten onrechte goedkeuren/
 * afkeuren — de AST geeft de echte argument-node, niet een tekstgok.
 *
 * Uitvoeren: npx ts-node tests/poisonDecodeProvenance.ts
 * Zit vooraan in `npm test` (package.json) — snel, geen validator nodig,
 * faalt liever meteen dan pas na de dure on-chain E2E-runs.
 */
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const TARGET_FUNCTIONS = new Set([
  "readAuthorizedRecipient",
  "readMaliciousAddresses",
  "getMint",
  "getAccount",
]);

const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "target", ".anchor"]);

interface Violation {
  file: string;
  line: number;
  fnName: string;
  reason: string;
}

function findTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findTsFiles(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function scanFile(file: string): Violation[] {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const violations: Violation[] = [];

  // Pas 1: verzamel lokale variabele-declaraties (naam -> initializer), zodat
  // een identifier als eerste argument teruggeleid kan worden naar waar hij
  // vandaan komt (bv. `connection` -> `new Connection(...)`).
  const declarations = new Map<string, ts.Expression>();
  const visitDecls = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visitDecls);
  };
  visitDecls(source);

  function isConnectionSource(expr: ts.Expression, depth = 0): boolean {
    if (depth > 4) return false; // geen oneindige lus bij circulaire/kapotte code
    if (ts.isParenthesizedExpression(expr) || ts.isAwaitExpression(expr)) {
      return isConnectionSource(expr.expression, depth + 1);
    }
    if (ts.isNewExpression(expr)) {
      // new Connection(...) of new web3.Connection(...)/anchor.web3.Connection(...)
      return /Connection$/.test(expr.expression.getText());
    }
    if (ts.isIdentifier(expr)) {
      const init = declarations.get(expr.text);
      if (init) return isConnectionSource(init, depth + 1);
      // Geen lokale initializer gevonden (bv. een functieparameter): alleen
      // goedkeuren bij een ondubbelzinnige connection-achtige naam - dit is
      // precies de impliciete aanname die deze scan moet afdwingen, dus
      // conservatief, niet coulant.
      return /^(connection|conn)$/i.test(expr.text);
    }
    if (ts.isPropertyAccessExpression(expr)) {
      // bv. client.conn
      return /^(conn|connection)$/i.test(expr.name.text);
    }
    // Buffer.from(...), Buffer.alloc(...), array-literals, object-literals,
    // nieuwe Uint8Array(...), etc. - altijd afkeuren.
    return false;
  }

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      let fnName: string | null = null;
      if (ts.isIdentifier(node.expression)) fnName = node.expression.text;
      else if (ts.isPropertyAccessExpression(node.expression)) fnName = node.expression.name.text;

      if (fnName && TARGET_FUNCTIONS.has(fnName)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        const firstArg = node.arguments[0];
        if (!firstArg) {
          violations.push({ file, line: line + 1, fnName, reason: "geen argumenten" });
        } else if (!isConnectionSource(firstArg)) {
          const snippet = firstArg.getText().replace(/\s+/g, " ").slice(0, 60);
          violations.push({
            file,
            line: line + 1,
            fnName,
            reason: `eerste argument "${snippet}" is niet herleidbaar tot een live connection-fetch`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return violations;
}

// Bonus, buiten de per-call-site-scan om: de twee custom lees-/decode-
// functies uit poisonToken.ts moeten zelf ook via connection.getAccountInfo
// lezen, niet via iets anders - sluit de lus aan de definitiekant, niet
// alleen aan de aanroepkant.
function checkDefinitionsUseGetAccountInfo(): Violation[] {
  const file = path.join(ROOT, "client/src/poisonToken.ts");
  const text = fs.readFileSync(file, "utf8");
  const violations: Violation[] = [];
  for (const fn of ["readAuthorizedRecipient", "readMaliciousAddresses"]) {
    const start = text.indexOf(`export async function ${fn}(`);
    if (start === -1) {
      violations.push({ file, line: 0, fnName: fn, reason: "definitie niet gevonden" });
      continue;
    }
    // Body = tot de volgende top-level "export" (ruwe maar voldoende afbakening
    // voor dit doel: deze twee functies staan na elkaar, gevolgd door meer exports).
    const nextExport = text.indexOf("\nexport ", start + 10);
    const body = text.slice(start, nextExport === -1 ? undefined : nextExport);
    if (!body.includes(".getAccountInfo(")) {
      violations.push({
        file,
        line: text.slice(0, start).split("\n").length,
        fnName: fn,
        reason: "functiebody bevat geen .getAccountInfo(-aanroep meer",
      });
    }
  }
  return violations;
}

function main() {
  const files = findTsFiles(ROOT).filter((f) => {
    const text = fs.readFileSync(f, "utf8");
    return /\b(readAuthorizedRecipient|readMaliciousAddresses|getMint|getAccount)\s*\(/.test(text);
  });

  let violations: Violation[] = [];
  for (const f of files) violations = violations.concat(scanFile(f));
  violations = violations.concat(checkDefinitionsUseGetAccountInfo());

  if (violations.length > 0) {
    console.error(
      `FOUT: data-herkomst-scan vond ${violations.length} probleem/problemen ` +
        `(zie STATUS.md sectie 34-vervolg):`
    );
    for (const v of violations) {
      console.error(`  ${path.relative(ROOT, v.file)}:${v.line}  ${v.fnName}(...) — ${v.reason}`);
    }
    process.exit(1);
  }
  console.log(
    `OK: alle aanroepen van readAuthorizedRecipient/readMaliciousAddresses/getMint/getAccount ` +
      `in ${files.length} bestand(en) herleidbaar tot een live connection-fetch; ` +
      `readAuthorizedRecipient/readMaliciousAddresses lezen zelf via connection.getAccountInfo.`
  );
}

main();
