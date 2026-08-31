import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function generateBMSCardPDF(bmsId: string): Promise<void> {
  const cardElement = document.getElementById('bms-card');

  if (!cardElement) {
    throw new Error('BMS Card element not found');
  }

  const canvas = await html2canvas(cardElement, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pdfWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const xPosition = 10;
  const yPosition = (pdfHeight - imgHeight) / 2;

  pdf.addImage(imgData, 'PNG', xPosition, yPosition, imgWidth, imgHeight);
  pdf.save(`BMS-Card-${bmsId}.pdf`);
}
