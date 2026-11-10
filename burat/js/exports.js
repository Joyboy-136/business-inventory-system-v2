'use strict';

const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

const Export = {
  fmt(value, type) {
    if (value == null || value === '') return '';
    if (type === 'money') return peso(value);
    if (type === 'num') return Number(value).toLocaleString('en-US');
    return String(value);
  },
  fmtPlain(value, type) {
    if (value == null || value === '') return '';
    if (type === 'money') return 'PHP ' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (type === 'num') return Number(value).toLocaleString('en-US');
    return String(value);
  },

  html(report) {
    const cards = report.cards.map(c => '<div class="rcard"><span>' + esc(c.label) + '</span><strong>' + esc(Export.fmt(c.value, c.type)) + '</strong></div>').join('');
    const sections = report.sections.map(s => {
      const head = s.columns.map(c => '<th' + (c.type !== 'text' ? ' class="r"' : '') + '>' + esc(c.label) + '</th>').join('');
      const body = s.rows.length
        ? s.rows.map(r => '<tr>' + r.map((v, i) => '<td' + (s.columns[i].type !== 'text' ? ' class="r"' : '') + '>' + esc(Export.fmt(v, s.columns[i].type)) + '</td>').join('') + '</tr>').join('')
        : '<tr><td class="empty" colspan="' + s.columns.length + '">No data for this period.</td></tr>';
      return '<section class="rsec"><h2>' + esc(s.title) + '</h2><div class="table-card"><div class="table-wrap"><table class="report-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div></section>';
    }).join('');
    return '<div class="report-doc"><div class="rhead"><h1>' + esc(report.title) + '</h1><p>' + esc(report.subtitle) + '</p><small>' + esc(BUSINESS_NAME) + ' · Generated ' + esc(report.generated) + '</small></div>' +
      '<div class="rcards">' + cards + '</div>' + sections + '</div>';
  },

  csv(report) {
    const cell = (v, type) => {
      if (v == null) return '';
      if (typeof v === 'number') return type === 'money' ? v.toFixed(2) : String(v);
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const line = (arr, types) => arr.map((v, i) => cell(v, types ? types[i] : 'text')).join(',');
    const out = [line([report.title]), line([report.subtitle]), line(['Generated ' + report.generated]), ''];
    report.cards.forEach(c => out.push(line([c.label, c.value], ['text', c.type])));
    report.sections.forEach(s => {
      out.push('', line([s.title]), line(s.columns.map(c => c.label)));
      s.rows.forEach(r => out.push(line(r, s.columns.map(c => c.type))));
    });
    return '﻿' + out.join('\r\n') + '\r\n';
  },

  pdf(report) {
    const W = 595.28, H = 841.89, M = 40;
    const ascii = s => String(s).replace(/₱/g, 'PHP ').replace(/→/g, '->').replace(/[·•]/g, '-').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?');
    const pdfEsc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const tw = (s, size, bold) => {
      let w = 0;
      for (let i = 0; i < s.length; i++) w += HELV[s.charCodeAt(i) - 32] || 556;
      return w * size / 1000 * (bold ? 1.06 : 1);
    };
    const fit = (s, size, bold, maxW) => {
      s = ascii(s);
      if (tw(s, size, bold) <= maxW) return s;
      while (s.length > 1 && tw(s + '...', size, bold) > maxW) s = s.slice(0, -1);
      return s + '...';
    };

    const pages = [];
    let ops = [], y = 0;
    const newPage = () => { if (ops.length) pages.push(ops); ops = []; y = H - M; };
    const color = (r, g, b) => ops.push(r + ' ' + g + ' ' + b + ' rg');
    const text = (x, yy, s, size, bold, align, maxW, rgb) => {
      const t = fit(s, size, bold, maxW || 1e9);
      const px = align === 'right' ? x - tw(t, size, bold) : (align === 'center' ? x - tw(t, size, bold) / 2 : x);
      const c = rgb || [0.06, 0.16, 0.2];
      ops.push(c[0] + ' ' + c[1] + ' ' + c[2] + ' rg BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + px.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + pdfEsc(t) + ') Tj ET');
    };
    const rect = (x, yy, w, h, rgb) => ops.push(rgb[0] + ' ' + rgb[1] + ' ' + rgb[2] + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f');
    const hline = (yy, rgb) => ops.push(rgb[0] + ' ' + rgb[1] + ' ' + rgb[2] + ' RG 0.5 w ' + M + ' ' + yy.toFixed(2) + ' m ' + (W - M) + ' ' + yy.toFixed(2) + ' l S');
    const need = h => { if (y - h < M + 24) newPage(); };

    newPage();
    text(M, y - 16, report.title, 18, true, 'left', W - 2 * M);
    y -= 24;
    text(M, y - 10, report.subtitle, 10, false, 'left', W - 2 * M, [0.3, 0.4, 0.45]);
    y -= 14;
    text(M, y - 9, BUSINESS_NAME + '  |  Generated ' + report.generated, 8, false, 'left', W - 2 * M, [0.42, 0.5, 0.54]);
    y -= 22;

    const per = 3, gap = 10, cw = (W - 2 * M - gap * (per - 1)) / per;
    for (let i = 0; i < report.cards.length; i += per) {
      need(46);
      report.cards.slice(i, i + per).forEach((c, k) => {
        const x = M + k * (cw + gap);
        rect(x, y - 38, cw, 38, [0.9, 0.96, 0.97]);
        text(x + 8, y - 14, c.label, 8, false, 'left', cw - 16, [0.3, 0.4, 0.45]);
        text(x + 8, y - 31, Export.fmtPlain(c.value, c.type), 13, true, 'left', cw - 16);
      });
      y -= 48;
    }
    y -= 6;

    report.sections.forEach(s => {
      const inner = W - 2 * M;
      const fixed = s.columns.reduce((t, c) => t + (c.type === 'money' ? 78 : (c.type === 'num' ? 54 : 0)), 0);
      const weight = s.columns.map((c, i) => {
        if (c.type !== 'text') return 0;
        const longest = s.rows.slice(0, 40).reduce((m, r) => Math.max(m, String(r[i] == null ? '' : r[i]).length), c.label.length);
        return Math.min(40, Math.max(8, longest));
      });
      const weightSum = weight.reduce((a, b) => a + b, 0) || 1;
      const widths = s.columns.map((c, i) => c.type === 'money' ? 78 : (c.type === 'num' ? 54 : Math.max(40, (inner - fixed) * weight[i] / weightSum)));
      const scale = inner / widths.reduce((a, b) => a + b, 0);
      for (let i = 0; i < widths.length; i++) widths[i] *= scale;

      const header = () => {
        rect(M, y - 18, inner, 18, [0.9, 0.96, 0.97]);
        let x = M;
        s.columns.forEach((c, i) => {
          if (c.type === 'text') text(x + 4, y - 12, c.label, 8, true, 'left', widths[i] - 8);
          else text(x + widths[i] - 4, y - 12, c.label, 8, true, 'right', widths[i] - 8);
          x += widths[i];
        });
        y -= 18;
      };

      need(60);
      text(M, y - 12, s.title, 12, true, 'left', inner);
      y -= 20;
      header();
      if (!s.rows.length) {
        text(M + 4, y - 11, 'No data for this period.', 9, false, 'left', inner, [0.42, 0.5, 0.54]);
        y -= 20;
      }
      s.rows.forEach(r => {
        if (y - 15 < M + 24) { newPage(); header(); }
        let x = M;
        r.forEach((v, i) => {
          const t = Export.fmtPlain(v, s.columns[i].type);
          if (s.columns[i].type === 'text') text(x + 4, y - 11, t, 8, false, 'left', widths[i] - 8);
          else text(x + widths[i] - 4, y - 11, t, 8, false, 'right', widths[i] - 8);
          x += widths[i];
        });
        y -= 15;
        hline(y, [0.85, 0.92, 0.93]);
      });
      y -= 18;
    });
    if (ops.length) pages.push(ops);

    const total = pages.length;
    const streams = pages.map((p, i) => {
      const foot = [];
      const label = 'Page ' + (i + 1) + ' of ' + total;
      foot.push('0.42 0.5 0.54 rg BT /F1 8 Tf ' + (W - M - tw(label, 8, false)).toFixed(2) + ' ' + (M - 8) + ' Td (' + label + ') Tj ET');
      foot.push('0.42 0.5 0.54 rg BT /F1 8 Tf ' + M + ' ' + (M - 8) + ' Td (' + pdfEsc(ascii(report.title)) + ') Tj ET');
      return p.concat(foot).join('\n');
    });

    const objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const kids = [];
    streams.forEach((st, i) => {
      const pageId = 5 + i * 2, contentId = 6 + i * 2;
      kids.push(pageId + ' 0 R');
      objs[pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentId + ' 0 R >>';
      objs[contentId] = '<< /Length ' + st.length + ' >>\nstream\n' + st + '\nendstream';
    });
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + total + ' >>';

    let out = '%PDF-1.4\n';
    const offsets = [];
    for (let k = 1; k < objs.length; k++) {
      offsets[k] = out.length;
      out += k + ' 0 obj\n' + objs[k] + '\nendobj\n';
    }
    const xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (let k = 1; k < objs.length; k++) out += pad(offsets[k], 10) + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    return out;
  },

  download(filename, data, mime) {
    const blob = new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
};