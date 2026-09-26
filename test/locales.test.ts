import { describe, expect, it } from 'vitest';
import es from '../locales/es.json';
import en from '../locales/en.json';
import { SPECIALTIES } from '../services/orgs';

const keys = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]);

describe('traducciones', () => {
  it('español e inglés tienen exactamente las mismas claves', () => {
    expect(keys(en).sort()).toEqual(keys(es).sort());
  });

  it('no hay textos vacíos', () => {
    for (const [lang, dict] of Object.entries({ es, en })) {
      const empty = keys(dict).filter((k) => !k.split('.').reduce<any>((o, p) => o?.[p], dict));
      expect(empty, lang).toEqual([]);
    }
  });

  it('cada especialidad tiene nombre en los dos idiomas', () => {
    for (const s of SPECIALTIES) {
      expect(es.specialties[s]).toBeTruthy();
      expect(en.specialties[s]).toBeTruthy();
    }
  });
});
