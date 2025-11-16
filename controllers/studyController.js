// controllers/studyController.js
const Course = require("../models/Course");
const SubjectResources = require("../models/SubjectResources");
const { getSignedUrl } = require("../utils/s3");
// Get study navigation data
exports.getStudyNavigation = async (req, res, next) => {
  try {
    const { courseId, subjectId, examBoard } = req.query;

    let data = {};

    if (courseId && subjectId && examBoard) {
      // Get resources for specific subject and exam board
      const resources = await SubjectResources.findOne({
        subject: subjectId,
        course: courseId,
        examBoard: examBoard,
      })
        .populate("subject", "name category level")
        .populate("course", "name level");

      data = {
        type: "resources",
        resources: resources || null,
      };
    } else if (courseId && subjectId) {
      // Get exam boards for specific subject
      const course = await Course.findById(courseId).populate(
        "subjectExamBoards.subject",
        "name category level"
      );

      const subjectExamBoards = course?.subjectExamBoards?.find(
        (seb) => seb.subject._id.toString() === subjectId
      );

      data = {
        type: "examBoards",
        examBoards: subjectExamBoards?.examBoards || [],
      };
    } else if (courseId) {
      // Get subjects for specific course
      const course = await Course.findById(courseId).populate(
        "subjectExamBoards.subject",
        "name category level"
      );

      data = {
        type: "subjects",
        subjects: course?.subjectExamBoards || [],
      };
    } else {
      // Get all courses
      const courses = await Course.find({ isActive: true })
        .populate("subjectExamBoards.subject", "name category level")
        .populate("createdBy", "name email")
        .sort({ name: 1 });

      data = {
        type: "courses",
        courses: courses,
      };
    }

    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

// Get available resources for subject and exam board
exports.getSubjectResources = async (req, res, next) => {
  try {
    const { courseId, subjectId, examBoard } = req.params;

    const resources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: examBoard,
    })
      .populate("subject", "name category level")
      .populate("course", "name level");

    if (!resources) {
      return res.status(404).json({
        success: false,
        message: "No resources found for the specified criteria",
      });
    }

    // Filter enabled resources
    const availableResources = [];

    if (resources.resources.examQuestions?.isEnabled) {
      availableResources.push({
        name: "Exam Questions",
        type: "examQuestions",
        count:
          resources.resources.examQuestions.topics?.reduce(
            (acc, topic) => acc + topic.totalQuestions,
            0
          ) || 0,
        href: `/study/${courseId}/${subjectId}/${examBoard}/exam-questions`,
      });
    }

    if (resources.resources.revisionNotes?.isEnabled) {
      availableResources.push({
        name: "Revision Notes",
        type: "revisionNotes",
        count: resources.resources.revisionNotes.topics?.length || 0,
        href: `/study/${courseId}/${subjectId}/${examBoard}/revision-notes`,
      });
    }

    if (resources.resources.flashcards?.isEnabled) {
      availableResources.push({
        name: "Flashcards",
        type: "flashcards",
        count: resources.resources.flashcards.cards?.length || 0,
        href: `/study/${courseId}/${subjectId}/${examBoard}/flashcards`,
      });
    }

    if (resources.resources.targetTests?.isEnabled) {
      availableResources.push({
        name: "Target Tests",
        type: "targetTests",
        count: resources.resources.targetTests.tests?.length || 0,
        href: `/study/${courseId}/${subjectId}/${examBoard}/target-tests`,
      });
    }

    if (resources.resources.pastPapers?.isEnabled) {
      availableResources.push({
        name: "Past Papers",
        type: "pastPapers",
        count: resources.resources.pastPapers.papers?.length || 0,
        href: `/study/${courseId}/${subjectId}/${examBoard}/past-papers`,
      });
    }

    if (resources.resources.mockExams?.isEnabled) {
      availableResources.push({
        name: "Mock Exams",
        type: "mockExams",
        count: resources.resources.mockExams.exams?.length || 0,
        href: `/study/${courseId}/${subjectId}/${examBoard}/mock-exams`,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        subject: resources.subject,
        course: resources.course,
        examBoard: resources.examBoard,
        resources: availableResources,
      },
    });
  } catch (error) {
    next(error);
  }
};
// Get exam questions for a subject and exam board
exports.getExamQuestions = async (req, res, next) => {
  try {
    const { courseId, subjectId, examBoard } = req.params;

    const resources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: examBoard,
    })
      .populate("subject", "name category level")
      .populate("course", "name level");

    if (!resources || !resources.resources.examQuestions?.isEnabled) {
      return res.status(404).json({
        success: false,
        message: "Exam questions not found for this subject and exam board",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        subject: resources.subject,
        course: resources.course,
        examBoard: resources.examBoard,
        examQuestions: resources.resources.examQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getRevisionNotes = async (req, res, next) => {
  try {
    const { courseId, subjectId, examBoard } = req.params;

    const resources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard,
    })
      .populate("subject", "name category level")
      .populate("course", "name level");

    if (!resources || !resources.resources.revisionNotes?.isEnabled) {
      return res.status(404).json({
        success: false,
        message: "Revision notes not found for this subject and exam board",
      });
    }

    const revisionNotes = { ...resources.resources.revisionNotes.toObject() };

    const signIfS3Url = async (url) => {
      if (!url) return null;

      // Ignore external URLs (Substack, Wikipedia, etc.)
      if (
        !url.includes("amazonaws.com") &&
        !url.includes(process.env.AWS_BUCKET_NAME)
      ) {
        return url;
      }

      try {
        // If it's already a presigned URL, return as is
        if (url.includes("AWSAccessKeyId") && url.includes("Signature")) {
          return url;
        }

        // Extract key safely
        let key = null;
        const bucket = process.env.AWS_BUCKET_NAME;

        // Case 1: https://<bucket>.s3.amazonaws.com/<key>
        if (url.includes(`${bucket}.s3.amazonaws.com/`)) {
          key = url.split(`${bucket}.s3.amazonaws.com/`)[1].split("?")[0];
        }

        // Case 2: https://s3.amazonaws.com/<bucket>/<key>
        else if (url.includes(`s3.amazonaws.com/${bucket}/`)) {
          key = url.split(`s3.amazonaws.com/${bucket}/`)[1].split("?")[0];
        }

        // Case 3: https://<bucket-domain>/<key>
        else if (url.includes(`${bucket}/`)) {
          key = url.split(`${bucket}/`)[1].split("?")[0];
        }

        // Case 4: fallback – sometimes images are stored with absolute paths
        if (!key || key.startsWith("http")) return url;

        const signed = await getSignedUrl(key, 3600);
        return signed || url;
      } catch (err) {
        console.error("Error signing URL:", err);
        return url;
      }
    };

    // Process all topics and subtopics
    if (revisionNotes.topics) {
      for (const topic of revisionNotes.topics) {
        if (topic.images?.length) {
          for (const image of topic.images) {
            image.signedUrl = await signIfS3Url(image.url);
          }
        }

        if (topic.subTopics?.length) {
          for (const sub of topic.subTopics) {
            if (sub.image?.url) {
              sub.image.signedUrl = await signIfS3Url(sub.image.url);
            }
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        subject: resources.subject,
        course: resources.course,
        examBoard: resources.examBoard,
        revisionNotes,
      },
    });
  } catch (error) {
    next(error);
  }
};
// Get past papers for a subject and exam board
exports.getPastPapers = async (req, res, next) => {
  try {
    const { courseId, subjectId, examBoard } = req.params;

    const resources = await SubjectResources.findOne({
      subject: subjectId,
      course: courseId,
      examBoard: examBoard,
    })
      .populate("subject", "name category level")
      .populate("course", "name level");

    if (!resources || !resources.resources.pastPapers?.isEnabled) {
      return res.status(404).json({
        success: false,
        message: "Past papers not found for this subject and exam board",
      });
    }

    const pastPapers = { ...resources.resources.pastPapers.toObject() };

    // Sign PDF URLs if they're from S3
    const signIfS3Url = async (url) => {
      if (!url) return null;

      if (
        !url.includes("amazonaws.com") &&
        !url.includes(process.env.AWS_BUCKET_NAME)
      ) {
        return url;
      }

      try {
        if (url.includes("AWSAccessKeyId") && url.includes("Signature")) {
          return url;
        }

        let key = null;
        const bucket = process.env.AWS_BUCKET_NAME;

        if (url.includes(`${bucket}.s3.amazonaws.com/`)) {
          key = url.split(`${bucket}.s3.amazonaws.com/`)[1].split("?")[0];
        } else if (url.includes(`s3.amazonaws.com/${bucket}/`)) {
          key = url.split(`s3.amazonaws.com/${bucket}/`)[1].split("?")[0];
        } else if (url.includes(`${bucket}/`)) {
          key = url.split(`${bucket}/`)[1].split("?")[0];
        }

        if (!key || key.startsWith("http")) return url;

        const signed = await getSignedUrl(key, 3600); // 1 hour expiry
        return signed || url;
      } catch (err) {
        console.error("Error signing PDF URL:", err);
        return url;
      }
    };

    // Sign all PDF URLs
    if (pastPapers.papers) {
      for (const paper of pastPapers.papers) {
        paper.signedPdfUrl = await signIfS3Url(paper.pdfUrl);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        subject: resources.subject,
        course: resources.course,
        examBoard: resources.examBoard,
        pastPapers,
      },
    });
  } catch (error) {
    next(error);
  }
};
