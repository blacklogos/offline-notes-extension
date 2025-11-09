/**
 * Markdown Export Utility
 * Convert notes to Markdown format and trigger download
 */

class MarkdownExporter {
  /**
   * Convert a single note to Markdown
   */
  noteToMarkdown(note) {
    const lines = [];

    // Title
    lines.push(`# ${note.title}`);
    lines.push('');

    // Metadata
    lines.push('---');
    lines.push(`Created: ${new Date(note.createdAt).toLocaleString()}`);
    lines.push(`Updated: ${new Date(note.updatedAt).toLocaleString()}`);
    if (note.tags && note.tags.length > 0) {
      lines.push(`Tags: ${note.tags.map(t => `#${t}`).join(', ')}`);
    }
    lines.push('---');
    lines.push('');

    // Content
    lines.push(note.content);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Convert multiple notes to Markdown
   */
  notesToMarkdown(notes) {
    const lines = [];

    lines.push('# My Notes');
    lines.push('');
    lines.push(`Exported: ${new Date().toLocaleString()}`);
    lines.push(`Total Notes: ${notes.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    notes.forEach((note, index) => {
      if (index > 0) {
        lines.push('');
        lines.push('---');
        lines.push('');
      }
      lines.push(this.noteToMarkdown(note));
    });

    return lines.join('\n');
  }

  /**
   * Download a note as Markdown file
   */
  downloadNote(note) {
    const markdown = this.noteToMarkdown(note);
    const filename = this.sanitizeFilename(note.title) + '.md';
    this.downloadFile(markdown, filename, 'text/markdown');
  }

  /**
   * Download all notes as a single Markdown file
   */
  downloadAllNotes(notes) {
    const markdown = this.notesToMarkdown(notes);
    const filename = `all-notes-${this.getDateString()}.md`;
    this.downloadFile(markdown, filename, 'text/markdown');
  }

  /**
   * Download notes by tag
   */
  downloadNotesByTag(notes, tag) {
    const markdown = this.notesToMarkdown(notes);
    const filename = `notes-${this.sanitizeFilename(tag)}-${this.getDateString()}.md`;
    this.downloadFile(markdown, filename, 'text/markdown');
  }

  /**
   * Copy note to clipboard as Markdown
   */
  async copyToClipboard(note) {
    const markdown = this.noteToMarkdown(note);
    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  }

  /**
   * Convert Markdown to HTML (simple parser)
   */
  markdownToHtml(markdown) {
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');

    // Code blocks
    html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraphs
    html = '<p>' + html + '</p>';

    // Lists
    html = html.replace(/<p>- (.+?)<\/p>/g, '<ul><li>$1</li></ul>');

    return html;
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(filename) {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  /**
   * Get date string for filename
   */
  getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Download file helper
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkdownExporter;
}
