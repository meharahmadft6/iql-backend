// utils/pdfGenerator.js
const PDFDocument = require("pdfkit");
const AWS = require("aws-sdk");

class MCQPDFGenerator {
  static async generateSubTopicPDF(subTopicData, topicName, subTopicName) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        // Collect data chunks
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Add header
        this.addHeader(doc, topicName, subTopicName);

        // Add MCQs
        this.addMCQs(doc, subTopicData.mcqs);

        // Finalize PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  static addHeader(doc, topicName, subTopicName) {
    // Title
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("#2c5aa0")
      .text(`MCQ Practice Sheet`, { align: "center" });

    doc.moveDown(0.5);

    // Topic and Sub-topic
    doc
      .fontSize(14)
      .font("Helvetica")
      .fillColor("#333333")
      .text(`Topic: ${topicName}`, { align: "center" });

    doc.moveDown(0.3);

    doc.fontSize(14).text(`Sub-topic: ${subTopicName}`, { align: "center" });

    doc.moveDown(1);

    // Add a line separator
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    doc.moveDown(1);
  }

  static addMCQs(doc, mcqs) {
    mcqs.forEach((mcq, index) => {
      // Question number and text
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(`${index + 1}. ${mcq.question}`);

      doc.moveDown(0.3);

      // Options
      doc.font("Helvetica").fillColor("#333333");

      const optionLabels = ["A", "B", "C", "D"];
      mcq.options.forEach((option, optIndex) => {
        doc.text(`   ${optionLabels[optIndex]}. ${option}`);
      });

      doc.moveDown(0.5);

      // Explanation (initially hidden, can be revealed later)
      doc
        .font("Helvetica-Oblique")
        .fillColor("#666666")
        .fontSize(10)
        .text(`Explanation: ${mcq.explanation}`);

      doc.moveDown(0.3);

      // Difficulty and marks
      doc
        .font("Helvetica")
        .fillColor("#888888")
        .text(
          `Difficulty: ${mcq.difficulty} | Marks: ${
            mcq.marks
          } | Correct Answer: ${optionLabels[mcq.correctOption]}`
        );

      doc.moveDown(1);

      // Add page break if needed
      if (doc.y > 700) {
        doc.addPage();
        doc.moveDown(1);
      }
    });
  }
}

module.exports = MCQPDFGenerator;
