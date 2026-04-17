/*
 * Markdown export for page notes + highlights.
 */

class PageNoteExporter {
  exportPageNote(pageNote, selectedHighlightIds) {
    const title = pageNote.pageTitle || pageNote.url;
    const url = pageNote.url;
    const highlights = selectedHighlightIds
      ? pageNote.highlights.filter((h) => selectedHighlightIds.includes(h.id))
      : pageNote.highlights;
    const date = new Date(pageNote.updatedAt || pageNote.createdAt).toISOString().slice(0, 10);

    let md = '---\n';
    md += `title: "${title.replace(/"/g, '\\"')}"\n`;
    md += `url: "${url}"\n`;
    md += `date: ${date}\n`;
    md += `highlights: ${highlights.length}\n`;
    md += '---\n\n';
    md += `# ${title}\n\n`;
    md += `Source: [${url}](${url})\n\n`;

    if (highlights.length === 0) {
      md += '_No highlights' + (selectedHighlightIds ? ' selected' : '') + '._\n';
    } else {
      for (const h of highlights) {
        md += this._fmtHighlight(h) + '\n';
      }
    }

    if (pageNote.savedContent) {
      md += '---\n\n## Saved Content\n\n' + pageNote.savedContent + '\n';
    }

    return md;
  }

  exportAllPageNotes(pageNotes) {
    if (!pageNotes || pageNotes.length === 0) {
      return '---\ntitle: "Offline Notes Export"\ndate: ' + new Date().toISOString().slice(0, 10) + '\npages: 0\n---\n\n_No page notes to export._\n';
    }

    let md = '---\n';
    md += 'title: "Offline Notes Export"\n';
    md += 'date: ' + new Date().toISOString().slice(0, 10) + '\n';
    md += 'pages: ' + pageNotes.length + '\n';
    md += '---\n\n';

    for (let i = 0; i < pageNotes.length; i++) {
      const note = pageNotes[i];
      const title = note.pageTitle || note.url;
      const date = new Date(note.updatedAt || note.createdAt).toISOString().slice(0, 10);

      md += `## ${title}\n\n`;
      md += `Source: [${note.url}](${note.url})  \n`;
      md += `Date: ${date} · ${note.highlights.length} highlight${note.highlights.length === 1 ? '' : 's'}\n\n`;

      if (note.highlights.length === 0) {
        md += '_No highlights._\n';
      } else {
        for (const h of note.highlights) {
          md += this._fmtHighlight(h) + '\n';
        }
      }

      if (note.savedContent) {
        md += '### Saved Content\n\n' + note.savedContent + '\n';
      }

      if (i < pageNotes.length - 1) md += '\n---\n\n';
    }

    return md;
  }

  _fmtHighlight(h) {
    const lines = (h.text || '').split('\n');
    let block = lines.map((l) => '> ' + l).join('\n') + '\n';
    if (h.comment) {
      block += '>\n> _' + h.comment.replace(/\n/g, ' ') + '_\n';
    }
    return block;
  }

  downloadMarkdown(text, filename) {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename || 'export') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async copyToClipboard(text) {
    await navigator.clipboard.writeText(text);
  }

  sanitizeFilename(title) {
    return (title || 'page-note')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}

if (typeof window !== 'undefined') window.PageNoteExporter = PageNoteExporter;
if (typeof module !== 'undefined' && module.exports) module.exports = PageNoteExporter;
