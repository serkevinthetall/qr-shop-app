function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function htmlToPlainText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

function normalizeDescriptionPart(value: string | false | undefined) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  return htmlToPlainText(value);
}

export function getProductDescription(product: {
  description_ecommerce?: string | false;
  description?: string | false;
  website_description?: string | false;
  description_sale?: string | false;
}) {
  const longDescription = normalizeDescriptionPart(product.description_ecommerce);
  const internalNotes = normalizeDescriptionPart(product.description);

  const combined = [longDescription, internalNotes].filter(Boolean).join('\n\n');

  if (combined) {
    return combined;
  }

  const legacyCandidates = [product.website_description, product.description_sale];

  for (const raw of legacyCandidates) {
    const text = normalizeDescriptionPart(raw);

    if (text) {
      return text;
    }
  }

  return '';
}

export function getProductDescriptionSections(product: {
  description_ecommerce?: string | false;
  description?: string | false;
}) {
  return {
    longDescription: normalizeDescriptionPart(product.description_ecommerce),
    internalNotes: normalizeDescriptionPart(product.description),
  };
}
