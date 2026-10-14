import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportMembershipPDF(title: string, filename: string, sections: { title: string; rows: string[][] }[], headers: string[]) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const container = document.createElement('div');
  Object.assign(container.style, { position: 'fixed', left: '-10000px', top: '0', width: '794px', padding: '38px', boxSizing: 'border-box', background: '#fff', color: '#26334a', fontFamily: "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', Amiri, 'Segoe UI', Arial, sans-serif", fontSize: '12px', lineHeight: '1.9' });
  document.body.appendChild(container);
  let pages = 0;
  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const capture = async () => {
    await document.fonts.ready;
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#fff' });
    if (pages++) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, canvas.height * 210 / canvas.width);
  };
  try {
    for (const section of sections.filter(item => item.rows.length)) {
      let offset = 0;
      while (offset < section.rows.length) {
        container.replaceChildren();
        const heading = document.createElement('h1');
        heading.textContent = title; heading.style.cssText = 'font:600 22px system-ui;margin:0 0 6px;color:#345eae';
        const meta = document.createElement('p');
        meta.textContent = `${total} members · ${new Date().toLocaleDateString('en-GB')}`;
        meta.style.cssText = 'color:#8590a1;margin:0 0 18px;font:12px system-ui';
        const group = document.createElement('h2');
        group.textContent = `${section.title} (${section.rows.length})${offset ? ' · continued' : ''}`;
        group.style.cssText = 'font:600 15px system-ui;margin:0 0 10px';
        container.append(heading, meta, group);
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed';
        const makeRow = (values: string[], header = false) => {
          const row = document.createElement('tr');
          values.forEach(value => {
            const cell = document.createElement(header ? 'th' : 'td');
            cell.textContent = value; cell.dir = 'auto';
            cell.style.cssText = 'border:1px solid #e0e7ed;padding:8px 6px;vertical-align:top;overflow-wrap:anywhere;text-align:start';
            if (header) cell.style.cssText += ';background:#edf2f9;color:#526783;font:600 11px system-ui';
            row.appendChild(cell);
          });
          return row;
        };
        const head = document.createElement('thead'); head.append(makeRow(headers, true));
        const body = document.createElement('tbody'); table.append(head, body); container.append(table);
        await document.fonts.ready;
        const start = offset;
        while (offset < section.rows.length) {
          const row = makeRow(section.rows[offset]);
          if (offset % 2) row.style.background = '#f9fafc';
          body.append(row);
          if (offset === start) await document.fonts.ready;
          if (container.getBoundingClientRect().height > 1080) {
            row.remove();
            if (offset === start) throw new Error('A report row is too tall for one page');
            break;
          }
          offset++;
        }
        await capture();
      }
    }
    if (!pages) throw new Error('No members to export');
    const count = pdf.getNumberOfPages();
    for (let page = 1; page <= count; page++) { pdf.setPage(page); pdf.setFontSize(9); pdf.setTextColor(130); pdf.text(`Page ${page} of ${count}`, 105, 290, { align: 'center' }); }
    pdf.save(`${filename}.pdf`);
  } finally { container.remove(); }
}
