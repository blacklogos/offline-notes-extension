/**
 * HTML Template System for Image Generation
 *
 * Five warm-paper templates rendered to PNG via html2canvas. Templates use inline
 * style strings with literal token values because html2canvas renders into an
 * isolated container and does not reliably inherit external stylesheets or
 * @font-face declarations from the host document.
 *
 * Token literals duplicated here mirror lib/tokens.css. Keep them in sync if the
 * palette changes:
 *   paper-50  #FAF7F2   ink-700  #4A453E   sage-300  #A8BBA8
 *   paper-100 #F5F1EA   ink-900  #2A2622   sage-500  #7C9885
 *   paper-200 #EAE4D8                      sage-700  #5F7A6A
 *   paper-300 #D8D0BF                      mark      #F4E4A1
 *
 * html2canvas v1.4.1 caveats baked into the markup below:
 *   - No `display: flex` (vertical centering and column direction are unreliable).
 *   - No `<header>` / `<footer>` / `<section>` (semantic elements default-display
 *     inconsistently in the cloned iframe). Use plain `<div>`.
 *   - Footer pinning uses `position: absolute; bottom; left; right`.
 */

class TemplateManager {
  constructor() {
    this.templates = {
      'paper-default':    this.paperDefault.bind(this),
      'paper-minimal':    this.paperMinimal.bind(this),
      'paper-quote':      this.paperQuote.bind(this),
      'paper-card':       this.paperCard.bind(this),
      'paper-letterhead': this.paperLetterhead.bind(this),
    };
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '…';
  }

  getTemplate(templateName, note) {
    const template = this.templates[templateName] || this.templates['paper-default'];
    return template(note);
  }

  getTemplateNames() {
    return Object.keys(this.templates);
  }

  fontStack() {
    return `"Inter Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }

  formatDate(iso, opts) {
    return new Date(iso).toLocaleDateString('en-US', opts || { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /**
   * paper-default — 800×600. Centered headline, sage divider above metadata footer.
   */
  paperDefault(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 500));
    const tags = (note.tags || []).map((t) => this.escapeHtml(t));
    const date = this.formatDate(note.createdAt);

    return `
      <div style="
        position: relative;
        width: 800px; height: 600px;
        background: #FAF7F2; color: #2A2622;
        font-family: ${this.fontStack()};
        padding: 64px 72px 96px 72px;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <h1 style="
          margin: 0 0 24px 0; text-align: center;
          font-size: 44px; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em;
          color: #2A2622;
        ">${title}</h1>

        <div style="
          font-size: 19px; line-height: 1.6;
          white-space: pre-wrap; word-wrap: break-word;
          color: #2A2622;
          max-height: 320px;
          overflow: hidden;
        ">${content}</div>

        <div style="
          position: absolute;
          left: 72px; right: 72px; bottom: 40px;
          padding-top: 16px;
          border-top: 1px solid #7C9885;
          font-size: 14px; font-weight: 600; color: #5F7A6A;
        ">
          <span style="display: inline-block;">${date}</span>
          <span style="float: right;">${tags.length ? tags.map((t) => '#' + t).join('  ') : 'Offline Notes'}</span>
        </div>
      </div>
    `;
  }

  /**
   * paper-minimal — 800×600. Hard left-aligned, generous margin, pure typography.
   */
  paperMinimal(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 450));
    const tags = (note.tags || []).map((t) => this.escapeHtml(t));

    const tagsHtml = tags.length > 0
      ? `<div style="
           position: absolute;
           left: 96px; right: 72px; bottom: 56px;
           font-size: 14px; font-weight: 600; color: #5F7A6A;
         ">${tags.map((t) => '#' + t).join('   ')}</div>`
      : '';

    return `
      <div style="
        position: relative;
        width: 800px; height: 600px;
        background: #FAF7F2; color: #2A2622;
        font-family: ${this.fontStack()};
        padding: 80px 72px 80px 96px;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <h1 style="
          margin: 0 0 32px 0;
          font-size: 36px; font-weight: 600; line-height: 1.2;
          color: #2A2622;
        ">${title}</h1>

        <div style="
          font-size: 18px; line-height: 1.7;
          white-space: pre-wrap; word-wrap: break-word;
          color: #4A453E;
          max-height: 360px;
          overflow: hidden;
        ">${content}</div>

        ${tagsHtml}
      </div>
    `;
  }

  /**
   * paper-quote — 800×800 square. Centered text-align, vertically pushed via padding.
   */
  paperQuote(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 220));

    return `
      <div style="
        position: relative;
        width: 800px; height: 800px;
        background: #FAF7F2; color: #2A2622;
        font-family: ${this.fontStack()};
        padding: 200px 96px 96px 96px;
        box-sizing: border-box;
        text-align: center;
        overflow: hidden;
      ">
        <div style="
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 96px; line-height: 0.8; color: #7C9885;
          margin: 0 0 16px 0;
        ">&ldquo;</div>

        <div style="
          margin: 0 auto;
          max-width: 540px;
          font-size: 24px; line-height: 1.6;
          font-style: italic; font-weight: 400;
          white-space: pre-wrap; word-wrap: break-word;
          color: #2A2622;
        ">${content}</div>

        <div style="
          width: 48px; height: 1px; background: #7C9885;
          margin: 36px auto 20px auto;
        "></div>

        <div style="
          font-size: 14px; font-weight: 600; color: #5F7A6A;
          letter-spacing: 0.04em; text-transform: uppercase;
        ">from ${title}</div>
      </div>
    `;
  }

  /**
   * paper-card — 800×600. Outer paper-50, inner paper-100 card with paper-300 border.
   */
  paperCard(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 350));
    const tags = (note.tags || []).map((t) => this.escapeHtml(t));
    const date = this.formatDate(note.createdAt);

    return `
      <div style="
        position: relative;
        width: 800px; height: 600px;
        background: #FAF7F2; color: #2A2622;
        font-family: ${this.fontStack()};
        padding: 48px;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <h2 style="
          margin: 0 0 20px 0;
          font-size: 28px; font-weight: 700; line-height: 1.2;
          color: #2A2622;
        ">${title}</h2>

        <div style="
          background: #F5F1EA;
          border: 1px solid #D8D0BF;
          border-radius: 8px;
          padding: 32px;
          font-size: 16px; line-height: 1.7;
          white-space: pre-wrap; word-wrap: break-word;
          color: #2A2622;
          height: 384px;
          overflow: hidden;
          box-sizing: border-box;
        ">${content}</div>

        <div style="
          position: absolute;
          left: 48px; right: 48px; bottom: 32px;
          font-size: 12px; color: #4A453E;
        ">
          <span style="color: #5F7A6A; font-weight: 600;">
            ${tags.length ? tags.map((t) => '#' + t).join('  ') : '\u00A0'}
          </span>
          <span style="float: right;">${date}</span>
        </div>
      </div>
    `;
  }

  /**
   * paper-letterhead — 800×600. Notebook glyph + brand mark, sage rule, body, dated footer.
   */
  paperLetterhead(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 600));
    const tags = (note.tags || []).map((t) => this.escapeHtml(t));
    const date = this.formatDate(note.createdAt, { year: 'numeric', month: 'long', day: 'numeric' });

    // Inline notebook glyph mirrors images/icon.svg (cream + sage spine).
    const glyph = `<svg width="28" height="28" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 10px;">
      <defs><clipPath id="bk"><rect x="22" y="14" width="84" height="100" rx="6"/></clipPath></defs>
      <rect x="22" y="14" width="84" height="100" rx="6" fill="#FAF7F2"/>
      <rect x="22" y="14" width="16" height="100" fill="#7C9885" clip-path="url(#bk)"/>
      <rect x="22" y="14" width="84" height="100" rx="6" fill="none" stroke="#D8D0BF" stroke-width="1.5"/>
    </svg>`;

    return `
      <div style="
        position: relative;
        width: 800px; height: 600px;
        background: #FAF7F2; color: #2A2622;
        font-family: ${this.fontStack()};
        padding: 56px 64px 80px 64px;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <div style="
          padding-bottom: 16px;
          border-bottom: 1px solid #7C9885;
          line-height: 28px;
        ">
          ${glyph}<span style="
            font-size: 14px; font-weight: 600; color: #5F7A6A;
            letter-spacing: 0.04em;
            vertical-align: middle;
          ">Offline Notes</span>
        </div>

        <h1 style="
          margin: 28px 0 16px 0;
          font-size: 28px; font-weight: 700; line-height: 1.3;
          color: #2A2622;
        ">${title}</h1>

        <div style="
          font-size: 16px; line-height: 1.7;
          color: #2A2622;
          white-space: pre-wrap; word-wrap: break-word;
          max-height: 320px;
          overflow: hidden;
        ">${content}</div>

        <div style="
          position: absolute;
          left: 64px; right: 64px; bottom: 36px;
          font-size: 12px; color: #4A453E;
        ">
          <span style="color: #5F7A6A; font-weight: 600;">
            ${tags.length ? tags.map((t) => '#' + t).join('  ') : '\u00A0'}
          </span>
          <span style="float: right;">${date}</span>
        </div>
      </div>
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TemplateManager;
}
