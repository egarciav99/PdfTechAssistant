import { describe, it, expect } from 'vitest';
import { cleanModelHtml } from '../services/modelHtml';

describe('cleanModelHtml', () => {
  it('quita colores de texto y fondo del modelo y conserva el resto de estilos', () => {
    const html = '<div style="background-color:#1e3a8a;color:#000;padding:12px"><h3 style="color:#111">Título</h3><p>Texto</p></div>';
    const out = cleanModelHtml(html);
    expect(out).not.toMatch(/background|color:/);
    expect(out).toContain('padding: 12px');
    expect(out).toContain('<h3>Título</h3>');
  });

  it('respeta los avisos de la app marcados con data-keep-style', () => {
    const html = '<div data-keep-style="" style="background-color:#fff7ed;color:#9a3412"><strong>Información no disponible</strong></div>';
    expect(cleanModelHtml(html)).toContain('background-color:#fff7ed');
  });

  it('sigue eliminando scripts y manejadores', () => {
    const out = cleanModelHtml('<div onclick="alert(1)">a<script>alert(2)</script><img src=x onerror="alert(3)"></div>');
    expect(out).not.toMatch(/onclick|onerror|<script/);
  });

  it('quita bgcolor y font color antiguos', () => {
    const out = cleanModelHtml('<table><tr><td bgcolor="#000"><font color="#000">x</font></td></tr></table>');
    expect(out).not.toMatch(/bgcolor|color=/);
  });
});
