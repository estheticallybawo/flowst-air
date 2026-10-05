import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { parseAirsMessage, renderAirsMessage } from '../shared/airsMessage';

async function render(text: string) {
  return renderToString(createSSRApp({ render: () => h('div', renderAirsMessage(text)) }));
}

describe('Airs conversational message formatting', () => {
  it('formats manageable paragraphs, lists, emphasis, inline code and code blocks', async () => {
    const html = await render('# Try explaining this\n\nStart with **one idea** and *why it matters*.\n\n- Explain `reserveUsage()`\n- Give an example\n\n```ts\nconst limit = 120;\n```');
    expect(html).toContain('<p class="message-heading"><strong>Try explaining this</strong></p>');
    expect(html).toContain('<strong>one idea</strong>');
    expect(html).toContain('<em>why it matters</em>');
    expect(html).toContain('<ul><li>Explain <code>reserveUsage()</code></li><li>Give an example</li></ul>');
    expect(html).toContain('<pre><code>const limit = 120;</code></pre>');
  });

  it('renders speech and fetched HTML as escaped text without executable attributes', async () => {
    const html = await render('<script>window.pwned = true</script>\n\n<img src=x onerror="alert(1)">\n\n**<svg onload=alert(1)>**');
    expect(html).toContain('&lt;script&gt;window.pwned = true&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('<strong>&lt;svg onload=alert(1)&gt;</strong>');
    expect(html).not.toMatch(/<(script|img|svg)\b/);
  });

  it('does not turn markdown URLs, images or provider-supplied javascript into active links', async () => {
    const html = await render('[click](javascript:alert(1))\n\n![image](https://tracker.example/pixel)\n\nhttps://example.com');
    expect(html).not.toMatch(/<(a|img)\b/);
    expect(html).not.toContain('href=');
    expect(html).not.toContain('src=');
    expect(html).toContain('[click](javascript:alert(1))');
  });

  it('keeps source code literal, including markdown and HTML inside an unfinished fence', async () => {
    const html = await render('```html\n<img onerror="bad()">\n**not emphasis**');
    expect(html).toContain('<pre><code>&lt;img onerror=&quot;bad()&quot;&gt;\n**not emphasis**</code></pre>');
    expect(html).not.toContain('<strong>');
  });

  it('keeps numbered steps and source text without generating document-level headings', async () => {
    const blocks = parseAirsMessage('3. Begin with the purpose\n4. Explain the tradeoff\n\n## Your next attempt\n\nKeep it concise.');
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: true, start: 3 });
    const html = await render('3. Begin with the purpose\n4. Explain the tradeoff\n\n## Your next attempt');
    expect(html).toContain('<ol start="3">');
    expect(html).not.toMatch(/<h[1-6]/);
  });
});
