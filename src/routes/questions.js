const express = require("express");
const router = express.Router();

const questions = require("../data/questions");

// GET /questions
// List all questions
router.get("/", (req, res) => {
  const {keyword} = req.query;

  if (!keyword) {
    return res.json(questions);
  }

  const filteredQuestions=questions.filter(question =>
    question.keywords.includes(keyword.toLowerCase())
  );

  res.json(filteredQuestions);
});

//GET
//show specific question
router.get("/:questionsId", (req, res) => {
  const questionsId = Number(req.params.questionsId);

  const question = questions.find((q) => q.id === questionsId);

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(question);
});

//POST
router.post("/", (req, res) => {
    const {question, answer} = req.body;
    if (!question || !answer ) {
        return res.status(400).json({msg:"question and answer are required"})
    }

    const existingIds = questions.map(q=>q.id)
    const maxId = Math.max(...existingIds)

    const newQuestions = {
        id: question.length ? maxId + 1 : 1,
        question, answer
    }
    questions.push(newQuestions);
    res.status(201).json(newQuestions);
});

//PUT /api/questions/:quetionsId
router.put("/:questionsId", (req, res) => {
    const questionsId = Number(req.params.questionsId);
    const question = questions.find(q=>q.id===questionsId);
    if (!question) {
        return res.status(404).json({msg: "question not found"});
    }

    const {question: newQuestion, answer} = req.body;
    if (!newQuestion || !answer) {
        return res.status(400).json({msg:"question and answer required"})
    }

    question.question = newQuestion;
    question.answer = answer;

    res.json(question);
});

//DELETE /api/quetions/:quetionsId
router.delete("/:questionsId", (req, res) => {
    const questionsId = Number(req.params.questionsId);
    const questionsIndex = questions.findIndex(q=>q.id === questionsId);

    if (questionsIndex === -1) {
        return res.status(404).json({msg:"question not found"})
    }
    const deletedQuestions = questions.splice(questionsIndex, 1);
    res.json({msg:"question deleted successfully",
        question: deletedQuestions
    });
});   


module.exports = router;