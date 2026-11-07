import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const sourceRoot = join(process.cwd(), 'src');
const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? sourceFiles(path) : /\.(css|astro|ts|tsx)$/.test(entry.name) ? [path] : [];
});
const files = sourceFiles(sourceRoot);
const contents = (path: string) => readFileSync(path, 'utf8');
const names = (matches: string[]) => matches.map(path => relative(sourceRoot, path).replaceAll('\\', '/'));

describe('Визуальный контракт', () => {
  it('не анимирует фон переключателя темы отдельно от цвета текста', () => {
    const themeSwitch = contents(join(sourceRoot, 'components/ThemeSwitch.astro'));
    expect(themeSwitch).toMatch(/\.theme-switch button\s*\{\s*transition:\s*border-color var\(--motion-interaction\);\s*\}/);
  });

  it('не анимирует фон остальных кнопок при загрузке сохранённой темы', () => {
    const global = contents(join(sourceRoot, 'styles/global.css'));
    expect(global).not.toMatch(/button\s*\{[^}]*transition:\s*background\b/);
  });

  it('размещает утверждённую иллюстрацию в главном экране как декорацию', () => {
    const home = contents(join(sourceRoot, 'pages/index.astro'));
    expect(home).toContain("import learningCore from '../assets/learning-core.png'");
    expect(home).toMatch(/<img[^>]+src=\{learningCore\.src\}[^>]+alt=""[^>]+aria-hidden="true"/);
  });

  it('показывает шесть миссий как связанный маршрут на широком и узком экране', () => {
    const home = contents(join(sourceRoot, 'pages/index.astro'));
    expect(home).toMatch(/\.missions li:not\(:last-child\)::after\s*\{/);
    expect(home).toMatch(/\.missions\s*\{[^}]*grid-template-columns:\s*repeat\(6,/);
    expect(home).toMatch(/@media\s*\(max-width:\s*1050px\)[\s\S]*\.missions li:not\(:last-child\)::after\s*\{/);
  });

  it('сохраняет утверждённые основные цвета и роли в двух темах', () => {
    const tokens = contents(join(sourceRoot, 'styles/tokens.css'));
    const dark = tokens.split(":root[data-theme='light']")[0];
    const light = tokens.split(":root[data-theme='light']")[1];
    expect(dark).toMatch(/--page:\s*#080A0D\s*;/);
    expect(dark).toMatch(/--accent-primary:\s*#4DF58C\s*;/);
    expect(dark).toMatch(/--accent-secondary:\s*#8B7CFF\s*;/);
    expect(light).toMatch(/--page:\s*#F5F3FA\s*;/);
    expect(light).toMatch(/--accent-primary:\s*#176B3E\s*;/);
    expect(light).toMatch(/--accent-secondary:\s*#5A48C7\s*;/);
  });

  it('подключает глобальные стили только один раз в корневом layout', () => {
    for (const stylesheet of ['tokens.css', 'global.css']) {
      const matches = files.filter(path => new RegExp(`(?:import|@import)[^\\n]*[/\\\\]${stylesheet.replace('.', '\\.')}`).test(contents(path)));
      expect(names(matches)).toEqual(['layouts/Layout.astro']);
      expect(contents(matches[0]!).match(new RegExp(stylesheet.replace('.', '\\.'), 'g'))).toHaveLength(1);
    }
  });

  it('не содержит цветов палитры и глобальных селекторов вне разрешённого места', () => {
    const offenders = files.filter(path => !path.endsWith(join('styles', 'tokens.css')) &&
      /#[\da-f]{3,8}\b|\brgba?\s*\(|\bis:global\s*\(/i.test(contents(path)));
    expect(names(offenders)).toEqual([]);
    const cssFiles = files.filter(path => path.endsWith('.css') && !path.endsWith(join('styles', 'tokens.css')) && !path.endsWith(join('styles', 'global.css')));
    expect(names(cssFiles.filter(path => !path.endsWith('.module.css')))).toEqual([]);
  });

  it('не добавляет стороннюю систему стилей', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>; devDependencies: Record<string, string>;
    };
    const packages = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    expect(packages.filter(name => /^(tailwindcss|sass|less|stylus|styled-components|@emotion\/|@stitches\/|@mui\/|bootstrap$)/.test(name))).toEqual([]);
  });
});
