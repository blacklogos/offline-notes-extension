/**
 * HTML Template System for Image Generation
 * Create beautiful image cards from notes using html2canvas
 */

class TemplateManager {
  constructor() {
    // Bind all template methods to this instance
    this.templates = {
      default: this.defaultTemplate.bind(this),
      minimal: this.minimalTemplate.bind(this),
      card: this.cardTemplate.bind(this),
      quote: this.quoteTemplate.bind(this),
      modern: this.modernTemplate.bind(this)
    };
  }

  /**
   * Helper: Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Helper: Truncate text
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Get template HTML
   */
  getTemplate(templateName, note) {
    const template = this.templates[templateName] || this.templates.default;
    return template(note);
  }

  /**
   * Default template - Gradient with glassmorphism
   */
  defaultTemplate(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 500));
    const tags = (note.tags || []).map(tag => this.escapeHtml(tag));
    const date = new Date(note.createdAt).toLocaleDateString();

    return `
      <div style="
        width: 800px;
        min-height: 600px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 60px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: white;
        box-sizing: border-box;
        position: relative;
      ">
        <div style="
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 50px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        ">
          <h1 style="
            margin: 0 0 20px 0;
            font-size: 48px;
            font-weight: 700;
            line-height: 1.2;
          ">${title}</h1>

          ${tags.length > 0 ? `
            <div style="margin-bottom: 30px;">
              ${tags.map(tag => `
                <span style="
                  display: inline-block;
                  background: rgba(255, 255, 255, 0.2);
                  padding: 8px 16px;
                  border-radius: 20px;
                  margin-right: 10px;
                  font-size: 14px;
                  font-weight: 500;
                ">#${tag}</span>
              `).join('')}
            </div>
          ` : ''}

          <div style="
            font-size: 20px;
            line-height: 1.8;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 400px;
            overflow: hidden;
          ">${content}</div>

          <div style="
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
            font-size: 14px;
            opacity: 0.8;
          ">
            Created: ${date}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Minimal template - Clean and simple
   */
  minimalTemplate(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 400));
    const tags = (note.tags || []).map(tag => this.escapeHtml(tag));

    return `
      <div style="
        width: 800px;
        min-height: 600px;
        background: #ffffff;
        padding: 80px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #1a1a1a;
        box-sizing: border-box;
        position: relative;
      ">
        <h1 style="
          margin: 0 0 40px 0;
          font-size: 56px;
          font-weight: 700;
          line-height: 1.1;
          color: #000;
        ">${title}</h1>

        <div style="
          font-size: 22px;
          line-height: 1.8;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #333;
        ">${content}</div>

        <div style="
          position: absolute;
          bottom: 80px;
          left: 80px;
          right: 80px;
          padding-top: 40px;
          border-top: 3px solid #000;
          font-size: 18px;
          color: #666;
        ">
          ${tags.length > 0 ? tags.map(tag => `#${tag}`).join(' • ') : 'Personal Note'}
        </div>
      </div>
    `;
  }

  /**
   * Card template - Compact and colorful
   */
  cardTemplate(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 250));
    const date = new Date(note.createdAt).toLocaleDateString();

    return `
      <div style="
        width: 600px;
        height: 400px;
        background: #f8f9fa;
        padding: 50px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #212529;
        box-sizing: border-box;
        border-radius: 24px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        position: relative;
        overflow: hidden;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 8px;
          background: linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1);
        "></div>

        <h2 style="
          margin: 0 0 20px 0;
          font-size: 36px;
          font-weight: 700;
          color: #212529;
        ">${title}</h2>

        <p style="
          font-size: 18px;
          line-height: 1.6;
          color: #495057;
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          max-height: 200px;
          overflow: hidden;
        ">${content}</p>

        <div style="
          position: absolute;
          bottom: 50px;
          left: 50px;
          font-size: 14px;
          color: #6c757d;
        ">${date}</div>
      </div>
    `;
  }

  /**
   * Quote template - Dark theme
   */
  quoteTemplate(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 200));

    return `
      <div style="
        width: 800px;
        height: 500px;
        background: #1a1a2e;
        padding: 80px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #eee;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <div style="text-align: center; max-width: 600px;">
          <div style="
            font-size: 72px;
            line-height: 1;
            color: #16213e;
            margin-bottom: 20px;
          ">"</div>

          <div style="
            font-size: 32px;
            line-height: 1.5;
            font-weight: 400;
            margin-bottom: 40px;
            font-style: italic;
          ">${content}</div>

          <div style="
            width: 60px;
            height: 3px;
            background: linear-gradient(90deg, #0f3460, #533483);
            margin: 0 auto 30px;
          "></div>

          <div style="
            font-size: 20px;
            font-weight: 600;
            color: #e94560;
          ">${title}</div>
        </div>
      </div>
    `;
  }

  /**
   * Modern template - Gradient header
   */
  modernTemplate(note) {
    const title = this.escapeHtml(note.title || 'Untitled');
    const content = this.escapeHtml(this.truncateText(note.content || '', 600));
    const tags = (note.tags || []).map(tag => this.escapeHtml(tag));
    const date = new Date(note.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <div style="
        width: 900px;
        min-height: 700px;
        background: #0a0a0a;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #fff;
        box-sizing: border-box;
        position: relative;
      ">
        <div style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
          height: 200px;
          padding: 50px 60px;
          display: flex;
          align-items: flex-end;
        ">
          <h1 style="
            margin: 0;
            font-size: 48px;
            font-weight: 800;
            color: white;
            text-shadow: 0 2px 10px rgba(0,0,0,0.2);
          ">${title}</h1>
        </div>

        <div style="padding: 60px;">
          ${tags.length > 0 ? `
            <div style="margin-bottom: 30px;">
              ${tags.map(tag => `
                <span style="
                  display: inline-block;
                  background: linear-gradient(135deg, #667eea, #764ba2);
                  padding: 10px 20px;
                  border-radius: 25px;
                  margin-right: 12px;
                  font-size: 14px;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                ">${tag}</span>
              `).join('')}
            </div>
          ` : ''}

          <div style="
            font-size: 20px;
            line-height: 1.8;
            color: #e0e0e0;
            white-space: pre-wrap;
            word-wrap: break-word;
          ">${content}</div>

          <div style="
            margin-top: 60px;
            font-size: 14px;
            color: #808080;
            text-transform: uppercase;
            letter-spacing: 2px;
          ">
            ${date}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get all template names
   */
  getTemplateNames() {
    return Object.keys(this.templates);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TemplateManager;
}
