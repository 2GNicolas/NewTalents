import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = 'https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer/317/query?where=1%3D1&outFields=DPTO_CCDGO%2CMPIO_CCDGO%2CMPIO_CDPMP%2CDPTO_CNMBRE%2CMPIO_CNMBRE&returnGeometry=false&orderByFields=MPIO_CDPMP&f=json';
const response = await fetch(source);
if (!response.ok) throw new Error(`DANE DIVIPOLA request failed: ${response.status}`);
const payload = await response.json();
if (!Array.isArray(payload.features) || payload.features.length < 1100) throw new Error('DANE DIVIPOLA response is incomplete');

const municipalities = payload.features.map(({ attributes }) => ({
  code: String(attributes.MPIO_CDPMP),
  departmentCode: String(attributes.DPTO_CCDGO),
  department: String(attributes.DPTO_CNMBRE),
  name: String(attributes.MPIO_CNMBRE),
}));

const header = `// Generated from DANE DIVIPOLA MGN 2025. Do not edit manually.\n// Source: ${source}\n`;
const frontend = `${header}export const COLOMBIA_MUNICIPALITIES = Object.freeze(${JSON.stringify(municipalities, null, 2)} as const);\nexport type ColombiaMunicipality = typeof COLOMBIA_MUNICIPALITIES[number];\n`;
const backend = `${header}const COLOMBIA_MUNICIPALITIES = ${JSON.stringify(municipalities, null, 2)} as const;\nexport const COLOMBIA_MUNICIPALITY_CODES: ReadonlySet<string> = new Set(COLOMBIA_MUNICIPALITIES.map(({ code }) => code));\nconst COLOMBIA_MUNICIPALITIES_BY_CODE: ReadonlyMap<string, typeof COLOMBIA_MUNICIPALITIES[number]> = new Map(COLOMBIA_MUNICIPALITIES.map((municipality) => [municipality.code, municipality]));\nexport function colombiaMunicipalityLabel(value: string): string { const municipality = COLOMBIA_MUNICIPALITIES_BY_CODE.get(value); return municipality ? \`${'${municipality.name}'} · ${'${municipality.department}'}\` : value; }\n`;

for (const [path, contents] of [
  ['apps/frontend/src/registration-requests/validation/colombia-municipalities.ts', frontend],
  ['apps/backend/src/registration-requests/validation/colombia-municipality-codes.ts', backend],
]) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
}

console.log(`Generated ${municipalities.length} official DIVIPOLA municipalities.`);
