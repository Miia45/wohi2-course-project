const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const path = require("path");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

function formatQuestion(question, userId) {
  const attempts = question.attempts || [];
  const solved = attempts.some(
    (a) => a.userId === userId && a.correct
  );

  return {
    id: question.id,
    question: question.question,
    imageUrl: question.imageUrl || null,
    userName: question.user?.name || null,
    attemptsCount: attempts.length,
    solved,
  };

}

router.use(authenticate);

// GET /questions
// List all questions
router.get("/", async (req, res) => {

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page-1) * limit;

  const where = {
    userId: req.user.userId,
  };

  const [questions, total] = await Promise.all([prisma.question.findMany({
    where,
    include: {user: true, attempts: true},
    orderBy: {id: "asc"},
    skip,
    take: limit,
  }), prisma.question.count({where})]);

  res.json({
    data: questions.map(q => formatQuestion(q, req.user.userId)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total/limit),
  })

});

//GET
//show specific question
router.get("/:questionsId", async (req, res) => {
  const questionsId = Number(req.params.questionsId);
  const question = await prisma.question.findUnique({
    where: { id: questionsId },
    include: {user: true, attempts: true},
  });

  if (!question) {
    return res.status(404).json({
      message: "Question not found"
    });
  }
  
  res.json(formatQuestion(question, req.user.userId));
});


//POST
router.post("/", upload.single("image"), async (req, res) => {
    const {question, answer} = req.body;

    if (!question || !answer ) {
        return res.status(400).json({msg:"question and answer are required"})
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newQuestion = await prisma.question.create({
      data: { question, answer, imageUrl, userId: req.user.userId, },
      include: {user: true},
      }); 
      
      res.status(201).json(formatQuestion(newQuestion));
});

//POST/play
router.post("/:questionsId/play", async (req, res) => {
  const questionsId = Number(req.params.questionsId);
  const { answer } = req.body;

  if (!answer) {
    return res.status(400).json({ msg: "Answer is required" });
  }

  const question = await prisma.question.findUnique({
    where: { id: questionsId },
  });

  if (!question) {
    return res.status(404).json({ msg: "Question not found" });
  }

  const isCorrect =
    question.answer.toLowerCase().trim() ===
    answer.toLowerCase().trim();

  const attempt = await prisma.attempt.create({
    data: {
      submittedAnswer: answer,
      correct: isCorrect,
      userId: req.user.userId,
      questionId: questionsId,
    },
    include: {
      question: true,
    },
  });

  res.status(201).json({
    correct: attempt.correct,
    submittedAnswer: attempt.submittedAnswer,
    correctAnswer: attempt.question.answer,
  });
});

//PUT /api/questions/:quetionsId
//isOwner checks existence and ownership
router.put("/:questionsId", upload.single("image"), isOwner, async (req, res) => {
    const questionsId = Number(req.params.questionsId);
    const {question, answer} = req.body;

    const existingQuestion = await prisma.question.findUnique({where: {id: questionsId} });

    if (!existingQuestion) {
      return res.status(404).json({msg: "question and answer are mandatory"});
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const updatedQuestion = await prisma.question.update({
      where: { id: questionsId },
      data: { question, answer, imageUrl },
      include: {user: true},
    });

    res.json(formatQuestion(updatedQuestion));
  });


//DELETE /api/quetions/:quetionsId
router.delete("/:questionsId", isOwner, async (req, res) => {
    const questionsId = Number(req.params.questionsId);
    const question = await prisma.question.findUnique({
      where: { id: questionsId },
      include: {user: true},
    });

    if (!question) {
        return res.status(404).json({msg:"question not found"})
    }
    await prisma.question.delete({where: {id: questionsId } });

    res.json({msg:"Question deleted successfully",
        question:(formatQuestion(question)),
    });
});   


module.exports = router;