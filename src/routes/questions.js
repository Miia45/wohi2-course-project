const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const path = require("path");
const multer = require("multer");
const {NotFoundError, ValidationError} = require("../lib/errors");
const { z } = require("zod");

const QuestionInput = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});


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
//random question
//api/questions/random?count=10
router.get("/random", async (req, res) => {
  const count = Math.min(
    50,
    Math.max(1, parseInt(req.query.count) || 10)
  );

  const questions = await prisma.question.findMany({
    include: { user: true, attempts: true, },
  });

  const shuffled = questions.sort(() => 0.5 - Math.random());

  const selected = shuffled.slice(0, count);

  const formatted = selected.map((q) => ({
    id: q.id,
    question: q.question,
    imageUrl: q.imageUrl,
    userName: q.user?.name || null,
    attemptsCount: q.attempts.length,
  }));

  res.json({
    count: formatted.length,
    data: formatted,
  });

});

//GET 
//api/leaderboard
router.get("/leaderboard", async (req, res) => {

  try {
    console.log("leaderboard route hit");
  
  const users = await prisma.user.findMany({
    include: {
      attempts: true,
    },
  });

  console.log(users);

  const leaderboard = users
    .map((user) => ({
      userId: user.id,
      name: user.name,
      score: user.attempts.filter((a) => a.correct).length,
    }))
    .sort((a, b) => b.score - a.score);

  res.json(leaderboard); 

  } catch (err) {
    console.log(err);
    res.status(500).json({error: err.message});
  }

});

//GET
//api/users/me/stats
router.get("/stats", async (req, res) => {
  const userId = req.user.userId;

  const questionsCreated = await prisma.question.count({
    where: {
      userId,
    },
  });

  const attempts = await prisma.attempt.count({
    where: {
      userId,
    },
  });

  const correctAnswers = await prisma.attempt.count({
    where: {
      userId,
      correct: true,
    },
  });

  const solvedQuestions = await prisma.attempt.groupBy({
  by: ["questionId"],
  where: {
    userId,
    correct: true,
  },
  });

  const accuracy =
    attempts === 0
      ? 0
      : Math.round((correctAnswers / attempts) * 100);

  res.json({
    questionsCreated,
    attempts,
    correctAnswers,
    questionsSolved: solvedQuestions.length,
    accuracy,
  });
});

//GET
//show specific question
router.get("/:questionsId", async (req, res) => {
  const questionsId = Number(req.params.questionsId);

  if (isNaN(questionsId) || questionsId < 1) {
    throw new NotFoundError("Question not found");
  }

  const question = await prisma.question.findUnique({
    where: { id: questionsId },
    include: {user: true, attempts: true},
  });

  if (!question) {
    throw new NotFoundError("Question not found");
  }
  
  res.json(formatQuestion(question, req.user.userId));
});


//POST
router.post("/", upload.single("image"), async (req, res) => {

    const {question, answer} = QuestionInput.parse(req.body);

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (question.length > 255) {
        throw new ValidationError("Question is too long");
    }

    const newQuestion = await prisma.question.create({
      data: { question, answer, imageUrl, userId: req.user.userId, },
      include: {user: true},
      }); 

      res.status(201).json(formatQuestion(newQuestion, req.user.userId

      ));
});

//POST/play
router.post("/:questionsId/play", async (req, res) => {
  const questionsId = Number(req.params.questionsId);
  const { answer } = req.body;

  if (!answer) {
    throw new ValidationError("answer is required" );
  }

  const question = await prisma.question.findUnique({
    where: { id: questionsId },
  });

  if (!question) {
    throw new NotFoundError("Question not found");
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

//PUT /api/questions/:questionsId
//isOwner checks existence and ownership
router.put("/:questionsId", upload.single("image"), isOwner, async (req, res) => {
    const questionsId = Number(req.params.questionsId);
    const {question, answer} = QuestionInput.parse(req.body);

    const existingQuestion = await prisma.question.findUnique({where: {id: questionsId} });

    if (!existingQuestion) {
      throw new ValidationError("question and answer are mandatory");
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const updatedQuestion = await prisma.question.update({
      where: { id: questionsId },
      data: { question, answer, imageUrl },
      include: {user: true},
    });


    res.json(formatQuestion(updatedQuestion, req.user.userId));
  });


//DELETE /api/quetions/:questionsId
router.delete("/:questionsId", isOwner, async (req, res) => {
    const questionsId = Number(req.params.questionsId);
    const question = await prisma.question.findUnique({
      where: { id: questionsId },
      include: {user: true},
    });

    if (!question) {
        throw new NotFoundError("Question not found");
    }
    await prisma.question.delete({where: {id: questionsId } });

    res.json({msg:"Question deleted successfully",
        question:(formatQuestion(question, req.user.userId)),
    });
});   


module.exports = router;