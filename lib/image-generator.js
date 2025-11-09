/**
 * Image Generator using html2canvas
 * Creates images from notes using HTML templates
 *
 * Note: html2canvas library must be loaded separately
 * You can extract it from the Save.day extension's index.js file
 * or download from: https://html2canvas.hertzen.com/
 */

class ImageGenerator {
  constructor() {
    this.templateManager = new TemplateManager();
  }

  /**
   * Generate image from note using specified template
   */
  async generateImage(note, templateName = 'default') {
    try {
      // Create container
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      // Get template HTML
      const html = this.templateManager.getTemplate(templateName, note);
      container.innerHTML = html;

      const element = container.firstElementChild;

      // Wait for fonts to load
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Generate image using html2canvas
      if (typeof html2canvas === 'undefined') {
        throw new Error('html2canvas library not loaded. Please include it in your HTML.');
      }

      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      // Clean up
      document.body.removeChild(container);

      return canvas;
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  /**
   * Generate and download image
   */
  async downloadImage(note, templateName = 'default', format = 'png') {
    try {
      const canvas = await this.generateImage(note, templateName);

      // Convert canvas to blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, `image/${format}`);
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.sanitizeFilename(note.title)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }

  /**
   * Generate and copy image to clipboard
   */
  async copyImageToClipboard(note, templateName = 'default') {
    try {
      const canvas = await this.generateImage(note, templateName);

      // Convert canvas to blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      return true;
    } catch (error) {
      console.error('Error copying image to clipboard:', error);
      throw error;
    }
  }

  /**
   * Get preview URL for a note
   */
  async getPreviewUrl(note, templateName = 'default') {
    try {
      const canvas = await this.generateImage(note, templateName);
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating preview:', error);
      throw error;
    }
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates() {
    return this.templateManager.getTemplateNames();
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
      .substring(0, 50) || 'note';
  }

  /**
   * Batch generate images for multiple notes
   */
  async generateMultipleImages(notes, templateName = 'default', onProgress = null) {
    const results = [];

    for (let i = 0; i < notes.length; i++) {
      try {
        await this.downloadImage(notes[i], templateName);
        results.push({ note: notes[i], success: true });

        if (onProgress) {
          onProgress(i + 1, notes.length);
        }

        // Small delay to prevent browser from freezing
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({ note: notes[i], success: false, error });
      }
    }

    return results;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageGenerator;
}
