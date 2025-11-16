// controllers/subjectResourcesController.js
const SubjectResources = require("../models/SubjectResources");
const ErrorResponse = require("../utils/errorResponse");
const MCQPDFGenerator = require("../utils/pdfGenerator");
const { uploadPDFBuffer, getSignedUrl } = require("../utils/s3");
// ➕ Create/Update subject resources (Admin only)
exports.upsertSubjectResources = async (req, res, next) => {
  try {
    const { subject, course, examBoard, resources } = req.body;

    const subjectResources = await SubjectResources.findOneAndUpdate(
      { subject, course, examBoard },
      {
        ...req.body,
        createdBy: req.user.id,
        updatedAt: Date.now(),
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    )
      .populate("subject", "name category level")
      .populate("course", "name level");

    res.status(200).json({
      success: true,
      data: subjectResources,
    });
  } catch (error) {
    next(error);
  }
};

exports.getSubjectResources = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard } = req.params;

    const subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard,
    })
      .populate("subject", "name category level")
      .populate("course", "name level")
      .populate("createdBy", "name email");

    // Return empty resources structure if not found
    if (!subjectResources) {
      return res.status(200).json({
        success: true,
        data: {
          subject: subjectId,
          course: courseId,
          examBoard,
          resources: {
            examQuestions: { isEnabled: false, topics: [] },
            revisionNotes: { isEnabled: false, topics: [] },
            flashcards: { isEnabled: false, cards: [] },
            targetTests: { isEnabled: false, tests: [] },
            mockExams: { isEnabled: false, exams: [] },
            pastPapers: { isEnabled: false, papers: [] },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isEmpty: true,
      });
    }

    // Convert to plain object to modify
    const resourcesData = subjectResources.toObject();

    // Helper function to generate signed URLs for any S3 file
    const generateSignedUrlForS3File = async (url) => {
      if (!url || !url.includes(process.env.AWS_BUCKET_NAME)) {
        return url; // Return original URL if it's not from our S3 bucket
      }

      try {
        const key = extractS3Key(url);
        if (key) {
          const signedUrl = await getSignedUrl(key, 3600); // 1 hour expiry
          return signedUrl || url; // Fallback to original URL if signing fails
        }
      } catch (error) {
        console.error(`Error generating signed URL for ${url}:`, error);
      }
      return url; // Return original URL if any error occurs
    };

    // Generate signed URLs for past papers
    if (resourcesData.resources.pastPapers?.papers?.length > 0) {
      for (let paper of resourcesData.resources.pastPapers.papers) {
        if (paper.pdfUrl) {
          paper.pdfUrl = await generateSignedUrlForS3File(paper.pdfUrl);
        }
      }
    }

    // Generate signed URLs for revision notes images
    if (resourcesData.resources.revisionNotes?.topics?.length > 0) {
      for (let topic of resourcesData.resources.revisionNotes.topics) {
        // Handle main topic images
        if (topic.images?.length > 0) {
          for (let image of topic.images) {
            if (image.url) {
              image.url = await generateSignedUrlForS3File(image.url);
            }
          }
        }

        // Handle sub-topic images
        if (topic.subTopics?.length > 0) {
          for (let subTopic of topic.subTopics) {
            // Handle sub-topic main image
            if (subTopic.image?.url) {
              subTopic.image.url = await generateSignedUrlForS3File(
                subTopic.image.url
              );
            }

            // Handle sub-topic images array (if exists)
            if (subTopic.images?.length > 0) {
              for (let image of subTopic.images) {
                if (image.url) {
                  image.url = await generateSignedUrlForS3File(image.url);
                }
              }
            }
          }
        }
      }
    }

    // Generate signed URLs for mock exams (if enabled in future)
    if (resourcesData.resources.mockExams?.exams?.length > 0) {
      for (let exam of resourcesData.resources.mockExams.exams) {
        if (exam.pdfUrl) {
          exam.pdfUrl = await generateSignedUrlForS3File(exam.pdfUrl);
        }
        // Handle exam images if they exist
        if (exam.images?.length > 0) {
          for (let image of exam.images) {
            if (image.url) {
              image.url = await generateSignedUrlForS3File(image.url);
            }
          }
        }
      }
    }

    // Generate signed URLs for target tests (if enabled in future)
    if (resourcesData.resources.targetTests?.tests?.length > 0) {
      for (let test of resourcesData.resources.targetTests.tests) {
        if (test.pdfUrl) {
          test.pdfUrl = await generateSignedUrlForS3File(test.pdfUrl);
        }
        // Handle test images if they exist
        if (test.images?.length > 0) {
          for (let image of test.images) {
            if (image.url) {
              image.url = await generateSignedUrlForS3File(image.url);
            }
          }
        }
      }
    }

    // Generate signed URLs for additional resources
    if (resourcesData.resources.additionalResources?.length > 0) {
      for (let resource of resourcesData.resources.additionalResources) {
        if (resource.fileUrl) {
          resource.fileUrl = await generateSignedUrlForS3File(resource.fileUrl);
        }
        if (resource.thumbnailUrl) {
          resource.thumbnailUrl = await generateSignedUrlForS3File(
            resource.thumbnailUrl
          );
        }
      }
    }

    res.status(200).json({
      success: true,
      data: resourcesData,
      isEmpty: false,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to extract S3 key from URL
function extractS3Key(url) {
  if (!url) return null;

  try {
    // Handle both full S3 URLs and paths
    const urlObj = new URL(url);
    // For S3 URLs, the key is the pathname without the leading slash
    if (
      urlObj.hostname.includes("s3") ||
      urlObj.hostname.includes(process.env.AWS_BUCKET_NAME)
    ) {
      return urlObj.pathname.substring(1); // Remove leading slash
    }
  } catch (error) {
    // If URL parsing fails, it might already be a key or a relative path
    if (url.startsWith("https://")) {
      // If it's a full URL but parsing failed, try to extract key manually
      const bucketName = process.env.AWS_BUCKET_NAME;
      const bucketIndex = url.indexOf(bucketName);
      if (bucketIndex !== -1) {
        return url.substring(bucketIndex + bucketName.length + 1); // +1 for the slash
      }
    }
    // If it doesn't look like a full URL, assume it's already a key
    return url;
  }

  return null;
}

// Helper function to extract S3 key from full URL
function extractS3Key(fullUrl) {
  try {
    const url = new URL(fullUrl);
    // Remove leading slash from pathname if present
    return url.pathname.replace(/^\//, "");
  } catch (error) {
    console.error("Error parsing URL:", fullUrl, error);
    return null;
  }
}

exports.getBatchResourcesByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Get all subject resources for this course
    const subjectResources = await SubjectResources.find({
      course: courseId,
    })
      .populate("subject", "name category level")
      .populate("course", "name level");

    res.status(200).json({
      success: true,
      data: subjectResources,
    });
  } catch (error) {
    next(error);
  }
};

// ➕ Add MCQ to subject (Admin only)
// controllers/subjectResourcesController.js
exports.addMCQ = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, topic, subSection } = req.params;
    const mcqData = req.body;
    console.log(mcqData);
    // Decode URL parameters
    const decodedExamBoard = decodeURIComponent(examBoard);
    const decodedTopic = decodeURIComponent(topic);
    const decodedSubSection = decodeURIComponent(subSection);

    // Find or create subject resources
    let subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: decodedExamBoard,
    });

    if (!subjectResources) {
      subjectResources = new SubjectResources({
        subject: subjectId,
        course: courseId,
        examBoard: decodedExamBoard,
        resources: {
          examQuestions: {
            isEnabled: true,
            topics: [],
          },
          // ... other resources
        },
        createdBy: req.user.id,
      });
    }

    // Ensure examQuestions exists and is enabled
    if (!subjectResources.resources.examQuestions) {
      subjectResources.resources.examQuestions = {
        isEnabled: true,
        topics: [],
      };
    }

    // Find or create topic - using 'name' field
    let topicObj = subjectResources.resources.examQuestions.topics.find(
      (t) => t.name === decodedTopic
    );

    if (!topicObj) {
      topicObj = {
        name: decodedTopic,
        subSections: [],
      };
      subjectResources.resources.examQuestions.topics.push(topicObj);
    }

    // Find or create subsection
    let subSectionObj = topicObj.subSections.find(
      (ss) => ss.name === decodedSubSection
    );

    if (!subSectionObj) {
      subSectionObj = {
        name: decodedSubSection,
        code: decodedSubSection,
        mcqs: [],
      };
      topicObj.subSections.push(subSectionObj);
    }

    // Ensure mcqs array exists
    if (!subSectionObj.mcqs) {
      subSectionObj.mcqs = [];
    }

    // Add the new MCQ
    subSectionObj.mcqs.push({
      question: mcqData.question,
      options: mcqData.options,
      correctOption: mcqData.correctOption,
      explanation: mcqData.explanation,
      difficulty: mcqData.difficulty,
      marks: mcqData.marks,
      topic: mcqData.topic,
      subTopic: mcqData.subTopic,
    });

    subjectResources.updatedAt = new Date();
    await subjectResources.save();

    res.status(201).json({
      success: true,
      data: subjectResources,
      message: "MCQ added successfully",
    });
  } catch (error) {
    console.error("Error in addMCQ:", error);
    next(error);
  }
};
// Update MCQ
exports.updateMCQ = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, topic, subSection, mcqIndex } =
      req.params;
    const mcqData = req.body;

    const decodedExamBoard = decodeURIComponent(examBoard);
    const decodedTopic = decodeURIComponent(topic);
    const decodedSubSection = decodeURIComponent(subSection);

    const subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: decodedExamBoard,
    });

    if (!subjectResources) {
      return res.status(404).json({
        success: false,
        message: "Subject resources not found",
      });
    }

    const topicObj = subjectResources.resources.examQuestions.topics.find(
      (t) => t.name === decodedTopic
    );

    if (!topicObj) {
      return res.status(404).json({
        success: false,
        message: "Topic not found",
      });
    }

    const subSectionObj = topicObj.subSections.find(
      (ss) => ss.name === decodedSubSection
    );

    if (!subSectionObj) {
      return res.status(404).json({
        success: false,
        message: "Sub-section not found",
      });
    }

    if (mcqIndex >= subSectionObj.mcqs.length) {
      return res.status(404).json({
        success: false,
        message: "MCQ not found",
      });
    }

    // Update the MCQ
    subSectionObj.mcqs[mcqIndex] = {
      ...subSectionObj.mcqs[mcqIndex].toObject(),
      ...mcqData,
    };

    subjectResources.updatedAt = new Date();
    await subjectResources.save();

    res.json({
      success: true,
      data: subjectResources,
      message: "MCQ updated successfully",
    });
  } catch (error) {
    console.error("Error in updateMCQ:", error);
    next(error);
  }
};

// Delete MCQ
exports.deleteMCQ = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, topic, subSection, mcqIndex } =
      req.params;

    const decodedExamBoard = decodeURIComponent(examBoard);
    const decodedTopic = decodeURIComponent(topic);
    const decodedSubSection = decodeURIComponent(subSection);

    const subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: decodedExamBoard,
    });

    if (!subjectResources) {
      return res.status(404).json({
        success: false,
        message: "Subject resources not found",
      });
    }

    const topicObj = subjectResources.resources.examQuestions.topics.find(
      (t) => t.name === decodedTopic
    );

    if (!topicObj) {
      return res.status(404).json({
        success: false,
        message: "Topic not found",
      });
    }

    const subSectionObj = topicObj.subSections.find(
      (ss) => ss.name === decodedSubSection
    );

    if (!subSectionObj) {
      return res.status(404).json({
        success: false,
        message: "Sub-section not found",
      });
    }

    if (mcqIndex >= subSectionObj.mcqs.length) {
      return res.status(404).json({
        success: false,
        message: "MCQ not found",
      });
    }

    // Remove the MCQ
    subSectionObj.mcqs.splice(mcqIndex, 1);

    subjectResources.updatedAt = new Date();
    await subjectResources.save();

    res.json({
      success: true,
      data: subjectResources,
      message: "MCQ deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteMCQ:", error);
    next(error);
  }
};
exports.addMultipleMCQs = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, topic, subSection } = req.params;
    const { mcqs } = req.body; // Array of MCQ objects

    if (!mcqs || !Array.isArray(mcqs) || mcqs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "MCQs array is required and cannot be empty",
      });
    }

    const decodedExamBoard = decodeURIComponent(examBoard);
    const decodedTopic = decodeURIComponent(topic);
    const decodedSubSection = decodeURIComponent(subSection);

    let subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: decodedExamBoard,
    });

    if (!subjectResources) {
      subjectResources = new SubjectResources({
        subject: subjectId,
        course: courseId,
        examBoard: decodedExamBoard,
        resources: {
          examQuestions: {
            isEnabled: true,
            topics: [],
          },
        },
        createdBy: req.user.id,
      });
    }

    if (!subjectResources.resources.examQuestions) {
      subjectResources.resources.examQuestions = {
        isEnabled: true,
        topics: [],
      };
    }

    // Find or create topic
    let topicObj = subjectResources.resources.examQuestions.topics.find(
      (t) => t.name === decodedTopic
    );

    if (!topicObj) {
      topicObj = {
        name: decodedTopic,
        code: decodedTopic,
        subSections: [],
        totalQuestions: 0,
      };
      subjectResources.resources.examQuestions.topics.push(topicObj);
    }

    // Find or create subsection
    let subSectionObj = topicObj.subSections.find(
      (ss) => ss.name === decodedSubSection || ss.code === decodedSubSection
    );

    if (!subSectionObj) {
      subSectionObj = {
        name: decodedSubSection,
        code: decodedSubSection,
        mcqs: [],
        totalQuestions: 0,
      };
      topicObj.subSections.push(subSectionObj);
    }

    // Add all MCQs with topic and subTopic info
    const newMCQs = mcqs.map((mcq) => ({
      ...mcq,
      topic: decodedTopic,
      subTopic: decodedSubSection,
    }));

    subSectionObj.mcqs.push(...newMCQs);

    // Update counters
    subSectionObj.totalQuestions = subSectionObj.mcqs.length;
    topicObj.totalQuestions = topicObj.subSections.reduce(
      (total, ss) => total + ss.mcqs.length,
      0
    );

    // Update timestamps
    subSectionObj.updatedAt = new Date();
    topicObj.updatedAt = new Date();
    subjectResources.updatedAt = new Date();

    await subjectResources.save();

    res.status(201).json({
      success: true,
      data: {
        addedCount: newMCQs.length,
        totalInSubSection: subSectionObj.totalQuestions,
        totalInTopic: topicObj.totalQuestions,
      },
      message: `${newMCQs.length} MCQs added successfully to ${decodedTopic} - ${decodedSubSection}`,
    });
  } catch (error) {
    console.error("Error in addMultipleMCQs:", error);
    next(error);
  }
};

exports.bulkImportMCQs = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard } = req.params;
    const { mcqs } = req.body;
    console.log("Bulk importing MCQs:", mcqs);

    if (!mcqs || !Array.isArray(mcqs)) {
      return res.status(400).json({
        success: false,
        message: "MCQs array is required",
      });
    }

    const decodedExamBoard = decodeURIComponent(examBoard);

    let subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: decodedExamBoard,
    });

    if (!subjectResources) {
      subjectResources = new SubjectResources({
        subject: subjectId,
        course: courseId,
        examBoard: decodedExamBoard,
        resources: {
          examQuestions: {
            isEnabled: true,
            topics: [],
          },
        },
        createdBy: req.user.id,
      });
    }

    if (!subjectResources.resources.examQuestions) {
      subjectResources.resources.examQuestions = {
        isEnabled: true,
        topics: [],
      };
    }

    const results = {
      added: 0,
      skipped: 0,
      errors: [],
      byTopic: {},
      pdfsGenerated: {},
    };

    // Group MCQs by topic and subTopic for PDF generation
    const groupedMCQs = {};

    for (const mcqData of mcqs) {
      try {
        const {
          topic,
          subTopic,
          question,
          options,
          correctOption,
          explanation,
          difficulty,
          marks,
        } = mcqData;

        if (!topic || !subTopic || !question || !options) {
          results.skipped++;
          results.errors.push(
            `Missing required fields for question: ${
              mcqData.question?.substring(0, 50) || "Unknown question"
            }...`
          );
          continue;
        }

        // Initialize grouping structure
        if (!groupedMCQs[topic]) {
          groupedMCQs[topic] = {};
        }
        if (!groupedMCQs[topic][subTopic]) {
          groupedMCQs[topic][subTopic] = [];
        }
        groupedMCQs[topic][subTopic].push(mcqData);

        // Find or create topic
        let topicObj = subjectResources.resources.examQuestions.topics.find(
          (t) => t.name === topic
        );

        if (!topicObj) {
          topicObj = {
            name: topic,
            code: topic,
            subSections: [],
            totalQuestions: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          subjectResources.resources.examQuestions.topics.push(topicObj);
          results.byTopic[topic] = { added: 0, subTopics: {} };
        }

        // Find or create subsection
        let subSectionObj = topicObj.subSections.find(
          (ss) => ss.name === subTopic
        );

        if (!subSectionObj) {
          subSectionObj = {
            name: subTopic,
            code: subTopic,
            mcqs: [],
            totalQuestions: 0,
            pdfUrl: null, // Add PDF URL field
            pdfKey: null, // Add S3 key field
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          topicObj.subSections.push(subSectionObj);
          results.byTopic[topic].subTopics[subTopic] = 0;
        }

        // Create MCQ object
        const mcqObject = {
          question: question.trim(),
          options: options.map((opt) =>
            typeof opt === "string" ? opt.trim() : String(opt)
          ),
          correctOption: parseInt(correctOption),
          explanation: explanation?.trim() || "",
          difficulty: difficulty || "medium",
          marks: parseInt(marks) || 1,
          topic: topic.trim(),
          subTopic: subTopic.trim(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        console.log("Adding MCQ to subsection:", {
          subSection: subTopic,
          mcq: mcqObject.question.substring(0, 50),
        });

        // Add MCQ to the subsection
        subSectionObj.mcqs.push(mcqObject);

        // Update counters
        subSectionObj.totalQuestions = subSectionObj.mcqs.length;
        subSectionObj.updatedAt = new Date();

        topicObj.totalQuestions = topicObj.subSections.reduce(
          (total, ss) => total + ss.mcqs.length,
          0
        );
        topicObj.updatedAt = new Date();

        results.added++;
        results.byTopic[topic].added++;
        results.byTopic[topic].subTopics[subTopic] =
          (results.byTopic[topic].subTopics[subTopic] || 0) + 1;
      } catch (error) {
        console.error("Error processing MCQ:", error);
        results.skipped++;
        results.errors.push(`Error processing question: ${error.message}`);
      }
    }

    // Generate PDFs for each sub-topic and upload to S3
    for (const [topicName, subTopics] of Object.entries(groupedMCQs)) {
      for (const [subTopicName, mcqList] of Object.entries(subTopics)) {
        if (mcqList.length > 0) {
          try {
            console.log(
              `Generating PDF for ${topicName} - ${subTopicName} with ${mcqList.length} MCQs`
            );

            // Generate PDF buffer
            const pdfBuffer = await MCQPDFGenerator.generateSubTopicPDF(
              { mcqs: mcqList },
              topicName,
              subTopicName
            );

            // Upload to S3
            const fileName = `${topicName}_${subTopicName}_MCQs`.replace(
              /[^a-zA-Z0-9]/g,
              "_"
            );
            const pdfKey = await uploadPDFBuffer(pdfBuffer, fileName);

            // Generate signed URL
            const pdfUrl = await getSignedUrl(pdfKey);

            // Find the corresponding sub-section and update PDF info
            const topicObj =
              subjectResources.resources.examQuestions.topics.find(
                (t) => t.name === topicName
              );

            if (topicObj) {
              const subSectionObj = topicObj.subSections.find(
                (ss) => ss.name === subTopicName
              );

              if (subSectionObj) {
                subSectionObj.pdfUrl = pdfUrl;
                subSectionObj.pdfKey = pdfKey;
                subSectionObj.updatedAt = new Date();
              }
            }

            // Track PDF generation results
            if (!results.pdfsGenerated[topicName]) {
              results.pdfsGenerated[topicName] = {};
            }
            results.pdfsGenerated[topicName][subTopicName] = {
              success: true,
              pdfUrl: pdfUrl,
              mcqCount: mcqList.length,
            };

            console.log(
              `PDF generated and uploaded for ${topicName} - ${subTopicName}`
            );
          } catch (pdfError) {
            console.error(
              `Failed to generate PDF for ${topicName} - ${subTopicName}:`,
              pdfError
            );

            if (!results.pdfsGenerated[topicName]) {
              results.pdfsGenerated[topicName] = {};
            }
            results.pdfsGenerated[topicName][subTopicName] = {
              success: false,
              error: pdfError.message,
            };
          }
        }
      }
    }

    // Save the updated subject resources
    subjectResources.updatedAt = new Date();
    await subjectResources.save();

    console.log("Save completed, checking database...");

    res.status(201).json({
      success: true,
      data: results,
      message: `Bulk import completed. Added: ${results.added}, Skipped: ${
        results.skipped
      }, PDFs generated: ${
        Object.values(results.pdfsGenerated)
          .flatMap((t) => Object.values(t))
          .filter((p) => p.success).length
      }`,
    });
  } catch (error) {
    console.error("Error in bulkImportMCQs:", error);
    next(error);
  }
};
// ➕ Add revision note (Admin only)
// Add revision note
exports.addRevisionNote = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard } = req.params;
    const noteData = req.body;

    console.log("Adding revision note with order:", noteData.order);

    let subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard,
    });

    if (!subjectResources) {
      subjectResources = new SubjectResources({
        subject: subjectId,
        course: courseId,
        examBoard,
        resources: {
          revisionNotes: { isEnabled: true, topics: [noteData] },
        },
        createdBy: req.user.id,
      });
    } else {
      if (!subjectResources.resources.revisionNotes) {
        subjectResources.resources.revisionNotes = {
          isEnabled: true,
          topics: [],
        };
      }

      // Check if order already exists for main topics
      const existingOrder =
        subjectResources.resources.revisionNotes.topics.find(
          (topic) => topic.order === noteData.order
        );

      if (existingOrder) {
        return res.status(400).json({
          success: false,
          message: `Order ${noteData.order} already exists. Please use a different order number.`,
          existingTopic: existingOrder.title,
        });
      }

      subjectResources.resources.revisionNotes.topics.push(noteData);
      subjectResources.resources.revisionNotes.isEnabled = true;
    }

    await subjectResources.save();
    res.status(200).json({ success: true, data: subjectResources });
  } catch (error) {
    next(error);
  }
};

// Update revision note
exports.updateRevisionNote = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, noteIndex } = req.params;
    const noteData = req.body;

    const subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard,
    });

    if (!subjectResources) {
      return res.status(404).json({
        success: false,
        message: "Subject resources not found",
      });
    }

    // Check if order already exists for other topics (excluding current topic being updated)
    const existingOrder = subjectResources.resources.revisionNotes.topics.find(
      (topic, index) =>
        topic.order === noteData.order && index !== parseInt(noteIndex)
    );

    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: `Order ${noteData.order} already exists. Please use a different order number.`,
        existingTopic: existingOrder.title,
      });
    }

    subjectResources.resources.revisionNotes.topics[noteIndex] = noteData;
    await subjectResources.save();

    res.status(200).json({ success: true, data: subjectResources });
  } catch (error) {
    next(error);
  }
};

// Delete revision note
exports.deleteRevisionNote = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, noteIndex } = req.params;

    const subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard,
    });

    if (!subjectResources) {
      return res.status(404).json({
        success: false,
        message: "Subject resources not found",
      });
    }

    subjectResources.resources.revisionNotes.topics.splice(noteIndex, 1);
    await subjectResources.save();

    res.status(200).json({ success: true, data: subjectResources });
  } catch (error) {
    next(error);
  }
};
// 🔧 Enable/Disable resource type (Admin only)
exports.toggleResourceType = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, resourceType } = req.params;
    const { isEnabled } = req.body;

    // The logged-in user is available via protect middleware
    const userId = req.user?._id;

    // Find existing record
    let subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard,
    });

    // If not found, create a new one
    if (!subjectResources) {
      subjectResources = new SubjectResources({
        subject: subjectId,
        course: courseId,
        examBoard,
        createdBy: userId, // ✅ REQUIRED FIELD
        resources: {
          [resourceType]: { isEnabled: isEnabled ?? true },
        },
      });

      await subjectResources.save();

      return res.status(201).json({
        success: true,
        message: "New subject resources entry created and enabled.",
        data: subjectResources,
      });
    }

    // If found, update the resource type
    if (!subjectResources.resources) subjectResources.resources = {};

    if (!subjectResources.resources[resourceType]) {
      subjectResources.resources[resourceType] = {
        isEnabled: isEnabled ?? true,
      };
    } else {
      subjectResources.resources[resourceType].isEnabled = isEnabled;
    }

    subjectResources.updatedAt = Date.now();
    await subjectResources.save();

    res.status(200).json({
      success: true,
      message: "Subject resource toggled successfully.",
      data: subjectResources,
    });
  } catch (error) {
    next(error);
  }
};

// controllers/subjectResourcesController.js - Add these functions
exports.addPastPaper = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard } = req.params;
    const paperData = req.body;
    console.log(req.body);
    const decodedExamBoard = decodeURIComponent(examBoard);

    let subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: decodedExamBoard,
    });

    if (!subjectResources) {
      subjectResources = new SubjectResources({
        subject: subjectId,
        course: courseId,
        examBoard: decodedExamBoard,
        resources: {
          pastPapers: {
            isEnabled: true,
            papers: [],
          },
        },
        createdBy: req.user.id,
      });
    }

    if (!subjectResources.resources.pastPapers) {
      subjectResources.resources.pastPapers = {
        isEnabled: true,
        papers: [],
      };
    }

    subjectResources.resources.pastPapers.papers.push(paperData);
    subjectResources.updatedAt = new Date();
    await subjectResources.save();

    res.status(201).json({
      success: true,
      data: subjectResources,
      message: "Past paper added successfully",
    });
  } catch (error) {
    console.error("Error in addPastPaper:", error);
    next(error);
  }
};

exports.updatePastPaper = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, paperIndex } = req.params;
    const paperData = req.body;

    const decodedExamBoard = decodeURIComponent(examBoard);

    const subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: decodedExamBoard,
    });

    if (!subjectResources) {
      return res.status(404).json({
        success: false,
        message: "Subject resources not found",
      });
    }

    if (!subjectResources.resources.pastPapers?.papers) {
      return res.status(404).json({
        success: false,
        message: "Past papers not found",
      });
    }

    if (paperIndex >= subjectResources.resources.pastPapers.papers.length) {
      return res.status(404).json({
        success: false,
        message: "Past paper not found",
      });
    }

    subjectResources.resources.pastPapers.papers[paperIndex] = {
      ...subjectResources.resources.pastPapers.papers[paperIndex].toObject(),
      ...paperData,
    };

    subjectResources.updatedAt = new Date();
    await subjectResources.save();

    res.json({
      success: true,
      data: subjectResources,
      message: "Past paper updated successfully",
    });
  } catch (error) {
    console.error("Error in updatePastPaper:", error);
    next(error);
  }
};

exports.deletePastPaper = async (req, res, next) => {
  try {
    const { subjectId, courseId, examBoard, paperIndex } = req.params;

    const decodedExamBoard = decodeURIComponent(examBoard);

    const subjectResources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: decodedExamBoard,
    });

    if (!subjectResources) {
      return res.status(404).json({
        success: false,
        message: "Subject resources not found",
      });
    }

    if (!subjectResources.resources.pastPapers?.papers) {
      return res.status(404).json({
        success: false,
        message: "Past papers not found",
      });
    }

    if (paperIndex >= subjectResources.resources.pastPapers.papers.length) {
      return res.status(404).json({
        success: false,
        message: "Past paper not found",
      });
    }

    subjectResources.resources.pastPapers.papers.splice(paperIndex, 1);
    subjectResources.updatedAt = new Date();
    await subjectResources.save();

    res.json({
      success: true,
      data: subjectResources,
      message: "Past paper deleted successfully",
    });
  } catch (error) {
    console.error("Error in deletePastPaper:", error);
    next(error);
  }
};
