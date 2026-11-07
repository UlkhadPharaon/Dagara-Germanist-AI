export const exportToWord = (htmlContent: string, filename: string) => {
  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${filename}</title>
      <style>
        body { font-family: 'Calibri', 'Arial', sans-serif; color: #333; line-height: 1.6; }
        h1 { color: #0f172a; font-size: 24pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
        h2 { color: #334155; font-size: 18pt; margin-top: 24px; }
        h3 { color: #475569; font-size: 14pt; }
        p { margin-bottom: 12px; }
        ul, ol { margin-bottom: 16px; }
        li { margin-bottom: 6px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
        th { background-color: #f8fafc; }
      </style>
    </head>
    <body>${htmlContent}</body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
