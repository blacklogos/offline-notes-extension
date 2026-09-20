/*
 * Offline Notes — Cornell layout for a page note.
 *
 * Cornell is a page layout, not a data model: a cue column, the notes, and a
 * summary underneath. Everything it needs already exists here, so this adds no
 * fields and changes no flow. The cue column is the comment you already wrote
 * on a highlight, the notes column is the quote, and the summary is the page
 * summary. Nothing new to type.
 *
 * Emitted as a markdown table so it stays readable in any editor and in the
 * vault. A highlight with no comment leaves its cue blank rather than being
 * dropped, because an unannotated quote is still part of the page.
 */
// Available as a global in the extension, and via require in the tests.
const CORNELL_STYLE = (typeof HighlightStyle !== 'undefined')
  ? HighlightStyle
  : (typeof require !== 'undefined' ? require('./highlight-style.js') : null);

class CornellExporter {
  /** @param {object} pageNote  @param {string[]|null} selectedIds */
  export(pageNote, selectedIds) {
    const title = pageNote.pageTitle || pageNote.url;
    const all = pageNote.highlights || [];
    const highlights = selectedIds ? all.filter((h) => selectedIds.includes(h.id)) : all;
    const date = new Date(pageNote.updatedAt || pageNote.createdAt || Date.now()).toISOString().slice(0, 10);

    let md = '---\n';
    md += `title: "${String(title).replace(/"/g, '\\"')}"\n`;
    md += `url: "${pageNote.url}"\n`;
    md += `date: ${date}\n`;
    md += 'layout: cornell\n';
    md += '---\n\n';
    md += `# ${title}\n\n`;
    md += `Source: [${pageNote.url}](${pageNote.url})\n\n`;

    md += '| Cue | Notes |\n| --- | --- |\n';
    if (highlights.length === 0) {
      md += '| | _No highlights' + (selectedIds ? ' selected' : '') + '._ |\n';
    } else {
      for (const h of highlights) {
        md += `| ${this._cell(h.comment || '')} | ${this._cell(this._quote(h))} |\n`;
      }
    }

    md += '\n## Summary\n\n';
    md += (pageNote.summary && pageNote.summary.trim())
      ? `${pageNote.summary.trim()}\n`
      : '_Not written yet._\n';

    return md;
  }

  // Emphasis survives into the cue table as bold, same as the plain export.
  _quote(h) {
    return (CORNELL_STYLE && CORNELL_STYLE.quoteToMarkdown) ? CORNELL_STYLE.quoteToMarkdown(h) : (h.text || '');
  }

  // A table cell cannot contain a raw newline or an unescaped pipe.
  _cell(text) {
    return String(text || '')
      .replace(/\|/g, '\\|')
      .replace(/\s*\n\s*/g, ' ')
      .trim();
  }

  filename(pageNote) {
    const base = String(pageNote.pageTitle || 'page')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .toLowerCase() || 'page';
    return `${base}-cornell.md`;
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { CornellExporter };
