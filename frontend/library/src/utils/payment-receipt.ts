import { jsPDF } from "jspdf";

type PaymentReceiptData = {
  paymentId: string;
  libraryName: string;
  studentName: string;
  studentEmail: string;
  studentMobile: string;
  librarianName: string;
  seatNumber: string;
  shift: string;
  paidAt: string;
  amount: number;
  paymentMethod?: "UPI" | "CASH";
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
}).format(new Date(value));

const formatAmount = (value: number) => new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);

const generatePaymentReceipt = (receipt: PaymentReceiptData) => {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const rightEdge = pageWidth - margin;
  const reference = receipt.paymentId.slice(-10).toUpperCase();
  const libraryName = receipt.libraryName || "LibraryHub";

  pdf.setFillColor(245, 247, 243);
  pdf.rect(0, 0, pageWidth, 297, "F");
  pdf.setFillColor(23, 75, 61);
  pdf.rect(0, 0, pageWidth, 61, "F");
  pdf.setFillColor(240, 198, 91);
  pdf.rect(0, 0, pageWidth, 3, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  let libraryNameFontSize = 23;
  pdf.setFontSize(libraryNameFontSize);
  let libraryNameLines = pdf.splitTextToSize(libraryName, pageWidth - margin * 2);
  while (libraryNameLines.length > 2 && libraryNameFontSize > 15) {
    libraryNameFontSize -= 1;
    pdf.setFontSize(libraryNameFontSize);
    libraryNameLines = pdf.splitTextToSize(libraryName, pageWidth - margin * 2);
  }
  pdf.text(libraryNameLines, margin, 25, { lineHeightFactor: 1.1 });

  pdf.setFontSize(10);
  pdf.setTextColor(218, 232, 223);
  const receiptTitleY = libraryNameLines.length === 1 ? 39 : 49;
  pdf.text("PAYMENT RECEIPT", margin, receiptTitleY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(218, 232, 223);
  pdf.text("OFFICIAL PAYMENT RECORD", rightEdge, 54, { align: "right" });

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(225, 232, 226);
  pdf.roundedRect(margin, 73, pageWidth - margin * 2, 39, 3, 3, "FD");
  pdf.setTextColor(45, 89, 70);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("RECEIPT DETAILS", margin + 8, 84);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(112, 125, 117);
  pdf.text("RECEIPT NUMBER", margin + 8, 96);
  pdf.text("PAYMENT DATE", pageWidth / 2 + 4, 96);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(34, 51, 43);
  pdf.text(`LH-${reference}`, margin + 8, 104);
  pdf.text(formatDate(receipt.paidAt), pageWidth / 2 + 4, 104);

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(225, 232, 226);
  pdf.roundedRect(margin, 122, pageWidth - margin * 2, 76, 3, 3, "FD");
  pdf.setTextColor(45, 89, 70);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("STUDENT DETAILS", margin + 8, 135);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(112, 125, 117);
  pdf.text("NAME", margin + 8, 147);
  pdf.text("EMAIL", margin + 8, 159);
  pdf.text("MOBILE", margin + 8, 171);
  pdf.text("SEAT / SHIFT", margin + 8, 181);
  pdf.text("METHOD", margin + 8, 193);
  pdf.text("RECORDED BY", pageWidth / 2 + 2, 193);
  pdf.setFontSize(10);
  pdf.setTextColor(34, 51, 43);
  pdf.text(receipt.studentName || "Not provided", margin + 43, 147);
  pdf.text(receipt.studentEmail || "Not provided", margin + 43, 159, {
    maxWidth: rightEdge - margin - 51,
  });
  pdf.text(receipt.studentMobile || "Not provided", margin + 43, 171);
  pdf.text(`${receipt.seatNumber || "Not assigned"} / ${receipt.shift || "Not assigned"}`, margin + 43, 181);
  pdf.setFont("helvetica", "bold");
  pdf.text(receipt.paymentMethod || "CASH", margin + 43, 193);
  pdf.setFont("helvetica", "normal");
  pdf.text(receipt.librarianName || "Library staff", pageWidth / 2 + 35, 193, {
    maxWidth: rightEdge - (pageWidth / 2 + 35),
  });

  pdf.setFillColor(23, 75, 61);
  pdf.roundedRect(margin, 206, pageWidth - margin * 2, 43, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(218, 232, 223);
  pdf.text("PAYMENT STATUS", margin + 8, 219);
  pdf.text("AMOUNT PAID", rightEdge - 8, 219, { align: "right" });
  pdf.setFontSize(11);
  pdf.setTextColor(151, 224, 184);
  pdf.text("PAID", margin + 8, 236);
  pdf.setFontSize(17);
  const amountText = `INR ${formatAmount(receipt.amount)}`;
  pdf.text(amountText, rightEdge - 8, 237, {
    align: "right",
    maxWidth: pageWidth - margin * 2 - 16,
  });

  pdf.setTextColor(45, 89, 70);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("TERMS & CONDITIONS", margin, 258);
  pdf.setDrawColor(206, 218, 209);
  pdf.line(margin + 37, 256, rightEdge, 256);
  pdf.setTextColor(76, 91, 82);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.2);
  pdf.text("1. Use only your assigned seat and shift; changes require librarian approval.", margin, 266);
  pdf.text("2. Follow posted library rules and maintain a quiet, respectful study space.", margin, 272);
  pdf.text("3. Report payment discrepancies promptly and retain this receipt for reference.", margin, 278);
  pdf.text("4. Refunds or payment adjustments follow the library's published policy.", margin, 284);
  pdf.setFontSize(7);
  pdf.setTextColor(125, 137, 130);
  pdf.text("Generated electronically by LibraryHub · Terms are subject to library policy", pageWidth / 2, 291, { align: "center" });

  pdf.save(`LibraryHub-receipt-${reference}.pdf`);
};

export { generatePaymentReceipt };
