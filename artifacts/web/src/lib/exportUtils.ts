import { Conversation } from "@workspace/api-client-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateMarkdownText(conversation: Conversation) {
  let md = `# ${conversation.title || "Extracted Conversation"}\n\n`;
  md += `**Source:** ${conversation.sourceLabel}\n**URL:** ${conversation.url}\n\n---\n\n`;

  conversation.messages.forEach((msg) => {
    md += `### ${msg.role.toUpperCase()}${msg.model ? ` (${msg.model})` : ""}\n\n`;
    md += `${msg.content}\n\n`;
  });
  return md;
}

export function generatePlainText(conversation: Conversation) {
  let text = `${conversation.title || "Extracted Conversation"}\n\n`;
  text += `Source: ${conversation.sourceLabel}\nURL: ${conversation.url}\n\n---\n\n`;

  conversation.messages.forEach((msg) => {
    text += `[${msg.role.toUpperCase()}${msg.model ? ` - ${msg.model}` : ""}]\n`;
    const stripped = msg.content.replace(/(\*|_|#|`|~|>)/g, "");
    text += `${stripped}\n\n`;
  });
  return text;
}

export async function downloadPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Add a specific class to override dark mode for printing if desired, or keep as is.
  // For best results, we just render what is on screen.
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#09090b" });
  const imgData = canvas.toDataURL("image/png");
  
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  
  // Handle pagination roughly
  let heightLeft = pdfHeight;
  let position = 0;
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
  heightLeft -= pageHeight;
  
  while (heightLeft >= 0) {
    position = heightLeft - pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;
  }
  
  pdf.save(filename);
}
