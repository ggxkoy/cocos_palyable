// 策划案 ↔ 代码一致性校验（策划案是事实来源，不允许被代码悄悄甩开）：
//   node tools/design-lint.mjs
// 规则：策划案里「模板映射」表的每一行，`配置项` 写成目标 Config 的点路径
// （用反引号包起来），`值` 必须与真实配置一致。字段不存在、值对不上都报错。
// 目标 Config 由策划案正文里出现的 `assets/scripts/**/XxxConfig.ts` 路径确定。
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DESIGN_DIR = path.join(ROOT, 'docs', 'design');

// 把 `export const X = {...} as const;` 的对象字面量取出来求值。
// Config 是纯字面量、无 import，去掉 TS 断言后就是合法 JS。
function loadConfig(configPath) {
    const source = fs.readFileSync(configPath, 'utf8');
    const start = source.indexOf('{', source.indexOf('export const'));
    const end = source.lastIndexOf('} as const;');
    if (start < 0 || end < 0) {
        throw new Error(`${configPath}: 找不到 "export const ... = {...} as const;" 结构`);
    }
    const literal = source
        .slice(start, end + 1)
        .replace(/ as Record<[^>]*>/g, '')
        .replace(/ as const/g, '');
    // eslint-disable-next-line no-new-func
    return new Function(`return (${literal});`)();
}

function resolvePath(root, dotted) {
    let cursor = root;
    for (const key of dotted.split('.')) {
        if (cursor === null || cursor === undefined || !(key in cursor)) {
            return { found: false };
        }
        cursor = cursor[key];
    }
    return { found: true, value: cursor };
}

// 值比对：数字按数值比；数组支持 JSON 或「N 项」（只校验条目数）；其余按字符串。
function matches(expected, actual) {
    const text = expected.trim().replace(/^`|`$/g, '');
    if (Array.isArray(actual)) {
        const countForm = text.match(/^(\d+)\s*项$/);
        if (countForm) {
            return actual.length === Number(countForm[1]);
        }
        try {
            return JSON.stringify(JSON.parse(text)) === JSON.stringify(actual);
        } catch {
            return false;
        }
    }
    if (typeof actual === 'number') {
        const num = Number(text);
        return !Number.isNaN(num) && num === actual;
    }
    if (typeof actual === 'boolean') {
        return text === String(actual);
    }
    if (actual !== null && typeof actual === 'object') {
        const countForm = text.match(/^(\d+)\s*项$/);
        if (countForm) {
            return Object.keys(actual).length === Number(countForm[1]);
        }
        try {
            return JSON.stringify(JSON.parse(text)) === JSON.stringify(actual);
        } catch {
            return false;
        }
    }
    return text === String(actual);
}

let failures = 0;
let checked = 0;
const fail = message => {
    failures += 1;
    console.error('  FAIL -', message);
};

const docs = fs.existsSync(DESIGN_DIR)
    ? fs.readdirSync(DESIGN_DIR).filter(name => name.endsWith('.md'))
    : [];

for (const file of docs) {
    const docPath = path.join(DESIGN_DIR, file);
    const text = fs.readFileSync(docPath, 'utf8');

    // 表格行形如： | `defense.wall.maxHp` | 150 | 依据 |
    const rows = [...text.matchAll(/^\|\s*`([A-Za-z_][\w.]*)`\s*\|([^|]*)\|/gm)];
    if (rows.length === 0) {
        console.log(`skip ${file}（无机器可校验的配置表）`);
        continue;
    }

    const configRef = text.match(/assets\/scripts\/[\w/.-]*Config\.ts/);
    if (!configRef) {
        fail(`${file}: 表里有配置项，但正文没有指明目标 Config 路径（assets/scripts/**/XxxConfig.ts）`);
        continue;
    }
    const configPath = path.join(ROOT, configRef[0]);
    if (!fs.existsSync(configPath)) {
        fail(`${file}: 指向的 Config 不存在 ${configRef[0]}`);
        continue;
    }

    let config;
    try {
        config = loadConfig(configPath);
    } catch (error) {
        fail(`${file}: ${error.message}`);
        continue;
    }

    console.log(`lint ${file} → ${configRef[0]}（${rows.length} 项）`);
    for (const [, dotted, rawValue] of rows) {
        checked += 1;
        const resolved = resolvePath(config, dotted);
        if (!resolved.found) {
            fail(`${file}: 配置项 ${dotted} 在 Config 里不存在（字段被改名或删除？）`);
            continue;
        }
        if (!matches(rawValue, resolved.value)) {
            const actual = typeof resolved.value === 'object'
                ? JSON.stringify(resolved.value)
                : String(resolved.value);
            fail(`${file}: ${dotted} 策划案写 "${rawValue.trim()}"，代码实际是 ${actual}`);
        }
    }
}

console.log(failures === 0
    ? `design lint OK（${checked} 项与代码一致）`
    : `${failures} 处策划案与代码不一致`);
process.exit(failures === 0 ? 0 : 1);
