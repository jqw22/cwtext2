import { useCallback } from 'react';
import JSZip from 'jszip';
import type { StructuredNote } from './useStructuredNotes';

/**
 * Generate an ODT (Open Document Text) file from a list of notes.
 * @param notes - The notes to export.
 * @param title - Optional document title.
 * @param tags - Optional list of active filter tags to include in the header.
 */
async function generateODT(notes: StructuredNote[], title?: string, tags?: string[]): Promise<Blob> {
  const zip = new JSZip();

  // -- mimetype (must be first, uncompressed) --
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', {
    compression: 'STORE',
  });

  // -- META-INF/manifest.xml --
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
                   manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2"
                       manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml"
                       manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml"
                       manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml"
                       manifest:media-type="text/xml"/>
</manifest:manifest>`;
  zip.file('META-INF/manifest.xml', manifest);

  // -- meta.xml --
  const meta = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                      xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
                      office:version="1.2">
  <office:meta>
    <meta:generator>cwtext Shakespeare</meta:generator>
    <meta:creation-date>${new Date().toISOString()}</meta:creation-date>
    <meta:initial-creator>cwtext</meta:initial-creator>
  </office:meta>
</office:document-meta>`;
  zip.file('meta.xml', meta);

  // -- styles.xml --
  const styles = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                        xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                        xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                        office:version="1.2">
  <office:styles>
    <style:style style:name="Title" style:family="paragraph">
      <style:text-properties fo:font-size="20pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading1" style:family="paragraph">
      <style:text-properties fo:font-size="16pt" fo:font-weight="bold"/>
      <style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.25cm"/>
    </style:style>
    <style:style style:name="BodyText" style:family="paragraph">
      <style:text-properties fo:font-size="11pt"/>
      <style:paragraph-properties fo:margin-bottom="0.25cm"/>
    </style:style>
    <style:style style:name="Tags" style:family="paragraph">
      <style:text-properties fo:font-size="9pt" fo:color="#666666" fo:font-style="italic"/>
    </style:style>
    <style:style style:name="Separator" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.5cm"/>
      <style:text-properties fo:font-size="11pt" fo:color="#999999"/>
    </style:style>
  </office:styles>
</office:document-styles>`;
  zip.file('styles.xml', styles);

  // -- content.xml --
  const escapeXml = (s: string): string =>
    s.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const docTitle = title ? escapeXml(title) : 'Exported Notes';

  let contentBody = '';

  // Document title
  contentBody += `<text:h text:style-name="Title">${docTitle}</text:h>\n`;

  // Generation info
  const now = new Date().toLocaleString();
  contentBody += `<text:p text:style-name="Tags">Generated on ${escapeXml(now)} — ${notes.length} note(s)</text:p>\n`;

  // Active filter tags in header (if any)
  if (tags && tags.length > 0) {
    const tagStr = tags.map((t) => `#${escapeXml(t)}`).join(', ');
    contentBody += `<text:p text:style-name="Tags">Tags: ${escapeXml(tagStr)}</text:p>\n`;
  }

  contentBody += `<text:p text:style-name="Separator">──────────</text:p>\n`;

  // Ordered list of notes
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    // Heading (no numbering, no per-note tags)
    contentBody += `<text:h text:style-name="Heading1">${escapeXml(note.title)}</text:h>\n`;

    // Content body - escape and preserve paragraphs
    const paragraphs = note.content.split(/\n\s*\n/);
    for (const para of paragraphs) {
      if (para.trim()) {
        const lines = para
          .split('\n')
          .map((l) => escapeXml(l))
          .join('<text:line-break/>');
        contentBody += `<text:p text:style-name="BodyText">${lines}</text:p>\n`;
      }
    }

    // Separator between notes (except last)
    if (i < notes.length - 1) {
      contentBody += `<text:p text:style-name="Separator">──────────</text:p>\n`;
    }
  }

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                         xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                         xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
                         office:version="1.2">
  <office:body>
    <office:text>
      ${contentBody}
    </office:text>
  </office:body>
</office:document-content>`;
  zip.file('content.xml', contentXml);

  // Generate the ZIP as a Blob
  return zip.generateAsync({ type: 'blob' });
}

/** Hook that provides an ODT export function */
export function useODTExport() {
  const exportToODT = useCallback(
    async (notes: StructuredNote[], title?: string, tags?: string[]): Promise<void> => {
      if (notes.length === 0) {
        throw new Error('No notes to export');
      }

      const blob = await generateODT(notes, title, tags);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = title
        ? `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.odt`
        : 'cwtext_export.odt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [],
  );

  return { exportToODT };
}
