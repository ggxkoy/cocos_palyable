// 场景 JSON 静态校验（无编辑器环境的三大验证手段之一）：
//   node tools/scene-lint.mjs
// 检查：__id__ 引用在数组范围内；__uuid__ 指向的资产在 assets/ 的 .meta
// （含 FBX subMeta 子资产）里真实存在；自定义组件 __type__（压缩 uuid）
// 能对应到某个脚本 .meta——防止手写场景引用悬空。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');

const BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function compressUuid(uuid) {
    const stripped = uuid.replace(/-/g, '');
    let out = stripped.slice(0, 5);
    for (let i = 5; i < 32; i += 3) {
        const val = parseInt(stripped.slice(i, i + 3), 16);
        out += BASE64_KEYS[val >> 6] + BASE64_KEYS[val & 63];
    }
    return out;
}

// 收集全部资产 uuid（meta 本体 + subMetas 子资产）与脚本压缩 uuid。
const assetUuids = new Set();
const scriptCids = new Map();
(function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full);
        } else if (entry.name.endsWith('.meta')) {
            let meta;
            try {
                meta = JSON.parse(fs.readFileSync(full, 'utf8'));
            } catch {
                continue;
            }
            if (meta.uuid) {
                assetUuids.add(meta.uuid);
                if (meta.importer === 'typescript') {
                    scriptCids.set(compressUuid(meta.uuid), full);
                }
            }
            for (const sub of Object.values(meta.subMetas ?? {})) {
                if (sub && sub.uuid) {
                    assetUuids.add(sub.uuid);
                }
            }
        }
    }
})(ASSETS);

let failures = 0;
const fail = message => {
    failures += 1;
    console.error('  FAIL -', message);
};

const sceneDir = path.join(ASSETS, 'scenes');
for (const file of fs.readdirSync(sceneDir)) {
    if (!file.endsWith('.scene')) {
        continue;
    }
    const doc = JSON.parse(fs.readFileSync(path.join(sceneDir, file), 'utf8'));
    console.log(`lint ${file} (${doc.length} items)`);
    doc.forEach((item, index) => {
        (function scan(value, trail) {
            if (!value || typeof value !== 'object') {
                return;
            }
            if ('__id__' in value) {
                const id = value.__id__;
                if (!Number.isInteger(id) || id < 0 || id >= doc.length) {
                    fail(`${file} item ${index} ${trail}: __id__ ${id} out of range`);
                }
                return;
            }
            if ('__uuid__' in value) {
                if (!assetUuids.has(value.__uuid__)) {
                    fail(`${file} item ${index} ${trail}: unknown asset uuid ${value.__uuid__}`);
                }
                return;
            }
            for (const [key, child] of Object.entries(value)) {
                scan(child, trail ? `${trail}.${key}` : key);
            }
        })(item, '');

        const type = item.__type__ ?? '';
        if (type && !type.startsWith('cc.') && item.node !== undefined) {
            if (!scriptCids.has(type)) {
                fail(`${file} item ${index}: component type ${type} has no matching script meta`);
            }
        }
    });
}

console.log(failures === 0 ? 'scene lint OK' : `${failures} scene lint failures`);
process.exit(failures === 0 ? 0 : 1);
